import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { TracingInterceptor } from '@/interceptors/tracing.interceptor';
import { TracingService } from '@/services/tracing.service';
import { TRACE_METADATA_KEY } from '@/decorators/trace.decorator';

// Mock TracingService
vi.mock('@/services/tracing.service');

describe('TracingInterceptor', () => {
  let interceptor: TracingInterceptor;
  let tracingService: TracingService;
  let reflector: Reflector;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockSpan: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSpan = {
      setAttribute: vi.fn(),
      setStatus: vi.fn(),
      recordException: vi.fn(),
      end: vi.fn(),
    };

    tracingService = {
      startSpan: vi.fn().mockReturnValue(mockSpan),
    } as any;

    reflector = {
      get: vi.fn(),
    } as any;

    interceptor = new TracingInterceptor(tracingService, reflector);

    // Mock context
    mockContext = {
      getClass: vi.fn().mockReturnValue({ name: 'TestController' }),
      getHandler: vi.fn().mockReturnValue(() => {}),
      getArgs: vi.fn().mockReturnValue(['arg1', 'arg2']),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          method: 'GET',
          url: '/test',
          route: { path: '/test' },
          headers: { 'user-agent': 'test-agent' },
        }),
        getResponse: vi.fn().mockReturnValue({
          statusCode: 200,
        }),
      }),
    } as any;

    mockCallHandler = {
      handle: vi.fn(),
    } as any;
  });

  describe('intercept', () => {
    it('应该在没有元数据时直接继续', () => {
      reflector.get = vi.fn().mockReturnValue(null);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      interceptor.intercept(mockContext, mockCallHandler);

      expect(reflector.get).toHaveBeenCalledWith(TRACE_METADATA_KEY, expect.any(Function));
      expect(mockCallHandler.handle).toHaveBeenCalled();
      expect(tracingService.startSpan).not.toHaveBeenCalled();
    });

    it('应该处理成功响应并记录追踪', () => {
      const traceOptions = {
        name: 'custom_span_name',
        kind: SpanKind.SERVER,
        attributes: { test: 'value' },
        recordArgs: true,
        recordResult: true,
        argNames: ['id', 'name'],
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(tracingService.startSpan).toHaveBeenCalledWith('custom_span_name', {
        kind: SpanKind.SERVER,
        attributes: expect.objectContaining({
          test: 'value',
          'code.function': 'testMethod',
          'code.namespace': 'TestController',
          'args.id': 'arg1',
          'args.name': 'arg2',
          'http.method': 'GET',
          'http.url': '/test',
          'http.route': '/test',
          'http.user_agent': 'test-agent',
        }),
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('operation.duration_ms', expect.any(Number));
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('result', 'result');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 200);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('应该处理错误响应并记录追踪', () => {
      const traceOptions = {
        name: 'custom_span_name',
        kind: SpanKind.SERVER,
        attributes: { test: 'value' },
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: () => {},
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('operation.duration_ms', expect.any(Number));
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.name', 'Error');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.message', 'Test error');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.stack', 'Error stack trace');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 200);
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Test error',
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('应该使用默认 span 名称', () => {
      const traceOptions = {
        attributes: { test: 'value' },
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(tracingService.startSpan).toHaveBeenCalledWith('TestController.testMethod', {
        kind: SpanKind.INTERNAL,
        attributes: expect.objectContaining({
          test: 'value',
          'code.function': 'testMethod',
          'code.namespace': 'TestController',
        }),
      });
    });

    it('应该记录参数当 recordArgs 为 true 时', () => {
      const traceOptions = {
        recordArgs: true,
        argNames: ['id', 'name'],
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(tracingService.startSpan).toHaveBeenCalledWith('TestController.testMethod', {
        kind: SpanKind.INTERNAL,
        attributes: expect.objectContaining({
          'args.id': 'arg1',
          'args.name': 'arg2',
        }),
      });
    });

    it('应该处理复杂参数类型', () => {
      const traceOptions = {
        recordArgs: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockContext.getArgs = vi
        .fn()
        .mockReturnValue(['simple_string', 123, true, { complex: 'object' }, null, undefined]);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(tracingService.startSpan).toHaveBeenCalledWith('TestController.testMethod', {
        kind: SpanKind.INTERNAL,
        attributes: expect.objectContaining({
          'args.arg0': 'simple_string',
          'args.arg1': '123',
          'args.arg2': 'true',
          'args.arg3': '{"complex":"object"}',
        }),
      });
    });

    it('应该记录结果当 recordResult 为 true 时', () => {
      const traceOptions = {
        recordResult: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      const complexResult = { data: 'test', count: 42 };
      mockCallHandler.handle = vi.fn().mockReturnValue(of(complexResult));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('result', '{"data":"test","count":42}');
    });

    it('应该处理简单结果类型', () => {
      const traceOptions = {
        recordResult: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('simple_result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('result', 'simple_result');
    });

    it('应该处理 undefined 结果', () => {
      const traceOptions = {
        recordResult: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of(undefined));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(mockSpan.setAttribute).not.toHaveBeenCalledWith('result', expect.anything());
    });

    it('应该为 HTTP 请求添加特定属性', () => {
      const traceOptions = {
        kind: SpanKind.SERVER,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(tracingService.startSpan).toHaveBeenCalledWith('TestController.testMethod', {
        kind: SpanKind.SERVER,
        attributes: expect.objectContaining({
          'http.method': 'GET',
          'http.url': '/test',
          'http.route': '/test',
          'http.user_agent': 'test-agent',
        }),
      });
    });

    it('应该处理没有 HTTP 请求的情况', () => {
      const traceOptions = {
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockContext.switchToHttp = vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(null),
        getResponse: vi.fn().mockReturnValue(null),
      });
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(tracingService.startSpan).toHaveBeenCalledWith('TestController.testMethod', {
        kind: SpanKind.INTERNAL,
        attributes: expect.objectContaining({
          'code.function': 'testMethod',
          'code.namespace': 'TestController',
          // 不应该包含 HTTP 相关属性
        }),
      });
    });

    it('应该处理没有 HTTP 响应的错误', () => {
      const traceOptions = {
        kind: SpanKind.SERVER,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      const error = new Error('Test error');
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => error));
      mockContext.switchToHttp = vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({}),
        getResponse: vi.fn().mockReturnValue(null),
      });

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: () => {},
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.name', 'Error');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.message', 'Test error');
      expect(mockSpan.setAttribute).not.toHaveBeenCalledWith('http.status_code', expect.anything());
    });

    it('应该处理没有错误堆栈的情况', () => {
      const traceOptions = {
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      const error = new Error('Test error');
      delete error.stack;
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: () => {},
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.name', 'Error');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.message', 'Test error');
      expect(mockSpan.setAttribute).not.toHaveBeenCalledWith('error.stack', expect.anything());
    });

    it('应该处理没有参数的情况', () => {
      const traceOptions = {
        recordArgs: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockContext.getArgs = vi.fn().mockReturnValue([]);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(tracingService.startSpan).toHaveBeenCalledWith('TestController.testMethod', {
        kind: SpanKind.INTERNAL,
        attributes: expect.objectContaining({
          'code.function': 'testMethod',
          'code.namespace': 'TestController',
          // 不应该包含参数属性
        }),
      });
    });

    it('应该处理 null 和 undefined 参数', () => {
      const traceOptions = {
        recordArgs: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockContext.getArgs = vi.fn().mockReturnValue([null, undefined]);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(tracingService.startSpan).toHaveBeenCalledWith('TestController.testMethod', {
        kind: SpanKind.INTERNAL,
        attributes: expect.objectContaining({
          'code.function': 'testMethod',
          'code.namespace': 'TestController',
        }),
      });
    });

    it('应该确保 span 在最终化时结束', () => {
      const traceOptions = {
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('应该确保 span 在错误时也结束', () => {
      const traceOptions = {
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      const error = new Error('Test error');
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: () => {},
      });

      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('应该处理没有 route.path 的 HTTP 请求', () => {
      const traceOptions = {
        kind: SpanKind.SERVER,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockContext.switchToHttp = vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          method: 'GET',
          url: '/test',
          route: {}, // 没有 path 属性
        }),
        getResponse: vi.fn().mockReturnValue({
          statusCode: 200,
        }),
      });
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(tracingService.startSpan).toHaveBeenCalledWith('TestController.testMethod', {
        kind: SpanKind.SERVER,
        attributes: expect.objectContaining({
          'http.method': 'GET',
          'http.url': '/test',
          'http.route': undefined, // 应该为 undefined
        }),
      });
    });

    it('应该处理没有 statusCode 的 HTTP 响应', () => {
      const traceOptions = {
        kind: SpanKind.SERVER,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      mockContext.switchToHttp = vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          method: 'GET',
          url: '/test',
          route: { path: '/test' },
        }),
        getResponse: vi.fn().mockReturnValue({
          // 没有 statusCode 属性
        }),
      });
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 200);
    });

    it('应该处理错误响应中没有 statusCode 的情况', () => {
      const traceOptions = {
        kind: SpanKind.SERVER,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(traceOptions);
      const error = new Error('Test error');
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => error));
      mockContext.switchToHttp = vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          method: 'GET',
          url: '/test',
          route: { path: '/test' },
        }),
        getResponse: vi.fn().mockReturnValue({
          // 没有 statusCode 属性
        }),
      });

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: () => {},
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 500);
    });
  });
});
