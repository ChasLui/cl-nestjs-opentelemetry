import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { TracingService } from '@/services/tracing.service';
import { DEFAULT_OPENTELEMETRY_CONFIG } from '@/opentelemetry.module';

// Mock OpenTelemetry
const mockTracer = {
  startSpan: vi.fn(),
};

const mockSpan = {
  setAttributes: vi.fn(),
  setAttribute: vi.fn(),
  addEvent: vi.fn(),
  recordException: vi.fn(),
  setStatus: vi.fn(),
  end: vi.fn(),
  spanContext: vi.fn(() => ({
    traceId: 'test-trace-id',
    spanId: 'test-span-id',
  })),
};

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(),
    getActiveSpan: vi.fn(),
    setSpan: vi.fn(),
  },
  context: {
    active: vi.fn(),
    with: vi.fn(),
  },
  SpanStatusCode: {
    OK: 'OK',
    ERROR: 'ERROR',
  },
  SpanKind: {
    INTERNAL: 'INTERNAL',
    SERVER: 'SERVER',
    CLIENT: 'CLIENT',
    PRODUCER: 'PRODUCER',
    CONSUMER: 'CONSUMER',
  },
}));

describe('TracingService', () => {
  let tracingService: TracingService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup trace mock
    (trace.getTracer as MockedFunction<typeof trace.getTracer>).mockReturnValue(mockTracer as any);
    (trace.getActiveSpan as MockedFunction<typeof trace.getActiveSpan>).mockReturnValue(mockSpan as any);
    (trace.setSpan as MockedFunction<typeof trace.setSpan>).mockImplementation((ctx, _span) => ctx);

    // Setup context mock
    (context.active as MockedFunction<typeof context.active>).mockReturnValue({} as any);
    (context.with as MockedFunction<typeof context.with>).mockImplementation((ctx, fn) => fn());

    mockTracer.startSpan.mockReturnValue(mockSpan);

    tracingService = new TracingService(DEFAULT_OPENTELEMETRY_CONFIG);
  });

  describe('构造函数', () => {
    it('应该在追踪启用时创建追踪器', () => {
      expect(trace.getTracer).toHaveBeenCalledWith(
        DEFAULT_OPENTELEMETRY_CONFIG.serviceName,
        DEFAULT_OPENTELEMETRY_CONFIG.serviceVersion,
      );
    });

    it('应该在追踪禁用时不创建追踪器', () => {
      vi.clearAllMocks();
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        tracing: { enabled: false },
      };

      new TracingService(config);

      expect(trace.getTracer).not.toHaveBeenCalled();
    });

    it('应该使用默认版本当未提供时', () => {
      vi.clearAllMocks();
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        serviceVersion: undefined,
      };

      new TracingService(config);

      expect(trace.getTracer).toHaveBeenCalledWith(config.serviceName, '1.0.0');
    });
  });

  describe('onModuleInit', () => {
    it('应该成功初始化', () => {
      expect(() => tracingService.onModuleInit()).not.toThrow();
    });
  });

  describe('startSpan', () => {
    it('应该创建新的span', () => {
      const name = 'test-span';
      const options = {
        kind: SpanKind.INTERNAL,
        attributes: { 'test.attr': 'value' },
      };

      const span = tracingService.startSpan(name, options);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(name, {
        kind: SpanKind.INTERNAL,
        attributes: options.attributes,
      });
      expect(span).toBe(mockSpan);
    });

    it('应该使用默认选项', () => {
      const name = 'default-span';

      tracingService.startSpan(name);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(name, {
        kind: SpanKind.INTERNAL,
        attributes: {},
      });
    });

    it('应该支持父上下文', () => {
      const name = 'child-span';
      const parentContext = {} as any;
      const options = { parent: parentContext };

      tracingService.startSpan(name, options);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        name,
        {
          kind: SpanKind.INTERNAL,
          attributes: {},
        },
        parentContext,
      );
    });

    it('应该在没有追踪器时返回活跃span或noop span', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        tracing: { enabled: false },
      };
      const service = new TracingService(config);

      service.startSpan('test');

      // 应该返回活跃span或noop span
      expect(trace.getActiveSpan).toHaveBeenCalled();
    });

    it('应该在没有追踪器和活跃span时返回noop span', () => {
      (trace.getActiveSpan as MockedFunction<typeof trace.getActiveSpan>).mockReturnValue(undefined);

      const mockNoopTracer = { startSpan: vi.fn().mockReturnValue(mockSpan) };
      (trace.getTracer as MockedFunction<typeof trace.getTracer>).mockReturnValue(mockNoopTracer as any);

      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        tracing: { enabled: false },
      };
      const service = new TracingService(config);

      service.startSpan('test');

      expect(trace.getTracer).toHaveBeenCalledWith('noop');
      expect(mockNoopTracer.startSpan).toHaveBeenCalledWith('test');
    });
  });

  describe('startChildSpan', () => {
    it('应该创建子span', () => {
      const name = 'child-span';
      const attributes = { 'child.attr': 'value' };

      tracingService.startChildSpan(name, attributes);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        name,
        {
          kind: SpanKind.INTERNAL,
          attributes,
        },
        expect.any(Object),
      );
    });

    it('应该不带属性创建子span', () => {
      const name = 'child-span';

      tracingService.startChildSpan(name);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        name,
        {
          kind: SpanKind.INTERNAL,
          attributes: {},
        },
        expect.any(Object),
      );
    });
  });

  describe('withSpan', () => {
    it('应该在span上下文中执行异步函数', async () => {
      const name = 'async-span';
      const mockFn = vi.fn().mockResolvedValue('result');

      const result = await tracingService.withSpan(name, mockFn);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(name, {
        kind: SpanKind.INTERNAL,
        attributes: {},
      });
      expect(context.with).toHaveBeenCalled();
      expect(mockFn).toHaveBeenCalledWith(mockSpan);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('应该在span上下文中执行同步函数', async () => {
      const name = 'sync-span';
      const mockFn = vi.fn().mockReturnValue('sync-result');

      const result = await tracingService.withSpan(name, mockFn);

      expect(mockFn).toHaveBeenCalledWith(mockSpan);
      expect(result).toBe('sync-result');
    });

    it('应该处理函数执行中的错误', async () => {
      const name = 'error-span';
      const error = new Error('测试错误');
      const mockFn = vi.fn().mockRejectedValue(error);

      await expect(tracingService.withSpan(name, mockFn)).rejects.toThrow('测试错误');

      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('应该支持自定义选项', async () => {
      const name = 'custom-span';
      const options = {
        kind: SpanKind.CLIENT,
        attributes: { 'custom.attr': 'value' },
      };
      const mockFn = vi.fn().mockResolvedValue('result');

      await tracingService.withSpan(name, mockFn, options);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(name, options);
    });
  });

  describe('withSpanSync', () => {
    it('应该在span上下文中执行同步函数', () => {
      const name = 'sync-span';
      const mockFn = vi.fn().mockReturnValue('sync-result');

      const result = tracingService.withSpanSync(name, mockFn);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(name, {
        kind: SpanKind.INTERNAL,
        attributes: {},
      });
      expect(context.with).toHaveBeenCalled();
      expect(mockFn).toHaveBeenCalledWith(mockSpan);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
      expect(result).toBe('sync-result');
    });

    it('应该处理同步函数执行中的错误', () => {
      const name = 'error-span';
      const error = new Error('同步错误');
      const mockFn = vi.fn().mockImplementation(() => {
        throw error;
      });

      expect(() => tracingService.withSpanSync(name, mockFn)).toThrow('同步错误');

      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('应该支持自定义选项', () => {
      const name = 'custom-sync-span';
      const options = {
        kind: SpanKind.SERVER,
        attributes: { 'sync.attr': 'value' },
      };
      const mockFn = vi.fn().mockReturnValue('result');

      tracingService.withSpanSync(name, mockFn, options);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(name, options);
    });
  });

  describe('getActiveSpan', () => {
    it('应该返回当前活跃的span', () => {
      const activeSpan = tracingService.getActiveSpan();

      expect(trace.getActiveSpan).toHaveBeenCalled();
      expect(activeSpan).toBe(mockSpan);
    });
  });

  describe('addAttributes', () => {
    it('应该向活跃span添加属性', () => {
      const attributes = {
        attr1: 'value1',
        attr2: 42,
        attr3: true,
      };

      tracingService.addAttributes(attributes);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(attributes);
    });

    it('应该在没有活跃span时不执行任何操作', () => {
      (trace.getActiveSpan as MockedFunction<typeof trace.getActiveSpan>).mockReturnValue(undefined);

      const attributes = { 'test.attr': 'value' };

      expect(() => tracingService.addAttributes(attributes)).not.toThrow();
    });
  });

  describe('addAttribute', () => {
    it('应该向活跃span添加单个属性', () => {
      const key = 'test.key';
      const value = 'test.value';

      tracingService.addAttribute(key, value);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(key, value);
    });

    it('应该支持不同类型的值', () => {
      tracingService.addAttribute('string.attr', 'string');
      tracingService.addAttribute('number.attr', 123);
      tracingService.addAttribute('boolean.attr', true);

      expect(mockSpan.setAttribute).toHaveBeenCalledTimes(3);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('string.attr', 'string');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('number.attr', 123);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('boolean.attr', true);
    });
  });

  describe('addEvent', () => {
    it('应该向活跃span添加事件', () => {
      const name = 'test.event';
      const attributes = { 'event.attr': 'value' };

      tracingService.addEvent(name, attributes);

      expect(mockSpan.addEvent).toHaveBeenCalledWith(name, attributes);
    });

    it('应该不带属性添加事件', () => {
      const name = 'simple.event';

      tracingService.addEvent(name);

      expect(mockSpan.addEvent).toHaveBeenCalledWith(name, undefined);
    });
  });

  describe('recordException', () => {
    it('应该在活跃span中记录异常', () => {
      const exception = new Error('测试异常');

      tracingService.recordException(exception);

      expect(mockSpan.recordException).toHaveBeenCalledWith(exception);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: exception.message,
      });
    });
  });

  describe('setStatus', () => {
    it('应该设置活跃span的状态', () => {
      const code = SpanStatusCode.ERROR;
      const message = '操作失败';

      tracingService.setStatus(code, message);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code, message });
    });

    it('应该不带消息设置状态', () => {
      const code = SpanStatusCode.OK;

      tracingService.setStatus(code);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code, message: undefined });
    });
  });

  describe('专用span创建方法', () => {
    describe('startHttpSpan', () => {
      it('应该创建HTTP span', () => {
        const method = 'GET';
        const url = 'https://api.example.com/users';

        tracingService.startHttpSpan(method, url);

        expect(mockTracer.startSpan).toHaveBeenCalledWith(`${method} ${url}`, {
          kind: SpanKind.CLIENT,
          attributes: {
            'http.method': method,
            'http.url': url,
            'http.scheme': 'https',
          },
        });
      });

      it('应该检测HTTP协议', () => {
        tracingService.startHttpSpan('POST', 'http://localhost:3000/api');

        expect(mockTracer.startSpan).toHaveBeenCalledWith('POST http://localhost:3000/api', {
          kind: SpanKind.CLIENT,
          attributes: {
            'http.method': 'POST',
            'http.url': 'http://localhost:3000/api',
            'http.scheme': 'http',
          },
        });
      });

      it('应该支持自定义选项', () => {
        const options = {
          kind: SpanKind.SERVER,
          attributes: { 'custom.attr': 'value' },
        };

        tracingService.startHttpSpan('PUT', '/api/update', options);

        expect(mockTracer.startSpan).toHaveBeenCalledWith('PUT /api/update', {
          kind: SpanKind.SERVER,
          attributes: {
            'http.method': 'PUT',
            'http.url': '/api/update',
            'http.scheme': 'http',
            'custom.attr': 'value',
          },
        });
      });
    });

    describe('startDbSpan', () => {
      it('应该创建数据库span', () => {
        const operation = 'SELECT';
        const table = 'users';

        tracingService.startDbSpan(operation, table);

        expect(mockTracer.startSpan).toHaveBeenCalledWith(`${operation} ${table}`, {
          kind: SpanKind.CLIENT,
          attributes: {
            'db.operation': operation,
            'db.name': table,
            'db.system': 'unknown',
          },
        });
      });

      it('应该支持查询语句', () => {
        const operation = 'INSERT';
        const table = 'orders';
        const options = {
          query: 'INSERT INTO orders (id, amount) VALUES (?, ?)',
          attributes: { 'db.system': 'postgresql' },
        };

        tracingService.startDbSpan(operation, table, options);

        expect(mockTracer.startSpan).toHaveBeenCalledWith(`${operation} ${table}`, {
          kind: SpanKind.CLIENT,
          attributes: {
            'db.operation': operation,
            'db.name': table,
            'db.system': 'postgresql',
            'db.statement': options.query,
          },
        });
      });
    });

    describe('startBusinessSpan', () => {
      it('应该创建业务span', () => {
        const operation = 'calculate-discount';
        const attributes = { 'user.id': '123', 'order.total': 100 };

        tracingService.startBusinessSpan(operation, attributes);

        expect(mockTracer.startSpan).toHaveBeenCalledWith(operation, {
          kind: SpanKind.INTERNAL,
          attributes: {
            'operation.type': 'business',
            'user.id': '123',
            'order.total': 100,
          },
        });
      });

      it('应该不带属性创建业务span', () => {
        const operation = 'validate-input';

        tracingService.startBusinessSpan(operation);

        expect(mockTracer.startSpan).toHaveBeenCalledWith(operation, {
          kind: SpanKind.INTERNAL,
          attributes: {
            'operation.type': 'business',
          },
        });
      });
    });
  });

  describe('上下文信息获取', () => {
    describe('getCurrentTraceId', () => {
      it('应该返回当前追踪ID', () => {
        const traceId = tracingService.getCurrentTraceId();

        expect(mockSpan.spanContext).toHaveBeenCalled();
        expect(traceId).toBe('test-trace-id');
      });

      it('应该在没有活跃span时返回undefined', () => {
        (trace.getActiveSpan as MockedFunction<typeof trace.getActiveSpan>).mockReturnValue(undefined);

        const traceId = tracingService.getCurrentTraceId();

        expect(traceId).toBeUndefined();
      });
    });

    describe('getCurrentSpanId', () => {
      it('应该返回当前spanID', () => {
        const spanId = tracingService.getCurrentSpanId();

        expect(mockSpan.spanContext).toHaveBeenCalled();
        expect(spanId).toBe('test-span-id');
      });

      it('应该在没有活跃span时返回undefined', () => {
        (trace.getActiveSpan as MockedFunction<typeof trace.getActiveSpan>).mockReturnValue(undefined);

        const spanId = tracingService.getCurrentSpanId();

        expect(spanId).toBeUndefined();
      });
    });
  });

  describe('getTracer', () => {
    it('应该返回追踪器实例', () => {
      const tracer = tracingService.getTracer();
      expect(tracer).toBe(mockTracer);
    });
  });

  describe('createSpan', () => {
    it('应该创建手动span', () => {
      const name = 'manual-span';
      const options = {
        kind: SpanKind.PRODUCER,
        attributes: { 'manual.attr': 'value' },
      };

      const span = tracingService.createSpan(name, options);

      expect(mockTracer.startSpan).toHaveBeenCalledWith(name, options);
      expect(span).toBe(mockSpan);
    });
  });

  describe('边界情况', () => {
    it('应该在追踪禁用时处理所有方法调用', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        tracing: { enabled: false },
      };
      const service = new TracingService(config);

      expect(() => {
        service.onModuleInit();
        service.addAttributes({ test: 'value' });
        service.addAttribute('test', 'value');
        service.addEvent('test');
        service.recordException(new Error('test'));
        service.setStatus(SpanStatusCode.OK);
        service.getCurrentTraceId();
        service.getCurrentSpanId();
      }).not.toThrow();
    });

    it('应该在没有活跃span时处理所有span操作', () => {
      (trace.getActiveSpan as MockedFunction<typeof trace.getActiveSpan>).mockReturnValue(undefined);

      expect(() => {
        tracingService.addAttributes({ test: 'value' });
        tracingService.addAttribute('test', 'value');
        tracingService.addEvent('test');
        tracingService.recordException(new Error('test'));
        tracingService.setStatus(SpanStatusCode.OK);
      }).not.toThrow();

      expect(tracingService.getCurrentTraceId()).toBeUndefined();
      expect(tracingService.getCurrentSpanId()).toBeUndefined();
    });
  });
});
