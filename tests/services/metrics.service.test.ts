import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { metrics } from '@opentelemetry/api';
import { MetricsService } from '@/services/metrics.service';
import { DEFAULT_OPENTELEMETRY_CONFIG } from '@/opentelemetry.module';

// Mock OpenTelemetry metrics
const mockMeter = {
  createCounter: vi.fn(),
  createHistogram: vi.fn(),
  createGauge: vi.fn(),
};

const mockCounter = {
  add: vi.fn(),
};

const mockHistogram = {
  record: vi.fn(),
};

const mockGauge = {
  record: vi.fn(),
};

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: vi.fn(),
  },
  ValueType: {
    DOUBLE: 'DOUBLE',
  },
}));

describe('MetricsService', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup metrics mock
    (metrics.getMeter as MockedFunction<typeof metrics.getMeter>).mockReturnValue(mockMeter as any);
    mockMeter.createCounter.mockReturnValue(mockCounter);
    mockMeter.createHistogram.mockReturnValue(mockHistogram);
    mockMeter.createGauge.mockReturnValue(mockGauge);

    metricsService = new MetricsService(DEFAULT_OPENTELEMETRY_CONFIG);
  });

  describe('构造函数', () => {
    it('应该在指标启用时创建测量器', () => {
      expect(metrics.getMeter).toHaveBeenCalledWith(
        DEFAULT_OPENTELEMETRY_CONFIG.serviceName,
        DEFAULT_OPENTELEMETRY_CONFIG.serviceVersion,
      );
    });

    it('应该在指标禁用时不创建测量器', () => {
      vi.clearAllMocks();
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        metrics: { enabled: false },
      };

      new MetricsService(config);

      expect(metrics.getMeter).not.toHaveBeenCalled();
    });

    it('应该使用默认版本当未提供时', () => {
      vi.clearAllMocks();
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        serviceVersion: undefined,
      };

      new MetricsService(config);

      expect(metrics.getMeter).toHaveBeenCalledWith(config.serviceName, '1.0.0');
    });
  });

  describe('onModuleInit', () => {
    it('应该初始化通用指标', () => {
      metricsService.onModuleInit();

      expect(mockMeter.createCounter).toHaveBeenCalledWith('http_requests_total', {
        description: 'HTTP 请求总数',
        unit: '1',
      });

      expect(mockMeter.createHistogram).toHaveBeenCalledWith('http_request_duration_seconds', {
        description: 'HTTP 请求持续时间（秒）',
        unit: 's',
      });

      expect(mockMeter.createGauge).toHaveBeenCalledWith('active_connections', {
        description: '活跃连接数',
        unit: '1',
      });

      expect(mockMeter.createCounter).toHaveBeenCalledWith('errors_total', {
        description: '错误总数',
        unit: '1',
      });

      expect(mockMeter.createCounter).toHaveBeenCalledWith('business_events_total', {
        description: '业务事件总数',
        unit: '1',
      });
    });

    it('应该在没有测量器时直接返回', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        metrics: { enabled: false },
      };
      const service = new MetricsService(config);

      expect(() => service.onModuleInit()).not.toThrow();
    });
  });

  describe('createCounter', () => {
    beforeEach(() => {
      metricsService.onModuleInit();
    });

    it('应该创建新的计数器', () => {
      const name = 'custom_counter';
      const description = '自定义计数器';
      const unit = 'requests';

      const counter = metricsService.createCounter(name, description, unit);

      expect(mockMeter.createCounter).toHaveBeenCalledWith(name, {
        description,
        unit,
      });
      expect(counter).toBe(mockCounter);
    });

    it('应该返回现有的计数器', () => {
      const name = 'existing_counter';

      // 第一次创建
      const counter1 = metricsService.createCounter(name);
      // 第二次获取
      const counter2 = metricsService.createCounter(name);

      expect(counter1).toBe(counter2);
      // onModuleInit 创建了 3 个计数器，这里又创建了 1 个，总共 4 次调用
      expect(mockMeter.createCounter).toHaveBeenCalledTimes(4);
    });

    it('应该使用默认描述和单位', () => {
      const name = 'default_counter';

      metricsService.createCounter(name);

      expect(mockMeter.createCounter).toHaveBeenCalledWith(name, {
        description: `${name} 的计数器`,
        unit: '1',
      });
    });

    it('应该在没有测量器时抛出错误', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        metrics: { enabled: false },
      };
      const service = new MetricsService(config);

      expect(() => service.createCounter('test')).toThrow('指标已禁用或测量器未初始化');
    });
  });

  describe('createHistogram', () => {
    beforeEach(() => {
      metricsService.onModuleInit();
    });

    it('应该创建新的直方图', () => {
      const name = 'custom_histogram';
      const description = '自定义直方图';
      const unit = 'seconds';

      const histogram = metricsService.createHistogram(name, description, unit);

      expect(mockMeter.createHistogram).toHaveBeenCalledWith(name, {
        description,
        unit,
      });
      expect(histogram).toBe(mockHistogram);
    });

    it('应该返回现有的直方图', () => {
      const name = 'existing_histogram';

      const histogram1 = metricsService.createHistogram(name);
      const histogram2 = metricsService.createHistogram(name);

      expect(histogram1).toBe(histogram2);
    });

    it('应该在没有测量器时抛出错误', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        metrics: { enabled: false },
      };
      const service = new MetricsService(config);

      expect(() => service.createHistogram('test')).toThrow('指标已禁用或测量器未初始化');
    });
  });

  describe('createGauge', () => {
    beforeEach(() => {
      metricsService.onModuleInit();
    });

    it('应该创建新的仪表盘', () => {
      const name = 'custom_gauge';
      const description = '自定义仪表盘';
      const unit = 'bytes';

      const gauge = metricsService.createGauge(name, description, unit);

      expect(mockMeter.createGauge).toHaveBeenCalledWith(name, {
        description,
        unit,
        valueType: 'DOUBLE',
      });
      expect(gauge).toBe(mockGauge);
    });

    it('应该返回现有的仪表盘', () => {
      const name = 'existing_gauge';

      const gauge1 = metricsService.createGauge(name);
      const gauge2 = metricsService.createGauge(name);

      expect(gauge1).toBe(gauge2);
    });

    it('应该在没有测量器时抛出错误', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        metrics: { enabled: false },
      };
      const service = new MetricsService(config);

      expect(() => service.createGauge('test')).toThrow('指标已禁用或测量器未初始化');
    });
  });

  describe('HTTP指标方法', () => {
    beforeEach(() => {
      metricsService.onModuleInit();
    });

    describe('incrementHttpRequests', () => {
      it('应该增加HTTP请求计数', () => {
        const method = 'GET';
        const route = '/api/users';
        const statusCode = 200;

        metricsService.incrementHttpRequests(method, route, statusCode);

        expect(mockCounter.add).toHaveBeenCalledWith(1, {
          method,
          route,
          status_code: '200',
        });
      });
    });

    describe('recordHttpRequestDuration', () => {
      it('应该记录HTTP请求持续时间', () => {
        const duration = 1500; // 毫秒
        const method = 'POST';
        const route = '/api/login';
        const statusCode = 201;

        metricsService.recordHttpRequestDuration(duration, method, route, statusCode);

        expect(mockHistogram.record).toHaveBeenCalledWith(1.5, {
          // 转换为秒
          method,
          route,
          status_code: '201',
        });
      });
    });
  });

  describe('通用指标方法', () => {
    beforeEach(() => {
      metricsService.onModuleInit();
    });

    describe('setActiveConnections', () => {
      it('应该设置活跃连接数', () => {
        const count = 42;

        metricsService.setActiveConnections(count);

        expect(mockGauge.record).toHaveBeenCalledWith(count);
      });
    });

    describe('incrementErrors', () => {
      it('应该增加错误计数', () => {
        const errorType = 'ValidationError';
        const context = 'UserService';

        metricsService.incrementErrors(errorType, context);

        expect(mockCounter.add).toHaveBeenCalledWith(1, {
          error_type: errorType,
          context,
        });
      });

      it('应该使用默认上下文', () => {
        const errorType = 'DatabaseError';

        metricsService.incrementErrors(errorType);

        expect(mockCounter.add).toHaveBeenCalledWith(1, {
          error_type: errorType,
          context: 'unknown',
        });
      });
    });

    describe('recordBusinessEvent', () => {
      it('应该记录业务事件', () => {
        const eventType = 'user_registration';
        const value = 1;
        const attributes = { source: 'web', plan: 'premium' };

        metricsService.recordBusinessEvent(eventType, value, attributes);

        expect(mockCounter.add).toHaveBeenCalledWith(value, {
          event_type: eventType,
          ...attributes,
        });
      });

      it('应该使用默认值', () => {
        const eventType = 'page_view';

        metricsService.recordBusinessEvent(eventType);

        expect(mockCounter.add).toHaveBeenCalledWith(1, {
          event_type: eventType,
        });
      });
    });
  });

  describe('自定义指标操作', () => {
    beforeEach(() => {
      metricsService.onModuleInit();
      // 创建一个自定义计数器
      metricsService.createCounter('custom_counter');
      metricsService.createHistogram('custom_histogram');
      metricsService.createGauge('custom_gauge');
    });

    describe('incrementCounter', () => {
      it('应该增加现有计数器', () => {
        const name = 'custom_counter';
        const value = 5;
        const attributes = { type: 'test' };

        metricsService.incrementCounter(name, value, attributes);

        expect(mockCounter.add).toHaveBeenCalledWith(value, attributes);
      });

      it('应该在计数器不存在时静默处理', () => {
        const name = 'nonexistent_counter';

        expect(() => metricsService.incrementCounter(name, 1)).not.toThrow();
      });
    });

    describe('recordHistogram', () => {
      it('应该记录直方图值', () => {
        const name = 'custom_histogram';
        const value = 123.45;
        const attributes = { operation: 'query' };

        metricsService.recordHistogram(name, value, attributes);

        expect(mockHistogram.record).toHaveBeenCalledWith(value, attributes);
      });

      it('应该在直方图不存在时静默处理', () => {
        const name = 'nonexistent_histogram';

        expect(() => metricsService.recordHistogram(name, 100)).not.toThrow();
      });
    });

    describe('setGauge', () => {
      it('应该设置仪表盘值', () => {
        const name = 'custom_gauge';
        const value = 78.9;
        const attributes = { region: 'us-east-1' };

        metricsService.setGauge(name, value, attributes);

        expect(mockGauge.record).toHaveBeenCalledWith(value, attributes);
      });

      it('应该在仪表盘不存在时静默处理', () => {
        const name = 'nonexistent_gauge';

        expect(() => metricsService.setGauge(name, 50)).not.toThrow();
      });
    });
  });

  describe('获取器方法', () => {
    beforeEach(() => {
      metricsService.onModuleInit();
    });

    describe('getMeter', () => {
      it('应该返回测量器实例', () => {
        const meter = metricsService.getMeter();
        expect(meter).toBe(mockMeter);
      });
    });

    describe('getCounters', () => {
      it('应该返回计数器映射', () => {
        const counters = metricsService.getCounters();
        expect(counters).toBeInstanceOf(Map);
        expect(counters.size).toBeGreaterThan(0);
      });
    });

    describe('getHistograms', () => {
      it('应该返回直方图映射', () => {
        const histograms = metricsService.getHistograms();
        expect(histograms).toBeInstanceOf(Map);
        expect(histograms.size).toBeGreaterThan(0);
      });
    });

    describe('getGauges', () => {
      it('应该返回仪表盘映射', () => {
        const gauges = metricsService.getGauges();
        expect(gauges).toBeInstanceOf(Map);
        expect(gauges.size).toBeGreaterThan(0);
      });
    });
  });

  describe('边界情况', () => {
    it('应该在指标禁用时处理所有方法调用', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        metrics: { enabled: false },
      };
      const service = new MetricsService(config);

      // 这些方法应该不会抛出错误，只是不会执行任何操作
      expect(() => {
        service.onModuleInit();
        service.incrementHttpRequests('GET', '/', 200);
        service.recordHttpRequestDuration(100, 'GET', '/', 200);
        service.setActiveConnections(10);
        service.incrementErrors('TestError');
        service.recordBusinessEvent('test_event');
        service.incrementCounter('test', 1);
        service.recordHistogram('test', 100);
        service.setGauge('test', 50);
      }).not.toThrow();
    });

    it('应该处理undefined值', () => {
      metricsService.onModuleInit();

      expect(() => {
        metricsService.incrementHttpRequests('GET', '/test', 200);
        metricsService.recordHttpRequestDuration(0, 'GET', '/test', 200);
        metricsService.setActiveConnections(0);
        metricsService.incrementErrors('', '');
        metricsService.recordBusinessEvent('', 0);
      }).not.toThrow();
    });

    it('应该处理 null 配置', () => {
      expect(() => {
        new MetricsService(null as any);
      }).toThrow();
    });

    it('应该处理 undefined 配置', () => {
      expect(() => {
        new MetricsService(undefined as any);
      }).toThrow();
    });

    it('应该处理没有 metrics 属性的配置', () => {
      const configWithoutMetrics = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        environment: 'test',
      } as any;

      const service = new MetricsService(configWithoutMetrics);
      const counter = service.createCounter('test-counter', 'Test counter');

      expect(counter).toBe(mockCounter);
      expect(metrics.getMeter).toHaveBeenCalled();
    });

    it('应该处理没有 serviceName 的配置', () => {
      const configWithoutServiceName = {
        serviceVersion: '1.0.0',
        environment: 'test',
        metrics: { enabled: true, interval: 30000 },
      } as any;

      // 这个测试应该不会抛出异常，因为 serviceName 会是 undefined，但 getMeter 仍然可以处理
      const service = new MetricsService(configWithoutServiceName);
      expect(service).toBeDefined();
      expect(metrics.getMeter).toHaveBeenCalledWith(undefined, '1.0.0');
    });

    it('应该处理没有 serviceVersion 的配置', () => {
      const configWithoutVersion = {
        serviceName: 'test-service',
        environment: 'test',
        metrics: { enabled: true, interval: 30000 },
      } as any;

      const service = new MetricsService(configWithoutVersion);
      const counter = service.createCounter('test-counter', 'Test counter');

      expect(counter).toBe(mockCounter);
      expect(metrics.getMeter).toHaveBeenCalledWith('test-service', '1.0.0');
    });

    it('应该处理 getMeter 抛出异常的情况', () => {
      (metrics.getMeter as MockedFunction<typeof metrics.getMeter>).mockImplementation(() => {
        throw new Error('Meter creation failed');
      });

      expect(() => {
        new MetricsService(DEFAULT_OPENTELEMETRY_CONFIG);
      }).toThrow('Meter creation failed');
    });

    it('应该处理 createCounter 抛出异常的情况', () => {
      mockMeter.createCounter.mockImplementation(() => {
        throw new Error('Counter creation failed');
      });

      expect(() => {
        metricsService.createCounter('test-counter', 'Test counter');
      }).toThrow('Counter creation failed');
    });

    it('应该处理 createHistogram 抛出异常的情况', () => {
      mockMeter.createHistogram.mockImplementation(() => {
        throw new Error('Histogram creation failed');
      });

      expect(() => {
        metricsService.createHistogram('test-histogram', 'Test histogram');
      }).toThrow('Histogram creation failed');
    });

    it('应该处理 createGauge 抛出异常的情况', () => {
      mockMeter.createGauge.mockImplementation(() => {
        throw new Error('Gauge creation failed');
      });

      expect(() => {
        metricsService.createGauge('test-gauge', 'Test gauge');
      }).toThrow('Gauge creation failed');
    });

    it('应该处理空字符串指标名称', () => {
      const counter = metricsService.createCounter('', 'Empty name counter');

      expect(mockMeter.createCounter).toHaveBeenCalledWith('', {
        description: 'Empty name counter',
        unit: '1',
      });
      expect(counter).toBe(mockCounter);
    });

    it('应该处理非常长的指标名称', () => {
      const longName = 'a'.repeat(10000);
      const counter = metricsService.createCounter(longName, 'Long name counter');

      expect(mockMeter.createCounter).toHaveBeenCalledWith(longName, {
        description: 'Long name counter',
        unit: '1',
      });
      expect(counter).toBe(mockCounter);
    });

    it('应该处理包含特殊字符的指标名称', () => {
      const specialName = 'metric-with-special-chars!@#$%^&*()[]{}|;:,.<>?/`~+=\\';
      const counter = metricsService.createCounter(specialName, 'Special chars counter');

      expect(mockMeter.createCounter).toHaveBeenCalledWith(specialName, {
        description: 'Special chars counter',
        unit: '1',
      });
      expect(counter).toBe(mockCounter);
    });

    it('应该处理包含 Unicode 字符的指标名称', () => {
      const unicodeName = '测试-metric-🚀-emoji-ñáéíóú';
      const counter = metricsService.createCounter(unicodeName, 'Unicode counter');

      expect(mockMeter.createCounter).toHaveBeenCalledWith(unicodeName, {
        description: 'Unicode counter',
        unit: '1',
      });
      expect(counter).toBe(mockCounter);
    });

    it('应该处理极大的属性对象', () => {
      const largeAttributes: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largeAttributes[`key${i}`] = `value${i}`;
      }

      const counter = metricsService.createCounter('test-counter', 'Test counter');
      counter.add(1, largeAttributes);

      expect(mockCounter.add).toHaveBeenCalledWith(1, largeAttributes);
    });

    it('应该处理循环引用的属性对象', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const counter = metricsService.createCounter('test-counter', 'Test counter');
      counter.add(1, { circular: circularObj });

      expect(mockCounter.add).toHaveBeenCalledWith(1, { circular: circularObj });
    });

    it('应该处理 null 属性值', () => {
      const counter = metricsService.createCounter('test-counter', 'Test counter');
      counter.add(1, {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zero: 0,
        false: false,
      } as any);

      expect(mockCounter.add).toHaveBeenCalledWith(1, {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zero: 0,
        false: false,
      });
    });

    it('应该处理极值数字', () => {
      const counter = metricsService.createCounter('test-counter', 'Test counter');
      const histogram = metricsService.createHistogram('test-histogram', 'Test histogram');

      const extremeValues = [
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NaN,
        0,
        -0,
        3.141592653589793,
        1e-10,
        1e10,
      ];

      extremeValues.forEach((value) => {
        counter.add(value);
        histogram.record(value);
      });

      extremeValues.forEach((value) => {
        expect(mockCounter.add).toHaveBeenCalledWith(value);
        expect(mockHistogram.record).toHaveBeenCalledWith(value);
      });
    });

    it('应该处理计数器 add 方法抛出异常的情况', () => {
      mockCounter.add.mockImplementation(() => {
        throw new Error('Counter add failed');
      });

      const counter = metricsService.createCounter('test-counter', 'Test counter');

      expect(() => {
        counter.add(1);
      }).toThrow('Counter add failed');

      // 重置 mock 以避免影响后续测试
      mockCounter.add.mockReset();
      mockCounter.add.mockImplementation(() => {});
    });

    it('应该处理直方图 record 方法抛出异常的情况', () => {
      mockHistogram.record.mockImplementation(() => {
        throw new Error('Histogram record failed');
      });

      const histogram = metricsService.createHistogram('test-histogram', 'Test histogram');

      expect(() => {
        histogram.record(100);
      }).toThrow('Histogram record failed');

      // 重置 mock 以避免影响后续测试
      mockHistogram.record.mockReset();
      mockHistogram.record.mockImplementation(() => {});
    });

    it('应该处理仪表 record 方法抛出异常的情况', () => {
      mockGauge.record.mockImplementation(() => {
        throw new Error('Gauge record failed');
      });

      const gauge = metricsService.createGauge('test-gauge', 'Test gauge');

      expect(() => {
        gauge.record(50);
      }).toThrow('Gauge record failed');

      // 重置 mock 以避免影响后续测试
      mockGauge.record.mockReset();
      mockGauge.record.mockImplementation(() => {});
    });

    it('应该处理包含特殊字符的属性键和值', () => {
      // 重置 mock 以避免之前测试的影响
      vi.clearAllMocks();
      mockMeter.createCounter.mockReturnValue(mockCounter);

      const counter = metricsService.createCounter('test-counter', 'Test counter');

      const specialAttributes = {
        'key with spaces': 'value with spaces',
        'key\nwith\nnewlines': 'value\nwith\nnewlines',
        'key\twith\ttabs': 'value\twith\ttabs',
        'key"with"quotes': 'value"with"quotes',
        "key'with'quotes": "value'with'quotes",
        'key\\with\\backslashes': 'value\\with\\backslashes',
        'key/with/slashes': 'value/with/slashes',
        'key@with@symbols': 'value@with@symbols',
        'key#with#hash': 'value#with#hash',
        key$with$dollar: 'value$with$dollar',
        测试键: '测试值',
        '🚀emoji🚀': '🔥fire🔥',
      };

      counter.add(1, specialAttributes);

      expect(mockCounter.add).toHaveBeenCalledWith(1, specialAttributes);
    });

    it('应该处理非常长的属性键和值', () => {
      // 重置 mock 以避免之前测试的影响
      vi.clearAllMocks();
      mockMeter.createCounter.mockReturnValue(mockCounter);

      const counter = metricsService.createCounter('test-counter', 'Test counter');
      const longKey = 'k'.repeat(1000);
      const longValue = 'v'.repeat(1000);

      const attributes = {
        [longKey]: longValue,
      };

      counter.add(1, attributes);

      expect(mockCounter.add).toHaveBeenCalledWith(1, attributes);
    });
  });
});
