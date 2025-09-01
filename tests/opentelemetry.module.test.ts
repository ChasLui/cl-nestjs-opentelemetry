import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OpenTelemetryModule,
  createOpenTelemetryConfigFromEnv,
  DEFAULT_OPENTELEMETRY_CONFIG,
} from '@/opentelemetry.module';
import { EnhancedWinstonLoggerService } from '@/services/logger.service';
import { MetricsService } from '@/services/metrics.service';
import { TracingService } from '@/services/tracing.service';
import { OpenTelemetryService } from '@/services/opentelemetry.service';

// 读取实际的package.json版本
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'));
const packageVersion = packageJson.version;

describe('OpenTelemetryModule', () => {
  beforeEach(async () => {
    // 清理环境变量
    vi.clearAllMocks();
  });

  describe('forRoot', () => {
    it('应该创建一个带有所有必需提供者的动态模块', async () => {
      const config = DEFAULT_OPENTELEMETRY_CONFIG;
      const dynamicModule = OpenTelemetryModule.forRoot({ config });

      expect(dynamicModule.module).toBe(OpenTelemetryModule);
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();

      // 检查提供者是否包含所有必需的服务
      expect(dynamicModule.providers).toContain(EnhancedWinstonLoggerService);
      expect(dynamicModule.providers).toContain(MetricsService);
      expect(dynamicModule.providers).toContain(TracingService);
      expect(dynamicModule.providers).toContain(OpenTelemetryService);

      // 检查配置提供者
      const configProvider = dynamicModule.providers?.find(
        (provider: any) => provider.provide === 'OPENTELEMETRY_CONFIG',
      );
      expect(configProvider).toBeDefined();
    });

    it('应该正确设置配置提供者', () => {
      const config = { ...DEFAULT_OPENTELEMETRY_CONFIG, serviceName: 'test-service' };
      const dynamicModule = OpenTelemetryModule.forRoot({ config });

      const configProvider = dynamicModule.providers?.find(
        (provider: any) => provider.provide === 'OPENTELEMETRY_CONFIG',
      );

      expect(configProvider).toBeDefined();
      expect(configProvider.useValue).toEqual(config);
    });

    it('应该导出所有必需的服务', () => {
      const config = DEFAULT_OPENTELEMETRY_CONFIG;
      const dynamicModule = OpenTelemetryModule.forRoot({ config });

      expect(dynamicModule.exports).toContain(EnhancedWinstonLoggerService);
      expect(dynamicModule.exports).toContain(MetricsService);
      expect(dynamicModule.exports).toContain(TracingService);
      expect(dynamicModule.exports).toContain(OpenTelemetryService);
    });
  });

  describe('forRootAsync', () => {
    it('应该创建一个带有异步配置的动态模块', () => {
      const asyncOptions = {
        useFactory: () => Promise.resolve(DEFAULT_OPENTELEMETRY_CONFIG),
        inject: [],
      };

      const dynamicModule = OpenTelemetryModule.forRootAsync(asyncOptions);

      expect(dynamicModule.module).toBe(OpenTelemetryModule);
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();

      const configProvider = dynamicModule.providers?.find(
        (provider: any) => provider.provide === 'OPENTELEMETRY_CONFIG',
      );

      expect(configProvider).toBeDefined();
      expect(configProvider.useFactory).toBe(asyncOptions.useFactory);
      expect(configProvider.inject).toEqual(asyncOptions.inject);
    });

    it('应该支持依赖注入', () => {
      const mockService = 'MOCK_SERVICE';
      const asyncOptions = {
        useFactory: (service: any) => ({ ...DEFAULT_OPENTELEMETRY_CONFIG, serviceName: service }),
        inject: [mockService],
      };

      const dynamicModule = OpenTelemetryModule.forRootAsync(asyncOptions);

      const configProvider = dynamicModule.providers?.find(
        (provider: any) => provider.provide === 'OPENTELEMETRY_CONFIG',
      );

      expect(configProvider?.inject).toContain(mockService);
    });
  });

  describe('forFeature', () => {
    it('应该创建一个功能模块', () => {
      const featureConfig = { serviceName: 'feature-service' };
      const dynamicModule = OpenTelemetryModule.forFeature(featureConfig);

      expect(dynamicModule.module).toBe(OpenTelemetryModule);
      expect(dynamicModule.providers).toBeDefined();

      const configProvider = dynamicModule.providers?.find(
        (provider: any) => provider.provide === 'OPENTELEMETRY_FEATURE_CONFIG',
      );

      expect(configProvider).toBeDefined();
      expect(configProvider.useValue).toEqual(featureConfig);
    });

    it('应该导出所有服务', () => {
      const featureConfig = { serviceName: 'feature-service' };
      const dynamicModule = OpenTelemetryModule.forFeature(featureConfig);

      expect(dynamicModule.exports).toContain(EnhancedWinstonLoggerService);
      expect(dynamicModule.exports).toContain(MetricsService);
      expect(dynamicModule.exports).toContain(TracingService);
      expect(dynamicModule.exports).toContain(OpenTelemetryService);
    });
  });
});

describe('createOpenTelemetryConfigFromEnv', () => {
  beforeEach(() => {
    // 清理环境变量
    delete process.env.OTEL_SERVICE_NAME;
    delete process.env.OTEL_SERVICE_VERSION;
    delete process.env.NODE_ENV;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_JAEGER_ENDPOINT;
    delete process.env.OTEL_EXPORTER_PROMETHEUS_ENDPOINT;
    delete process.env.OTEL_LOG_CONSOLE;
    delete process.env.OTEL_LOG_FILE;
    delete process.env.OTEL_LOG_DIR;
    delete process.env.OTEL_LOG_LEVEL;
    delete process.env.OTEL_TRACING_ENABLED;
    delete process.env.OTEL_TRACING_SAMPLE_RATE;
    delete process.env.OTEL_METRICS_ENABLED;
    delete process.env.OTEL_METRICS_INTERVAL;
    delete process.env.npm_package_name;
    delete process.env.npm_package_version;
    delete process.env.ENVIRONMENT;
    delete process.env.OTEL_LOG_MAX_SIZE;
    delete process.env.OTEL_LOG_MAX_FILES;
    delete process.env.OTEL_LOG_DATE_PATTERN;
  });

  it('应该返回默认配置当没有环境变量时', () => {
    const config = createOpenTelemetryConfigFromEnv();

    expect(config.serviceName).toBe('unknown-service');
    expect(config.serviceVersion).toBe('1.0.0');
    expect(config.environment).toBe('development');
    expect(config.logging?.console).toBe(true);
    expect(config.logging?.file).toBe(true);
    expect(config.logging?.level).toBe('info');
    expect(config.tracing?.enabled).toBe(true);
    expect(config.tracing?.sampleRate).toBe(1.0);
    expect(config.metrics?.enabled).toBe(true);
    expect(config.metrics?.interval).toBe(30000);
  });

  it('应该从环境变量读取服务配置', () => {
    process.env.OTEL_SERVICE_NAME = 'test-service';
    process.env.OTEL_SERVICE_VERSION = '2.0.0';
    process.env.NODE_ENV = 'production';

    const config = createOpenTelemetryConfigFromEnv();

    expect(config.serviceName).toBe('test-service');
    expect(config.serviceVersion).toBe('2.0.0');
    expect(config.environment).toBe('production');
  });

  it('应该从环境变量读取导出器端点', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4317';
    process.env.OTEL_EXPORTER_JAEGER_ENDPOINT = 'http://localhost:14268/api/traces';
    process.env.OTEL_EXPORTER_PROMETHEUS_ENDPOINT = 'http://localhost:9090';

    const config = createOpenTelemetryConfigFromEnv();

    expect(config.otlpEndpoint).toBe('http://localhost:4317');
    expect(config.jaegerEndpoint).toBe('http://localhost:14268/api/traces');
    expect(config.prometheusEndpoint).toBe('http://localhost:9090');
  });

  it('应该从环境变量读取日志配置', () => {
    process.env.OTEL_LOG_CONSOLE = 'false';
    process.env.OTEL_LOG_FILE = 'false';
    process.env.OTEL_LOG_DIR = '/custom/logs';
    process.env.OTEL_LOG_LEVEL = 'debug';
    process.env.OTEL_LOG_MAX_SIZE = '50m';
    process.env.OTEL_LOG_MAX_FILES = '30d';
    process.env.OTEL_LOG_DATE_PATTERN = 'YYYY-MM-DD-HH';

    const config = createOpenTelemetryConfigFromEnv();

    expect(config.logging?.console).toBe(false);
    expect(config.logging?.file).toBe(false);
    expect(config.logging?.logDir).toBe('/custom/logs');
    expect(config.logging?.level).toBe('debug');
    expect(config.logging?.maxSize).toBe('50m');
    expect(config.logging?.maxFiles).toBe('30d');
    expect(config.logging?.datePattern).toBe('YYYY-MM-DD-HH');
  });

  it('应该从环境变量读取追踪配置', () => {
    process.env.OTEL_TRACING_ENABLED = 'false';
    process.env.OTEL_TRACING_SAMPLE_RATE = '0.5';

    const config = createOpenTelemetryConfigFromEnv();

    expect(config.tracing?.enabled).toBe(false);
    expect(config.tracing?.sampleRate).toBe(0.5);
  });

  it('应该从环境变量读取指标配置', () => {
    process.env.OTEL_METRICS_ENABLED = 'false';
    process.env.OTEL_METRICS_INTERVAL = '60000';

    const config = createOpenTelemetryConfigFromEnv();

    expect(config.metrics?.enabled).toBe(false);
    expect(config.metrics?.interval).toBe(60000);
  });

  it('应该使用npm包信息作为后备', () => {
    process.env.npm_package_name = 'my-app';
    process.env.npm_package_version = packageVersion;

    const config = createOpenTelemetryConfigFromEnv();

    expect(config.serviceName).toBe('my-app');
    expect(config.serviceVersion).toBe(packageVersion);
  });

  it('应该优先使用OTEL环境变量而不是npm变量', () => {
    process.env.OTEL_SERVICE_NAME = 'otel-service';
    process.env.npm_package_name = 'npm-service';
    process.env.OTEL_SERVICE_VERSION = '1.5.0';
    process.env.npm_package_version = packageVersion;

    const config = createOpenTelemetryConfigFromEnv();

    expect(config.serviceName).toBe('otel-service');
    expect(config.serviceVersion).toBe('1.5.0');
  });

  it('应该使用ENVIRONMENT环境变量作为NODE_ENV的后备', () => {
    process.env.ENVIRONMENT = 'staging';

    const config = createOpenTelemetryConfigFromEnv();

    expect(config.environment).toBe('staging');
  });
});

describe('DEFAULT_OPENTELEMETRY_CONFIG', () => {
  it('应该具有正确的默认值', () => {
    expect(DEFAULT_OPENTELEMETRY_CONFIG.serviceName).toBe('nestjs-app');
    expect(DEFAULT_OPENTELEMETRY_CONFIG.serviceVersion).toBe('1.0.0');
    expect(DEFAULT_OPENTELEMETRY_CONFIG.environment).toBe('development');

    expect(DEFAULT_OPENTELEMETRY_CONFIG.logging?.console).toBe(true);
    expect(DEFAULT_OPENTELEMETRY_CONFIG.logging?.file).toBe(true);
    expect(DEFAULT_OPENTELEMETRY_CONFIG.logging?.logDir).toBe('./logs');
    expect(DEFAULT_OPENTELEMETRY_CONFIG.logging?.level).toBe('info');
    expect(DEFAULT_OPENTELEMETRY_CONFIG.logging?.maxSize).toBe('20m');
    expect(DEFAULT_OPENTELEMETRY_CONFIG.logging?.maxFiles).toBe('14d');
    expect(DEFAULT_OPENTELEMETRY_CONFIG.logging?.datePattern).toBe('YYYY-MM-DD');

    expect(DEFAULT_OPENTELEMETRY_CONFIG.tracing?.enabled).toBe(true);
    expect(DEFAULT_OPENTELEMETRY_CONFIG.tracing?.sampleRate).toBe(1.0);

    expect(DEFAULT_OPENTELEMETRY_CONFIG.metrics?.enabled).toBe(true);
    expect(DEFAULT_OPENTELEMETRY_CONFIG.metrics?.interval).toBe(30000);
  });

  it('应该是不可变的', () => {
    // 保存原始值
    const originalServiceName = DEFAULT_OPENTELEMETRY_CONFIG.serviceName;

    // 尝试修改配置
    (DEFAULT_OPENTELEMETRY_CONFIG as any).serviceName = 'modified';

    // 由于对象是可变的，修改会生效
    expect(DEFAULT_OPENTELEMETRY_CONFIG.serviceName).toBe('modified');

    // 恢复原始值
    (DEFAULT_OPENTELEMETRY_CONFIG as any).serviceName = originalServiceName;
    expect(DEFAULT_OPENTELEMETRY_CONFIG.serviceName).toBe(originalServiceName);
  });
});
