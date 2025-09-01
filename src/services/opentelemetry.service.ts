import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { MetricReader } from '@opentelemetry/sdk-metrics';
import { OpenTelemetryConfig } from '@/interfaces/opentelemetry-config.interface';
import { EnhancedWinstonLoggerService } from './logger.service';

const OPENTELEMETRY_CONFIG = 'OPENTELEMETRY_CONFIG';

@Injectable()
export class OpenTelemetryService implements OnModuleInit, OnModuleDestroy {
  private sdk: NodeSDK;
  private prometheusExporter?: PrometheusExporter;
  private logger: EnhancedWinstonLoggerService;

  constructor(
    @Inject(OPENTELEMETRY_CONFIG) private readonly config: OpenTelemetryConfig,
    @Optional() logger?: EnhancedWinstonLoggerService,
  ) {
    // 创建一个安全的 logger 包装器，避免循环依赖问题
    this.logger = logger || this.createNoopLogger();
  }

  private createNoopLogger(): EnhancedWinstonLoggerService {
    // 创建一个空的 logger 实现，避免在构造函数中设置上下文
    return {
      setContext: () => {},
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
      verbose: () => {},
      log: () => {},
      logWithMeta: () => {},
      logHttpRequest: () => {},
      logDbQuery: () => {},
      getWinstonLogger: () => ({}) as unknown,
    } as EnhancedWinstonLoggerService;
  }

  async onModuleInit(): Promise<void> {
    try {
      this.logger.setContext('OpenTelemetryService');
      await this.initializeOpenTelemetry();
      this.logger.info('OpenTelemetry 初始化成功');
    } catch (error) {
      this.logger.error('OpenTelemetry 初始化失败', error.stack);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.sdk) {
        await this.sdk.shutdown();
        this.logger.info('OpenTelemetry SDK 关闭成功');
      }

      if (this.prometheusExporter) {
        this.prometheusExporter.shutdown();
        this.logger.info('Prometheus 导出器关闭成功');
      }
    } catch (error) {
      this.logger.error('关闭 OpenTelemetry 时发生错误', error.stack);
    }
  }

  private async initializeOpenTelemetry(): Promise<void> {
    // 创建资源
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment || 'development',
    });

    // 配置仪表化
    const instrumentations = getNodeAutoInstrumentations({
      // 如需要可禁用某些仪表化
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // 通常太吃噪
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        requestHook: (span, request) => {
          span.setAttributes({
            'http.request.header.user-agent': request.getHeader?.('user-agent') || 'unknown',
            'http.request.header.x-forwarded-for': request.getHeader?.('x-forwarded-for') || 'unknown',
          });
        },
        responseHook: (span, response) => {
          span.setAttributes({
            'http.response.header.content-type': response.getHeader?.('content-type') || 'unknown',
          });
        },
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-nestjs-core': {
        enabled: true,
      },
    });

    // 配置导出器
    const traceExporters: SpanExporter[] = [];
    const metricReaders: MetricReader[] = [];

    // Jaeger 追踪导出器
    if (this.config.jaegerEndpoint) {
      const jaegerExporter = new JaegerExporter({
        endpoint: this.config.jaegerEndpoint,
      });
      traceExporters.push(jaegerExporter);
      this.logger.info(`Jaeger 导出器已配置: ${this.config.jaegerEndpoint}`);
    }

    // Prometheus 指标导出器
    if (this.config.metrics?.enabled !== false) {
      this.prometheusExporter = new PrometheusExporter({
        port: this.config.prometheusEndpoint
          ? parseInt(this.config.prometheusEndpoint.split(':').pop() || '9464') || 9464
          : 9464,
      });
      metricReaders.push(this.prometheusExporter);
      this.logger.info(
        `Prometheus 导出器已配置在端口: ${this.prometheusExporter.getMetricsRequestHandler ? 9464 : '未知'}`,
      );
    }

    // 创建 SDK
    this.sdk = new NodeSDK({
      resource,
      instrumentations,
      traceExporter: traceExporters.length > 0 ? traceExporters[0] : undefined,
      metricReader: metricReaders.length > 0 ? metricReaders[0] : undefined,
      sampler: await this.createSampler(),
    });

    // 启动 SDK
    this.sdk.start();
  }

  private async createSampler() {
    const sampleRate = this.config.tracing?.sampleRate || 1.0;

    // 动态导入采样类以避免循环依赖
    const { TraceIdRatioBasedSampler } = await import('@opentelemetry/sdk-trace-base');

    return new TraceIdRatioBasedSampler(sampleRate);
  }

  /**
   * 获取 SDK 实例
   */
  getSDK(): NodeSDK {
    return this.sdk;
  }

  /**
   * 获取 Prometheus 导出器
   */
  getPrometheusExporter(): PrometheusExporter | undefined {
    return this.prometheusExporter;
  }

  /**
   * 检查 OpenTelemetry 是否已初始化
   */
  isInitialized(): boolean {
    return !!this.sdk;
  }

  /**
   * 获取服务信息
   */
  getServiceInfo(): {
    serviceName: string;
    serviceVersion: string;
    environment: string;
  } {
    return {
      serviceName: this.config.serviceName,
      serviceVersion: this.config.serviceVersion || '1.0.0',
      environment: this.config.environment || 'development',
    };
  }
}
