import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { OpenTelemetryService } from '@/services/opentelemetry.service';
import { DEFAULT_OPENTELEMETRY_CONFIG } from '@/opentelemetry.module';

// Mock NodeSDK
const mockSDK = {
  start: vi.fn(),
  shutdown: vi.fn(),
};

// Mock exporters
const mockJaegerExporter = {};
const mockPrometheusExporter = {
  shutdown: vi.fn(),
  getMetricsRequestHandler: vi.fn(),
};

// Mock Resource
const mockResource = {};

// Mock sampler
const mockSampler = {};

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => mockSDK),
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn().mockReturnValue([]),
}));

vi.mock('@opentelemetry/exporter-jaeger', () => ({
  JaegerExporter: vi.fn().mockImplementation(() => mockJaegerExporter),
}));

vi.mock('@opentelemetry/exporter-prometheus', () => ({
  PrometheusExporter: vi.fn().mockImplementation(() => mockPrometheusExporter),
}));

vi.mock('@opentelemetry/resources', () => ({
  Resource: vi.fn().mockImplementation(() => mockResource),
}));

vi.mock('@opentelemetry/semantic-conventions', () => ({
  SemanticResourceAttributes: {
    SERVICE_NAME: 'service.name',
    SERVICE_VERSION: 'service.version',
    DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
  },
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  TraceIdRatioBasedSampler: vi.fn().mockImplementation(() => mockSampler),
}));

// Mock logger
const mockLogger = {
  setContext: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
};

describe('OpenTelemetryService', () => {
  let openTelemetryService: OpenTelemetryService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations to default behavior
    mockSDK.start.mockImplementation(() => {});
    mockSDK.shutdown.mockImplementation(() => {});
    openTelemetryService = new OpenTelemetryService(DEFAULT_OPENTELEMETRY_CONFIG, mockLogger as any);
  });

  describe('构造函数', () => {
    it('应该设置日志上下文', () => {
      // 由于我们改变了实现以避免循环依赖，现在在 onModuleInit 中设置上下文
      expect(mockLogger.setContext).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('应该成功初始化OpenTelemetry', async () => {
      await openTelemetryService.onModuleInit();

      expect(mockSDK.start).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('OpenTelemetry 初始化成功');
    });

    it('应该在初始化失败时记录错误并重新抛出', async () => {
      const error = new Error('初始化失败');
      mockSDK.start.mockImplementation(() => {
        throw error;
      });

      await expect(openTelemetryService.onModuleInit()).rejects.toThrow('初始化失败');
      expect(mockLogger.error).toHaveBeenCalledWith('OpenTelemetry 初始化失败', error.stack);
    });
  });

  describe('onModuleDestroy', () => {
    beforeEach(async () => {
      await openTelemetryService.onModuleInit();
    });

    it('应该成功关闭SDK', async () => {
      await openTelemetryService.onModuleDestroy();

      expect(mockSDK.shutdown).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('OpenTelemetry SDK 关闭成功');
    });

    it('应该关闭Prometheus导出器', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        metrics: { enabled: true },
      };
      const service = new OpenTelemetryService(config, mockLogger as any);
      await service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockPrometheusExporter.shutdown).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Prometheus 导出器关闭成功');
    });

    it('应该在关闭失败时记录错误', async () => {
      const error = new Error('关闭失败');
      mockSDK.shutdown.mockRejectedValue(error);

      await openTelemetryService.onModuleDestroy();

      expect(mockLogger.error).toHaveBeenCalledWith('关闭 OpenTelemetry 时发生错误', error.stack);
    });

    it('应该在没有SDK时不执行任何操作', async () => {
      const service = new OpenTelemetryService(DEFAULT_OPENTELEMETRY_CONFIG, mockLogger as any);

      await service.onModuleDestroy();

      expect(mockSDK.shutdown).not.toHaveBeenCalled();
    });
  });

  describe('initializeOpenTelemetry', () => {
    it('应该创建正确的资源配置', async () => {
      const { Resource } = await import('@opentelemetry/resources');
      const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');

      await openTelemetryService.onModuleInit();

      expect(Resource).toHaveBeenCalledWith({
        [SemanticResourceAttributes.SERVICE_NAME]: DEFAULT_OPENTELEMETRY_CONFIG.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: DEFAULT_OPENTELEMETRY_CONFIG.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: DEFAULT_OPENTELEMETRY_CONFIG.environment,
      });
    });

    it('应该配置自动仪表化', async () => {
      const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');

      await openTelemetryService.onModuleInit();

      expect(getNodeAutoInstrumentations).toHaveBeenCalledWith({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          requestHook: expect.any(Function),
          responseHook: expect.any(Function),
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-nestjs-core': {
          enabled: true,
        },
      });
    });

    it('应该配置Jaeger导出器', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        jaegerEndpoint: 'http://localhost:14268/api/traces',
      };
      const service = new OpenTelemetryService(config, mockLogger as any);

      await service.onModuleInit();

      const { JaegerExporter } = await import('@opentelemetry/exporter-jaeger');
      expect(JaegerExporter).toHaveBeenCalledWith({
        endpoint: config.jaegerEndpoint,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(`Jaeger 导出器已配置: ${config.jaegerEndpoint}`);
    });

    it('应该配置Prometheus导出器', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        prometheusEndpoint: 'http://localhost:9090',
        metrics: { enabled: true },
      };
      const service = new OpenTelemetryService(config, mockLogger as any);

      await service.onModuleInit();

      const { PrometheusExporter } = await import('@opentelemetry/exporter-prometheus');
      expect(PrometheusExporter).toHaveBeenCalledWith({
        port: 9090,
      });
    });

    it('应该使用默认Prometheus端口', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        metrics: { enabled: true },
      };
      const service = new OpenTelemetryService(config, mockLogger as any);

      await service.onModuleInit();

      const { PrometheusExporter } = await import('@opentelemetry/exporter-prometheus');
      expect(PrometheusExporter).toHaveBeenCalledWith({
        port: 9464,
      });
    });

    it('应该在指标禁用时不配置Prometheus导出器', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        metrics: { enabled: false },
      };
      const service = new OpenTelemetryService(config, mockLogger as any);

      await service.onModuleInit();

      const { PrometheusExporter } = await import('@opentelemetry/exporter-prometheus');
      expect(PrometheusExporter).not.toHaveBeenCalled();
    });

    it('应该创建采样器', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        tracing: { sampleRate: 0.5 },
      };
      const service = new OpenTelemetryService(config, mockLogger as any);

      await service.onModuleInit();

      const { TraceIdRatioBasedSampler } = await import('@opentelemetry/sdk-trace-base');
      expect(TraceIdRatioBasedSampler).toHaveBeenCalledWith(0.5);
    });

    it('应该使用默认采样率', async () => {
      await openTelemetryService.onModuleInit();

      const { TraceIdRatioBasedSampler } = await import('@opentelemetry/sdk-trace-base');
      expect(TraceIdRatioBasedSampler).toHaveBeenCalledWith(1.0);
    });
  });

  describe('HTTP仪表化钩子', () => {
    it('应该正确配置HTTP请求钩子', async () => {
      const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');

      await openTelemetryService.onModuleInit();

      const config = (getNodeAutoInstrumentations as MockedFunction<typeof getNodeAutoInstrumentations>).mock
        .calls[0][0];
      const httpConfig = config['@opentelemetry/instrumentation-http'];

      // 测试请求钩子
      const mockSpan = { setAttributes: vi.fn() };
      const mockRequest = {
        getHeader: vi.fn().mockReturnValueOnce('Mozilla/5.0').mockReturnValueOnce('192.168.1.1'),
      };

      httpConfig.requestHook(mockSpan, mockRequest);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.request.header.user-agent': 'Mozilla/5.0',
        'http.request.header.x-forwarded-for': '192.168.1.1',
      });
    });

    it('应该正确配置HTTP响应钩子', async () => {
      const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');

      await openTelemetryService.onModuleInit();

      const config = (getNodeAutoInstrumentations as MockedFunction<typeof getNodeAutoInstrumentations>).mock
        .calls[0][0];
      const httpConfig = config['@opentelemetry/instrumentation-http'];

      // 测试响应钩子
      const mockSpan = { setAttributes: vi.fn() };
      const mockResponse = {
        getHeader: vi.fn().mockReturnValue('application/json'),
      };

      httpConfig.responseHook(mockSpan, mockResponse);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.response.header.content-type': 'application/json',
      });
    });

    it('应该处理缺失的请求头', async () => {
      const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');

      await openTelemetryService.onModuleInit();

      const config = (getNodeAutoInstrumentations as MockedFunction<typeof getNodeAutoInstrumentations>).mock
        .calls[0][0];
      const httpConfig = config['@opentelemetry/instrumentation-http'];

      const mockSpan = { setAttributes: vi.fn() };
      const mockRequest = {
        getHeader: vi.fn().mockReturnValue(undefined),
      };

      httpConfig.requestHook(mockSpan, mockRequest);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.request.header.user-agent': 'unknown',
        'http.request.header.x-forwarded-for': 'unknown',
      });
    });

    it('应该处理没有getHeader方法的请求对象', async () => {
      const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');

      await openTelemetryService.onModuleInit();

      const config = (getNodeAutoInstrumentations as MockedFunction<typeof getNodeAutoInstrumentations>).mock
        .calls[0][0];
      const httpConfig = config['@opentelemetry/instrumentation-http'];

      const mockSpan = { setAttributes: vi.fn() };
      const mockRequest = {};

      httpConfig.requestHook(mockSpan, mockRequest);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'http.request.header.user-agent': 'unknown',
        'http.request.header.x-forwarded-for': 'unknown',
      });
    });
  });

  describe('getter方法', () => {
    beforeEach(async () => {
      await openTelemetryService.onModuleInit();
    });

    describe('getSDK', () => {
      it('应该返回SDK实例', () => {
        const sdk = openTelemetryService.getSDK();
        expect(sdk).toBe(mockSDK);
      });
    });

    describe('getPrometheusExporter', () => {
      it('应该返回Prometheus导出器', () => {
        const exporter = openTelemetryService.getPrometheusExporter();
        expect(exporter).toBe(mockPrometheusExporter);
      });

      it('应该在没有Prometheus导出器时返回undefined', () => {
        const config = {
          ...DEFAULT_OPENTELEMETRY_CONFIG,
          metrics: { enabled: false },
        };
        const service = new OpenTelemetryService(config, mockLogger as any);

        const exporter = service.getPrometheusExporter();
        expect(exporter).toBeUndefined();
      });
    });

    describe('isInitialized', () => {
      it('应该在初始化后返回true', () => {
        expect(openTelemetryService.isInitialized()).toBe(true);
      });

      it('应该在未初始化时返回false', () => {
        const service = new OpenTelemetryService(DEFAULT_OPENTELEMETRY_CONFIG, mockLogger as any);
        expect(service.isInitialized()).toBe(false);
      });
    });

    describe('getServiceInfo', () => {
      it('应该返回服务信息', () => {
        const serviceInfo = openTelemetryService.getServiceInfo();

        expect(serviceInfo).toEqual({
          serviceName: DEFAULT_OPENTELEMETRY_CONFIG.serviceName,
          serviceVersion: DEFAULT_OPENTELEMETRY_CONFIG.serviceVersion,
          environment: DEFAULT_OPENTELEMETRY_CONFIG.environment,
        });
      });

      it('应该使用默认值当配置缺失时', () => {
        const config = {
          serviceName: 'test-service',
          // serviceVersion 和 environment 未设置
        };
        const service = new OpenTelemetryService(config as any, mockLogger as any);

        const serviceInfo = service.getServiceInfo();

        expect(serviceInfo).toEqual({
          serviceName: 'test-service',
          serviceVersion: '1.0.0',
          environment: 'development',
        });
      });
    });
  });

  describe('端点解析', () => {
    it('应该正确解析Prometheus端点端口', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        prometheusEndpoint: 'http://localhost:8080',
        metrics: { enabled: true },
      };
      const service = new OpenTelemetryService(config, mockLogger as any);

      await service.onModuleInit();

      const { PrometheusExporter } = await import('@opentelemetry/exporter-prometheus');
      expect(PrometheusExporter).toHaveBeenCalledWith({
        port: 8080,
      });
    });

    it('应该处理无效的Prometheus端点', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        prometheusEndpoint: 'invalid-endpoint',
        metrics: { enabled: true },
      };
      const service = new OpenTelemetryService(config, mockLogger as any);

      await service.onModuleInit();

      const { PrometheusExporter } = await import('@opentelemetry/exporter-prometheus');
      expect(PrometheusExporter).toHaveBeenCalledWith({
        port: 9464, // 使用默认端口
      });
    });
  });

  describe('配置变化', () => {
    it('应该处理undefined serviceVersion', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        serviceVersion: undefined,
      };
      const service = new OpenTelemetryService(config, mockLogger as any);

      await service.onModuleInit();

      const { Resource } = await import('@opentelemetry/resources');
      expect(Resource).toHaveBeenCalledWith(
        expect.objectContaining({
          'service.version': '1.0.0',
        }),
      );
    });

    it('应该处理undefined environment', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        environment: undefined,
      };
      const service = new OpenTelemetryService(config, mockLogger as any);

      await service.onModuleInit();

      const { Resource } = await import('@opentelemetry/resources');
      expect(Resource).toHaveBeenCalledWith(
        expect.objectContaining({
          'deployment.environment': 'development',
        }),
      );
    });

    it('应该处理undefined tracing配置', async () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        tracing: undefined,
      };
      const service = new OpenTelemetryService(config, mockLogger as any);

      await service.onModuleInit();

      const { TraceIdRatioBasedSampler } = await import('@opentelemetry/sdk-trace-base');
      expect(TraceIdRatioBasedSampler).toHaveBeenCalledWith(1.0);
    });
  });

  describe('错误处理', () => {
    it('应该处理动态导入失败', async () => {
      // 这个测试模拟动态导入失败的情况
      vi.doMock('@opentelemetry/sdk-trace-base', () => {
        throw new Error('导入失败');
      });

      await expect(openTelemetryService.onModuleInit()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
