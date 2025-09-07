import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import {
  OpenTelemetryConfig,
  OpenTelemetryModuleOptions,
  OpenTelemetryModuleAsyncOptions,
} from '@/interfaces/opentelemetry-config.interface';
import { OpenTelemetryService } from '@/services/opentelemetry.service';
import { EnhancedWinstonLoggerService } from '@/services/logger.service';
import { MetricsService } from '@/services/metrics.service';
import { TracingService } from '@/services/tracing.service';
import { TracingInterceptor } from '@/interceptors/tracing.interceptor';
import { MetricsInterceptor } from '@/interceptors/metrics.interceptor';

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

const OPENTELEMETRY_CONFIG = 'OPENTELEMETRY_CONFIG';

@Global()
@Module({})
export class OpenTelemetryModule {
  /**
   * 使用静态配置注册 OpenTelemetry 模块
   */
  static forRoot(options: OpenTelemetryModuleOptions): DynamicModule {
    return {
      module: OpenTelemetryModule,
      providers: [
        {
          provide: OPENTELEMETRY_CONFIG,
          useValue: options.config,
        },
        Reflector,
        EnhancedWinstonLoggerService,
        MetricsService,
        TracingService,
        OpenTelemetryService,
        TracingInterceptor,
        MetricsInterceptor,
        {
          provide: APP_INTERCEPTOR,
          useFactory: (tracingService: TracingService, reflector: Reflector) => {
            return new TracingInterceptor(tracingService, reflector);
          },
          inject: [TracingService, Reflector],
        },
        {
          provide: APP_INTERCEPTOR,
          useFactory: (metricsService: MetricsService, reflector: Reflector) => {
            return new MetricsInterceptor(metricsService, reflector);
          },
          inject: [MetricsService, Reflector],
        },
      ],
      exports: [EnhancedWinstonLoggerService, MetricsService, TracingService, OpenTelemetryService],
    };
  }

  /**
   * 使用异步配置注册 OpenTelemetry 模块
   */
  static forRootAsync(options: OpenTelemetryModuleAsyncOptions): DynamicModule {
    return {
      module: OpenTelemetryModule,
      providers: [
        {
          provide: OPENTELEMETRY_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        Reflector,
        EnhancedWinstonLoggerService,
        MetricsService,
        TracingService,
        OpenTelemetryService,
        TracingInterceptor,
        MetricsInterceptor,
        {
          provide: APP_INTERCEPTOR,
          useFactory: (tracingService: TracingService, reflector: Reflector) => {
            return new TracingInterceptor(tracingService, reflector);
          },
          inject: [TracingService, Reflector],
        },
        {
          provide: APP_INTERCEPTOR,
          useFactory: (metricsService: MetricsService, reflector: Reflector) => {
            return new MetricsInterceptor(metricsService, reflector);
          },
          inject: [MetricsService, Reflector],
        },
      ],
      exports: [EnhancedWinstonLoggerService, MetricsService, TracingService, OpenTelemetryService],
    };
  }

  /**
   * 使用自定义配置创建功能模块
   * 对于需要不同配置的微服务或特定模块很有用
   */
  static forFeature(config: Partial<OpenTelemetryConfig>): DynamicModule {
    return {
      module: OpenTelemetryModule,
      providers: [
        {
          provide: `OPENTELEMETRY_FEATURE_CONFIG`,
          useValue: config,
        },
      ],
      exports: [EnhancedWinstonLoggerService, MetricsService, TracingService, OpenTelemetryService],
    };
  }
}

/**
 * 从环境变量创建 OpenTelemetry 配置的工具函数
 */
export function createOpenTelemetryConfigFromEnv(): OpenTelemetryConfig {
  return {
    serviceName: process.env.OTEL_SERVICE_NAME || process.env.npm_package_name || 'unknown-service',
    serviceVersion: process.env.OTEL_SERVICE_VERSION || process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || process.env.ENVIRONMENT || 'development',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    jaegerEndpoint: process.env.OTEL_EXPORTER_JAEGER_ENDPOINT,
    prometheusEndpoint: process.env.OTEL_EXPORTER_PROMETHEUS_ENDPOINT,
    logging: {
      console: process.env.OTEL_LOG_CONSOLE !== 'false',
      file: process.env.OTEL_LOG_FILE !== 'false',
      logDir: process.env.OTEL_LOG_DIR || './logs',
      level: (process.env.OTEL_LOG_LEVEL as LogLevel) || 'info',
      maxSize: process.env.OTEL_LOG_MAX_SIZE || '20m',
      maxFiles: process.env.OTEL_LOG_MAX_FILES || '14d',
      datePattern: process.env.OTEL_LOG_DATE_PATTERN || 'YYYY-MM-DD',
    },
    tracing: {
      enabled: process.env.OTEL_TRACING_ENABLED !== 'false',
      sampleRate: process.env.OTEL_TRACING_SAMPLE_RATE ? parseFloat(process.env.OTEL_TRACING_SAMPLE_RATE) : 1.0,
    },
    metrics: {
      enabled: process.env.OTEL_METRICS_ENABLED !== 'false',
      interval: process.env.OTEL_METRICS_INTERVAL ? parseInt(process.env.OTEL_METRICS_INTERVAL) : 30000,
    },
  };
}

/**
 * 默认 OpenTelemetry 配置
 */
export const DEFAULT_OPENTELEMETRY_CONFIG: OpenTelemetryConfig = {
  serviceName: 'nestjs-app',
  serviceVersion: '1.0.0',
  environment: 'development',
  logging: {
    console: true,
    file: true,
    logDir: './logs',
    level: 'info',
    maxSize: '20m',
    maxFiles: '14d',
    datePattern: 'YYYY-MM-DD',
  },
  tracing: {
    enabled: true,
    sampleRate: 1.0,
  },
  metrics: {
    enabled: true,
    interval: 30000,
  },
};
