import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OpenTelemetryModule,
  createOpenTelemetryConfigFromEnv,
  DEFAULT_OPENTELEMETRY_CONFIG,
  EnhancedWinstonLoggerService,
  MetricsService,
  TracingService,
  OpenTelemetryService,
  TRACE_METADATA_KEY,
  METRICS_METADATA_KEY,
} from '@/index';

// Mock all external dependencies
vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn().mockReturnValue({
      startSpan: vi.fn().mockReturnValue({
        setAttributes: vi.fn(),
        setAttribute: vi.fn(),
        addEvent: vi.fn(),
        recordException: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
        spanContext: vi.fn().mockReturnValue({
          traceId: 'test-trace-id',
          spanId: 'test-span-id',
        }),
      }),
    }),
    getActiveSpan: vi.fn(),
    setSpan: vi.fn(),
  },
  context: {
    active: vi.fn().mockReturnValue({}),
    with: vi.fn().mockImplementation((ctx, fn) => fn()),
  },
  metrics: {
    getMeter: vi.fn().mockReturnValue({
      createCounter: vi.fn().mockReturnValue({ add: vi.fn() }),
      createHistogram: vi.fn().mockReturnValue({ record: vi.fn() }),
      createGauge: vi.fn().mockReturnValue({ record: vi.fn() }),
    }),
  },
  SpanKind: {
    INTERNAL: 0,
    SERVER: 1,
    CLIENT: 2,
    PRODUCER: 3,
    CONSUMER: 4,
  },
  SpanStatusCode: {
    OK: 'OK',
    ERROR: 'ERROR',
  },
  ValueType: {
    DOUBLE: 'DOUBLE',
  },
}));

vi.mock('winston', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    log: vi.fn(),
  }),
  format: {
    combine: vi.fn(() => 'combined-format'),
    timestamp: vi.fn(() => 'timestamp-format'),
    errors: vi.fn(() => 'errors-format'),
    json: vi.fn(() => 'json-format'),
    printf: vi.fn(() => 'printf-format'),
    colorize: vi.fn(() => 'colorize-format'),
    simple: vi.fn(() => 'simple-format'),
  },
  transports: {
    Console: vi.fn(),
  },
}));

vi.mock('winston-daily-rotate-file', () => ({
  default: vi.fn(),
}));

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn().mockReturnValue([]),
}));

vi.mock('@opentelemetry/exporter-jaeger', () => ({
  JaegerExporter: vi.fn(),
}));

vi.mock('@opentelemetry/exporter-prometheus', () => ({
  PrometheusExporter: vi.fn().mockImplementation(() => ({
    shutdown: vi.fn(),
  })),
}));

vi.mock('@opentelemetry/resources', () => ({
  Resource: vi.fn(),
}));

vi.mock('@opentelemetry/semantic-conventions', () => ({
  SemanticResourceAttributes: {
    SERVICE_NAME: 'service.name',
    SERVICE_VERSION: 'service.version',
    DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
  },
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  TraceIdRatioBasedSampler: vi.fn(),
}));

describe('OpenTelemetry库基础功能测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('模块导出', () => {
    it('应该导出OpenTelemetryModule', () => {
      expect(OpenTelemetryModule).toBeDefined();
      expect(typeof OpenTelemetryModule.forRoot).toBe('function');
      expect(typeof OpenTelemetryModule.forRootAsync).toBe('function');
      expect(typeof OpenTelemetryModule.forFeature).toBe('function');
    });

    it('应该导出配置工具函数', () => {
      expect(createOpenTelemetryConfigFromEnv).toBeDefined();
      expect(typeof createOpenTelemetryConfigFromEnv).toBe('function');
      expect(DEFAULT_OPENTELEMETRY_CONFIG).toBeDefined();
    });

    it('应该导出所有服务', () => {
      expect(EnhancedWinstonLoggerService).toBeDefined();
      expect(MetricsService).toBeDefined();
      expect(TracingService).toBeDefined();
      expect(OpenTelemetryService).toBeDefined();
    });

    it('应该导出装饰器元数据键', () => {
      expect(TRACE_METADATA_KEY).toBe('otel:trace');
      expect(METRICS_METADATA_KEY).toBe('otel:metrics');
    });
  });

  describe('配置功能', () => {
    it('应该创建默认配置', () => {
      const config = createOpenTelemetryConfigFromEnv();
      expect(config).toBeDefined();
      expect(config.serviceName).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.tracing).toBeDefined();
      expect(config.metrics).toBeDefined();
    });

    it('应该具有正确的默认配置值', () => {
      expect(DEFAULT_OPENTELEMETRY_CONFIG.serviceName).toBe('nestjs-app');
      expect(DEFAULT_OPENTELEMETRY_CONFIG.serviceVersion).toBe('1.0.0');
      expect(DEFAULT_OPENTELEMETRY_CONFIG.environment).toBe('development');
      expect(DEFAULT_OPENTELEMETRY_CONFIG.logging?.console).toBe(true);
      expect(DEFAULT_OPENTELEMETRY_CONFIG.tracing?.enabled).toBe(true);
      expect(DEFAULT_OPENTELEMETRY_CONFIG.metrics?.enabled).toBe(true);
    });

    it('应该从环境变量读取配置', () => {
      // 设置环境变量
      process.env.OTEL_SERVICE_NAME = 'test-service';
      process.env.OTEL_SERVICE_VERSION = '2.0.0';
      process.env.NODE_ENV = 'production';

      const config = createOpenTelemetryConfigFromEnv();

      expect(config.serviceName).toBe('test-service');
      expect(config.serviceVersion).toBe('2.0.0');
      expect(config.environment).toBe('production');

      // 清理环境变量
      delete process.env.OTEL_SERVICE_NAME;
      delete process.env.OTEL_SERVICE_VERSION;
      delete process.env.NODE_ENV;
    });
  });

  describe('模块创建', () => {
    it('应该创建forRoot模块', () => {
      const config = DEFAULT_OPENTELEMETRY_CONFIG;
      const dynamicModule = OpenTelemetryModule.forRoot({ config });

      expect(dynamicModule.module).toBe(OpenTelemetryModule);
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();
    });

    it('应该创建forRootAsync模块', () => {
      const asyncOptions = {
        useFactory: () => Promise.resolve(DEFAULT_OPENTELEMETRY_CONFIG),
        inject: [],
      };

      const dynamicModule = OpenTelemetryModule.forRootAsync(asyncOptions);

      expect(dynamicModule.module).toBe(OpenTelemetryModule);
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();
    });

    it('应该创建forFeature模块', () => {
      const featureConfig = { serviceName: 'feature-service' };
      const dynamicModule = OpenTelemetryModule.forFeature(featureConfig);

      expect(dynamicModule.module).toBe(OpenTelemetryModule);
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();
    });
  });

  describe('服务实例化', () => {
    it('应该创建日志服务', () => {
      const logger = new EnhancedWinstonLoggerService(DEFAULT_OPENTELEMETRY_CONFIG);
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.setContext).toBe('function');
    });

    it('应该创建指标服务', () => {
      const metrics = new MetricsService(DEFAULT_OPENTELEMETRY_CONFIG);
      expect(metrics).toBeDefined();
      expect(typeof metrics.createCounter).toBe('function');
      expect(typeof metrics.createHistogram).toBe('function');
      expect(typeof metrics.createGauge).toBe('function');
    });

    it('应该创建追踪服务', () => {
      const tracing = new TracingService(DEFAULT_OPENTELEMETRY_CONFIG);
      expect(tracing).toBeDefined();
      expect(typeof tracing.startSpan).toBe('function');
      expect(typeof tracing.withSpan).toBe('function');
      expect(typeof tracing.addAttribute).toBe('function');
    });

    it('应该创建OpenTelemetry服务', () => {
      const mockLogger = {
        setContext: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      };

      const otelService = new OpenTelemetryService(DEFAULT_OPENTELEMETRY_CONFIG, mockLogger as any);
      expect(otelService).toBeDefined();
      expect(typeof otelService.getServiceInfo).toBe('function');
      expect(typeof otelService.isInitialized).toBe('function');
    });
  });

  describe('服务功能验证', () => {
    let logger: EnhancedWinstonLoggerService;
    let metrics: MetricsService;
    let tracing: TracingService;

    beforeEach(() => {
      logger = new EnhancedWinstonLoggerService(DEFAULT_OPENTELEMETRY_CONFIG);
      metrics = new MetricsService(DEFAULT_OPENTELEMETRY_CONFIG);
      tracing = new TracingService(DEFAULT_OPENTELEMETRY_CONFIG);
    });

    it('日志服务应该正常工作', () => {
      expect(() => {
        logger.setContext('TestContext');
        logger.info('测试信息');
        logger.warn('测试警告');
        logger.error('测试错误');
        logger.debug('测试调试');
        logger.verbose('测试详细');
        logger.logWithMeta('info', '带元数据的消息', { key: 'value' });
        logger.logHttpRequest('GET', '/api/test', 200, 100);
        logger.logDbQuery('SELECT * FROM users', 50);
      }).not.toThrow();
    });

    it('指标服务应该正常工作', () => {
      expect(() => {
        metrics.onModuleInit();
        metrics.incrementHttpRequests('GET', '/api', 200);
        metrics.recordHttpRequestDuration(100, 'GET', '/api', 200);
        metrics.setActiveConnections(5);
        metrics.incrementErrors('TestError', 'TestService');
        metrics.recordBusinessEvent('test_event', 1, { type: 'test' });
      }).not.toThrow();
    });

    it('追踪服务应该正常工作', () => {
      expect(() => {
        tracing.onModuleInit();
        tracing.startSpan('test-span');
        tracing.addAttribute('test.key', 'test.value');
        tracing.addAttributes({ attr1: 'value1', attr2: 42 });
        tracing.addEvent('test.event');
        tracing.setStatus('OK' as any);
        tracing.getCurrentTraceId();
        tracing.getCurrentSpanId();
      }).not.toThrow();
    });

    it('追踪服务withSpan应该正常工作', async () => {
      const result = await tracing.withSpan('test-operation', async (span) => {
        span.setAttribute('test.attr', 'value');
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('追踪服务withSpanSync应该正常工作', () => {
      const result = tracing.withSpanSync('test-operation', (span) => {
        span.setAttribute('test.attr', 'value');
        return 'sync-success';
      });

      expect(result).toBe('sync-success');
    });
  });

  describe('错误处理', () => {
    it('应该处理指标禁用的情况', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        metrics: { enabled: false },
      };

      const metrics = new MetricsService(config);

      expect(() => {
        metrics.onModuleInit();
        metrics.incrementHttpRequests('GET', '/api', 200);
        metrics.recordHttpRequestDuration(100, 'GET', '/api', 200);
        metrics.setActiveConnections(5);
        metrics.incrementErrors('TestError');
        metrics.recordBusinessEvent('test_event');
      }).not.toThrow();
    });

    it('应该处理追踪禁用的情况', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        tracing: { enabled: false },
      };

      const tracing = new TracingService(config);

      expect(() => {
        tracing.onModuleInit();
        tracing.startSpan('test-span');
        tracing.addAttribute('test.key', 'value');
        tracing.addAttributes({ attr: 'value' });
        tracing.addEvent('test.event');
        tracing.recordException(new Error('test'));
        tracing.setStatus('OK' as any);
        tracing.getCurrentTraceId();
        tracing.getCurrentSpanId();
      }).not.toThrow();
    });

    it('应该处理withSpan中的错误', async () => {
      const tracing = new TracingService(DEFAULT_OPENTELEMETRY_CONFIG);

      await expect(
        tracing.withSpan('error-span', async () => {
          throw new Error('测试错误');
        }),
      ).rejects.toThrow('测试错误');
    });

    it('应该处理withSpanSync中的错误', () => {
      const tracing = new TracingService(DEFAULT_OPENTELEMETRY_CONFIG);

      expect(() =>
        tracing.withSpanSync('error-span', () => {
          throw new Error('同步错误');
        }),
      ).toThrow('同步错误');
    });
  });

  describe('配置边界情况', () => {
    it('应该处理最小配置', () => {
      const minConfig = { serviceName: 'minimal-service' };

      expect(() => {
        new EnhancedWinstonLoggerService(minConfig as any);
        new MetricsService(minConfig as any);
        new TracingService(minConfig as any);
      }).not.toThrow();
    });

    it('应该处理undefined配置项', () => {
      const config = {
        serviceName: 'test-service',
        serviceVersion: undefined,
        environment: undefined,
        logging: undefined,
        tracing: undefined,
        metrics: undefined,
      };

      expect(() => {
        new EnhancedWinstonLoggerService(config as any);
        new MetricsService(config as any);
        new TracingService(config as any);
      }).not.toThrow();
    });
  });

  describe('专用span方法', () => {
    let tracing: TracingService;

    beforeEach(() => {
      tracing = new TracingService(DEFAULT_OPENTELEMETRY_CONFIG);
    });

    it('应该创建HTTP span', () => {
      expect(() => {
        tracing.startHttpSpan('GET', 'https://api.example.com/users');
        tracing.startHttpSpan('POST', 'http://localhost:3000/api');
      }).not.toThrow();
    });

    it('应该创建数据库span', () => {
      expect(() => {
        tracing.startDbSpan('SELECT', 'users');
        tracing.startDbSpan('INSERT', 'orders', {
          query: 'INSERT INTO orders (id) VALUES (?)',
          attributes: { 'db.system': 'postgresql' },
        });
      }).not.toThrow();
    });

    it('应该创建业务span', () => {
      expect(() => {
        tracing.startBusinessSpan('calculate-discount');
        tracing.startBusinessSpan('validate-input', { 'user.id': '123' });
      }).not.toThrow();
    });
  });

  describe('指标操作', () => {
    let metrics: MetricsService;

    beforeEach(() => {
      metrics = new MetricsService(DEFAULT_OPENTELEMETRY_CONFIG);
      metrics.onModuleInit();
    });

    it('应该创建和使用自定义指标', () => {
      expect(() => {
        metrics.createCounter('custom_counter', '自定义计数器');
        metrics.createHistogram('custom_histogram', '自定义直方图');
        metrics.createGauge('custom_gauge', '自定义仪表盘');

        metrics.incrementCounter('custom_counter', 1, { type: 'test' });
        metrics.recordHistogram('custom_histogram', 100, { operation: 'query' });
        metrics.setGauge('custom_gauge', 50, { region: 'us-east' });
      }).not.toThrow();
    });

    it('应该处理不存在的指标', () => {
      expect(() => {
        metrics.incrementCounter('nonexistent_counter', 1);
        metrics.recordHistogram('nonexistent_histogram', 100);
        metrics.setGauge('nonexistent_gauge', 50);
      }).not.toThrow();
    });
  });

  describe('环境变量解析', () => {
    beforeEach(() => {
      // 清理所有相关环境变量
      const envVars = [
        'OTEL_SERVICE_NAME',
        'OTEL_SERVICE_VERSION',
        'NODE_ENV',
        'ENVIRONMENT',
        'OTEL_EXPORTER_OTLP_ENDPOINT',
        'OTEL_EXPORTER_JAEGER_ENDPOINT',
        'OTEL_EXPORTER_PROMETHEUS_ENDPOINT',
        'OTEL_LOG_CONSOLE',
        'OTEL_LOG_FILE',
        'OTEL_LOG_DIR',
        'OTEL_LOG_LEVEL',
        'OTEL_LOG_MAX_SIZE',
        'OTEL_LOG_MAX_FILES',
        'OTEL_LOG_DATE_PATTERN',
        'OTEL_TRACING_ENABLED',
        'OTEL_TRACING_SAMPLE_RATE',
        'OTEL_METRICS_ENABLED',
        'OTEL_METRICS_INTERVAL',
        'npm_package_name',
        'npm_package_version',
      ];

      envVars.forEach((envVar) => {
        delete process.env[envVar];
      });
    });

    it('应该使用默认值当环境变量不存在时', () => {
      const config = createOpenTelemetryConfigFromEnv();

      expect(config.serviceName).toBe('unknown-service');
      expect(config.serviceVersion).toBe('1.0.0');
      expect(config.environment).toBe('development');
    });

    it('应该正确解析布尔值环境变量', () => {
      process.env.OTEL_LOG_CONSOLE = 'false';
      process.env.OTEL_TRACING_ENABLED = 'false';
      process.env.OTEL_METRICS_ENABLED = 'false';

      const config = createOpenTelemetryConfigFromEnv();

      expect(config.logging?.console).toBe(false);
      expect(config.tracing?.enabled).toBe(false);
      expect(config.metrics?.enabled).toBe(false);
    });

    it('应该正确解析数值环境变量', () => {
      process.env.OTEL_TRACING_SAMPLE_RATE = '0.5';
      process.env.OTEL_METRICS_INTERVAL = '60000';

      const config = createOpenTelemetryConfigFromEnv();

      expect(config.tracing?.sampleRate).toBe(0.5);
      expect(config.metrics?.interval).toBe(60000);
    });
  });

  describe('类型安全性', () => {
    it('应该有正确的TypeScript类型', () => {
      // 这些应该编译通过，表明类型定义正确
      const config = DEFAULT_OPENTELEMETRY_CONFIG;
      const logger = new EnhancedWinstonLoggerService(config);
      const metrics = new MetricsService(config);
      const tracing = new TracingService(config);

      expect(config.serviceName).toBeTypeOf('string');
      expect(logger).toBeInstanceOf(EnhancedWinstonLoggerService);
      expect(metrics).toBeInstanceOf(MetricsService);
      expect(tracing).toBeInstanceOf(TracingService);
    });
  });
});
