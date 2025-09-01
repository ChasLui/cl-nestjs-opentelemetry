import { describe, it, expect } from 'vitest';
import type {
  OpenTelemetryConfig,
  OpenTelemetryModuleOptions,
  OpenTelemetryModuleAsyncOptions,
} from '@/interfaces/opentelemetry-config.interface';

describe('OpenTelemetryConfig Interface', () => {
  it('应该接受最小配置', () => {
    const config: OpenTelemetryConfig = {
      serviceName: 'test-service',
    };

    expect(config.serviceName).toBe('test-service');
  });

  it('应该接受完整配置', () => {
    const config: OpenTelemetryConfig = {
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'production',
      otlpEndpoint: 'http://localhost:4317',
      jaegerEndpoint: 'http://localhost:14268/api/traces',
      prometheusEndpoint: 'http://localhost:9090',
      logging: {
        console: true,
        file: true,
        logDir: '/var/logs',
        level: 'info',
        maxSize: '10m',
        maxFiles: '5',
        datePattern: 'YYYY-MM-DD',
      },
      tracing: {
        enabled: true,
        sampleRate: 0.1,
      },
      metrics: {
        enabled: true,
        interval: 5000,
      },
    };

    expect(config.serviceName).toBe('test-service');
    expect(config.serviceVersion).toBe('1.0.0');
    expect(config.environment).toBe('production');
    expect(config.otlpEndpoint).toBe('http://localhost:4317');
    expect(config.jaegerEndpoint).toBe('http://localhost:14268/api/traces');
    expect(config.prometheusEndpoint).toBe('http://localhost:9090');
    expect(config.logging?.console).toBe(true);
    expect(config.logging?.file).toBe(true);
    expect(config.logging?.logDir).toBe('/var/logs');
    expect(config.logging?.level).toBe('info');
    expect(config.logging?.maxSize).toBe('10m');
    expect(config.logging?.maxFiles).toBe('5');
    expect(config.logging?.datePattern).toBe('YYYY-MM-DD');
    expect(config.tracing?.enabled).toBe(true);
    expect(config.tracing?.sampleRate).toBe(0.1);
    expect(config.metrics?.enabled).toBe(true);
    expect(config.metrics?.interval).toBe(5000);
  });

  it('应该接受部分日志配置', () => {
    const config: OpenTelemetryConfig = {
      serviceName: 'test-service',
      logging: {
        console: true,
        level: 'debug',
      },
    };

    expect(config.logging?.console).toBe(true);
    expect(config.logging?.level).toBe('debug');
    expect(config.logging?.file).toBeUndefined();
  });

  it('应该接受部分追踪配置', () => {
    const config: OpenTelemetryConfig = {
      serviceName: 'test-service',
      tracing: {
        enabled: true,
      },
    };

    expect(config.tracing?.enabled).toBe(true);
    expect(config.tracing?.sampleRate).toBeUndefined();
  });

  it('应该接受部分指标配置', () => {
    const config: OpenTelemetryConfig = {
      serviceName: 'test-service',
      metrics: {
        enabled: true,
      },
    };

    expect(config.metrics?.enabled).toBe(true);
    expect(config.metrics?.interval).toBeUndefined();
  });

  it('应该验证日志级别类型', () => {
    const validLevels: Array<OpenTelemetryConfig['logging']> = [
      { level: 'error' },
      { level: 'warn' },
      { level: 'info' },
      { level: 'debug' },
      { level: 'verbose' },
    ];

    validLevels.forEach((logging, index) => {
      const config: OpenTelemetryConfig = {
        serviceName: 'test-service',
        logging,
      };
      expect(config.logging?.level).toBe(validLevels[index]?.level);
    });
  });

  it('应该验证采样率范围', () => {
    const validSampleRates = [0.0, 0.1, 0.5, 1.0];

    validSampleRates.forEach((sampleRate) => {
      const config: OpenTelemetryConfig = {
        serviceName: 'test-service',
        tracing: {
          sampleRate,
        },
      };
      expect(config.tracing?.sampleRate).toBe(sampleRate);
    });
  });

  it('应该验证指标间隔时间', () => {
    const validIntervals = [1000, 5000, 10000, 30000];

    validIntervals.forEach((interval) => {
      const config: OpenTelemetryConfig = {
        serviceName: 'test-service',
        metrics: {
          interval,
        },
      };
      expect(config.metrics?.interval).toBe(interval);
    });
  });
});

describe('OpenTelemetryModuleOptions Interface', () => {
  it('应该接受配置对象', () => {
    const options: OpenTelemetryModuleOptions = {
      config: {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        environment: 'development',
      },
    };

    expect(options.config.serviceName).toBe('test-service');
    expect(options.config.serviceVersion).toBe('1.0.0');
    expect(options.config.environment).toBe('development');
  });

  it('应该接受最小配置', () => {
    const options: OpenTelemetryModuleOptions = {
      config: {
        serviceName: 'test-service',
      },
    };

    expect(options.config.serviceName).toBe('test-service');
  });
});

describe('OpenTelemetryModuleAsyncOptions Interface', () => {
  it('应该接受异步工厂函数', () => {
    const options: OpenTelemetryModuleAsyncOptions = {
      useFactory: async () => ({
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
      }),
    };

    expect(typeof options.useFactory).toBe('function');
  });

  it('应该接受同步工厂函数', () => {
    const options: OpenTelemetryModuleAsyncOptions = {
      useFactory: () => ({
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
      }),
    };

    expect(typeof options.useFactory).toBe('function');
  });

  it('应该接受带依赖注入的配置', () => {
    const options: OpenTelemetryModuleAsyncOptions = {
      useFactory: (configService: any) => ({
        serviceName: configService.get('SERVICE_NAME'),
        environment: configService.get('NODE_ENV'),
      }),
      inject: ['ConfigService'],
    };

    expect(typeof options.useFactory).toBe('function');
    expect(options.inject).toEqual(['ConfigService']);
  });

  it('应该接受没有依赖注入的配置', () => {
    const options: OpenTelemetryModuleAsyncOptions = {
      useFactory: () => ({
        serviceName: 'test-service',
      }),
    };

    expect(typeof options.useFactory).toBe('function');
    expect(options.inject).toBeUndefined();
  });

  it('应该验证工厂函数返回类型', async () => {
    const options: OpenTelemetryModuleAsyncOptions = {
      useFactory: async () => ({
        serviceName: 'test-service',
        logging: {
          console: true,
          level: 'info',
        },
        tracing: {
          enabled: true,
          sampleRate: 0.1,
        },
        metrics: {
          enabled: true,
          interval: 5000,
        },
      }),
    };

    const result = await options.useFactory();
    expect(result.serviceName).toBe('test-service');
    expect(result.logging?.console).toBe(true);
    expect(result.logging?.level).toBe('info');
    expect(result.tracing?.enabled).toBe(true);
    expect(result.tracing?.sampleRate).toBe(0.1);
    expect(result.metrics?.enabled).toBe(true);
    expect(result.metrics?.interval).toBe(5000);
  });
});

describe('Interface Integration Tests', () => {
  it('应该支持配置对象的组合使用', () => {
    const baseConfig: OpenTelemetryConfig = {
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
    };

    const extendedConfig: OpenTelemetryConfig = {
      ...baseConfig,
      environment: 'production',
      logging: {
        console: true,
        level: 'warn',
      },
    };

    const moduleOptions: OpenTelemetryModuleOptions = {
      config: extendedConfig,
    };

    expect(moduleOptions.config.serviceName).toBe('test-service');
    expect(moduleOptions.config.serviceVersion).toBe('1.0.0');
    expect(moduleOptions.config.environment).toBe('production');
    expect(moduleOptions.config.logging?.console).toBe(true);
    expect(moduleOptions.config.logging?.level).toBe('warn');
  });

  it('应该支持异步配置的动态生成', async () => {
    const asyncOptions: OpenTelemetryModuleAsyncOptions = {
      useFactory: async () => {
        const env = process.env.NODE_ENV || 'development';
        return {
          serviceName: 'test-service',
          environment: env,
          logging: {
            console: env === 'development',
            level: env === 'production' ? 'warn' : 'debug',
          },
        };
      },
    };

    const result = await asyncOptions.useFactory();
    expect(result.serviceName).toBe('test-service');
    expect(result.logging?.console).toBeDefined();
    expect(result.logging?.level).toBeDefined();
  });

  it('应该支持配置验证', () => {
    const validateConfig = (config: OpenTelemetryConfig): boolean => {
      if (!config.serviceName) {
        return false;
      }
      if (config.tracing?.sampleRate !== undefined) {
        if (config.tracing.sampleRate < 0 || config.tracing.sampleRate > 1) {
          return false;
        }
      }
      if (config.metrics?.interval !== undefined) {
        if (config.metrics.interval <= 0) {
          return false;
        }
      }
      return true;
    };

    const validConfig: OpenTelemetryConfig = {
      serviceName: 'test-service',
      tracing: { sampleRate: 0.5 },
      metrics: { interval: 5000 },
    };

    const invalidConfig: OpenTelemetryConfig = {
      serviceName: 'test-service',
      tracing: { sampleRate: 1.5 }, // 超出范围
      metrics: { interval: -1000 }, // 负数
    };

    expect(validateConfig(validConfig)).toBe(true);
    expect(validateConfig(invalidConfig)).toBe(false);
  });
});
