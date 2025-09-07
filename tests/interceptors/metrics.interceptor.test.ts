import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { MetricsInterceptor } from '@/interceptors/metrics.interceptor';
import { MetricsService } from '@/services/metrics.service';
import { METRICS_METADATA_KEY } from '@/decorators/metrics.decorator';

// Mock MetricsService
vi.mock('@/services/metrics.service');

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let metricsService: MetricsService;
  let reflector: Reflector;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    vi.clearAllMocks();

    metricsService = {
      createCounter: vi.fn(),
      incrementCounter: vi.fn(),
      createHistogram: vi.fn(),
      recordHistogram: vi.fn(),
    } as any;

    reflector = {
      get: vi.fn(),
    } as any;

    interceptor = new MetricsInterceptor(metricsService, reflector);

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
    it('应该在 Reflector 为 undefined 时直接继续并输出警告', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const interceptorWithoutReflector = new MetricsInterceptor(metricsService, undefined as any);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptorWithoutReflector.intercept(mockContext, mockCallHandler);
      result$.subscribe();

      expect(consoleSpy).toHaveBeenCalledWith(
        'MetricsInterceptor: Reflector not available, skipping metrics collection',
      );
      expect(mockCallHandler.handle).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('应该在 Reflector 为 null 时直接继续并输出警告', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const interceptorWithoutReflector = new MetricsInterceptor(metricsService, null as any);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const result$ = interceptorWithoutReflector.intercept(mockContext, mockCallHandler);
      result$.subscribe();

      expect(consoleSpy).toHaveBeenCalledWith(
        'MetricsInterceptor: Reflector not available, skipping metrics collection',
      );
      expect(mockCallHandler.handle).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('应该在没有元数据时直接继续', () => {
      reflector.get = vi.fn().mockReturnValue(null);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      interceptor.intercept(mockContext, mockCallHandler);

      expect(reflector.get).toHaveBeenCalledWith(METRICS_METADATA_KEY, expect.any(Function));
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('应该处理成功响应并记录指标', () => {
      const metricsOptions = {
        counter: 'test_counter',
        histogram: 'test_histogram',
        attributes: { test: 'value' },
        recordArgs: true,
        argNames: ['id', 'name'],
        recordStatus: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockCounter = { add: vi.fn() };
      const mockHistogram = { record: vi.fn() };

      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);
      metricsService.createHistogram = vi.fn().mockReturnValue(mockHistogram);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(metricsService.createCounter).toHaveBeenCalledWith(
        'test_counter',
        'Counter for TestController.testMethod',
        '1',
      );
      expect(metricsService.createHistogram).toHaveBeenCalledWith(
        'test_histogram',
        'Duration histogram for TestController.testMethod',
        'ms',
      );
      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          test: 'value',
          class: 'TestController',
          method: 'testMethod',
          status: 'success',
          http_status_code: 200,
        }),
      );
      expect(mockHistogram.record).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          test: 'value',
          class: 'TestController',
          method: 'testMethod',
          status: 'success',
          http_status_code: 200,
        }),
      );
    });

    it('应该处理错误响应并记录指标', () => {
      const metricsOptions = {
        counter: 'test_counter',
        histogram: 'test_histogram',
        attributes: { test: 'value' },
        recordStatus: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      const error = new Error('Test error');
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => error));

      const mockCounter = { add: vi.fn() };
      const mockHistogram = { record: vi.fn() };

      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);
      metricsService.createHistogram = vi.fn().mockReturnValue(mockHistogram);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: () => {},
      });

      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          test: 'value',
          class: 'TestController',
          method: 'testMethod',
          status: 'error',
          error_type: 'Error',
          error_message: 'Test error',
          http_status_code: 200,
        }),
      );
      expect(mockHistogram.record).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          test: 'value',
          class: 'TestController',
          method: 'testMethod',
          status: 'error',
          error_type: 'Error',
          error_message: 'Test error',
          http_status_code: 200,
        }),
      );
    });

    it('应该处理计数器创建失败的情况', () => {
      const metricsOptions = {
        counter: 'test_counter',
        attributes: { test: 'value' },
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      metricsService.createCounter = vi.fn().mockImplementation(() => {
        throw new Error('Counter already exists');
      });

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'test_counter',
        1,
        expect.objectContaining({
          test: 'value',
          class: 'TestController',
          method: 'testMethod',
        }),
      );
    });

    it('应该处理直方图创建失败的情况', () => {
      const metricsOptions = {
        histogram: 'test_histogram',
        attributes: { test: 'value' },
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      metricsService.createHistogram = vi.fn().mockImplementation(() => {
        throw new Error('Histogram already exists');
      });

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(metricsService.recordHistogram).toHaveBeenCalledWith(
        'test_histogram',
        expect.any(Number),
        expect.objectContaining({
          test: 'value',
          class: 'TestController',
          method: 'testMethod',
        }),
      );
    });

    it('应该记录参数当 recordArgs 为 true 时', () => {
      const metricsOptions = {
        counter: 'test_counter',
        recordArgs: true,
        argNames: ['id', 'name'],
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockCounter = { add: vi.fn() };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          arg_id: 'arg1',
          arg_name: 'arg2',
        }),
      );
    });

    it('应该处理复杂参数类型', () => {
      const metricsOptions = {
        counter: 'test_counter',
        recordArgs: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockContext.getArgs = vi
        .fn()
        .mockReturnValue(['simple_string', 123, true, { complex: 'object' }, null, undefined]);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockCounter = { add: vi.fn() };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          arg_arg0: 'simple_string',
          arg_arg1: 123,
          arg_arg2: true,
          // 复杂对象、null 和 undefined 不应该被记录
        }),
      );
    });

    it('应该处理没有 HTTP 请求的情况', () => {
      const metricsOptions = {
        counter: 'test_counter',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockContext.switchToHttp = vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(null),
        getResponse: vi.fn().mockReturnValue(null),
      });
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockCounter = { add: vi.fn() };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          class: 'TestController',
          method: 'testMethod',
          // 不应该包含 HTTP 相关属性
        }),
      );
    });

    it('应该处理只有计数器的情况', () => {
      const metricsOptions = {
        counter: 'test_counter',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockCounter = { add: vi.fn() };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(metricsService.createCounter).toHaveBeenCalled();
      expect(metricsService.createHistogram).not.toHaveBeenCalled();
    });

    it('应该处理只有直方图的情况', () => {
      const metricsOptions = {
        histogram: 'test_histogram',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockHistogram = { record: vi.fn() };
      metricsService.createHistogram = vi.fn().mockReturnValue(mockHistogram);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(metricsService.createHistogram).toHaveBeenCalled();
      expect(metricsService.createCounter).not.toHaveBeenCalled();
    });

    it('应该处理错误响应中的计数器创建失败', () => {
      const metricsOptions = {
        counter: 'test_counter',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      const error = new Error('Test error');
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => error));

      metricsService.createCounter = vi.fn().mockImplementation(() => {
        throw new Error('Counter already exists');
      });

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: () => {},
      });

      expect(metricsService.incrementCounter).toHaveBeenCalledWith(
        'test_counter',
        1,
        expect.objectContaining({
          error_type: 'Error',
          error_message: 'Test error',
        }),
      );
    });

    it('应该处理错误响应中的直方图创建失败', () => {
      const metricsOptions = {
        histogram: 'test_histogram',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      const error = new Error('Test error');
      mockCallHandler.handle = vi.fn().mockReturnValue(throwError(() => error));

      metricsService.createHistogram = vi.fn().mockImplementation(() => {
        throw new Error('Histogram already exists');
      });

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: () => {},
      });

      expect(metricsService.recordHistogram).toHaveBeenCalledWith(
        'test_histogram',
        expect.any(Number),
        expect.objectContaining({
          error_type: 'Error',
          error_message: 'Test error',
        }),
      );
    });

    it('应该处理没有 route.path 的 HTTP 请求', () => {
      const metricsOptions = {
        counter: 'test_counter',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
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

      const mockCounter = { add: vi.fn() };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          http_method: 'GET',
          http_route: '/test', // 应该使用 url 而不是 route.path
          http_status_code: 200,
        }),
      );
    });

    it('应该处理没有 statusCode 的 HTTP 响应', () => {
      const metricsOptions = {
        counter: 'test_counter',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
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

      const mockCounter = { add: vi.fn() };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe();

      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          http_method: 'GET',
          http_route: '/test',
          http_status_code: 200, // 应该使用默认值 200
        }),
      );
    });

    it('应该处理错误响应中没有 statusCode 的情况', () => {
      const metricsOptions = {
        counter: 'test_counter',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
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

      const mockCounter = { add: vi.fn() };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      result$.subscribe({
        error: () => {},
      });

      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          http_method: 'GET',
          http_route: '/test',
          http_status_code: 500, // 错误时应该使用默认值 500
          error_type: 'Error',
          error_message: 'Test error',
        }),
      );
    });

    it('应该处理 MetricsService 为 null 的情况', () => {
      const metricsOptions = {
        counter: 'test_counter',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const interceptorWithoutMetricsService = new MetricsInterceptor(null as any, reflector);

      expect(() => {
        const result$ = interceptorWithoutMetricsService.intercept(mockContext, mockCallHandler);
        result$.subscribe({
          error: () => {},
        });
      }).toThrow();
    });

    it('应该处理 context.getClass 返回 null 的情况', () => {
      const metricsOptions = {
        counter: 'test_counter',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));
      mockContext.getClass = vi.fn().mockReturnValue(null);

      expect(() => {
        const result$ = interceptor.intercept(mockContext, mockCallHandler);
        result$.subscribe();
      }).toThrow();
    });

    it('应该处理 context.getHandler 返回 null 的情况', () => {
      reflector.get = vi.fn().mockReturnValue(null);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));
      mockContext.getHandler = vi.fn().mockReturnValue(null);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      result$.subscribe();

      expect(reflector.get).toHaveBeenCalledWith(METRICS_METADATA_KEY, null);
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('应该处理 switchToHttp 抛出异常的情况', () => {
      const metricsOptions = {
        counter: 'test_counter',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));
      mockContext.switchToHttp = vi.fn().mockImplementation(() => {
        throw new Error('Not an HTTP context');
      });

      expect(() => {
        const result$ = interceptor.intercept(mockContext, mockCallHandler);
        result$.subscribe();
      }).toThrow('Not an HTTP context');
    });

    it('应该处理极大参数数组的情况', () => {
      const metricsOptions = {
        counter: 'test_counter',
        recordArgs: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      // 创建一个包含1000个简单参数的数组
      const largeArgs = new Array(1000).fill(0).map((_, i) => `arg${i}`);
      mockContext.getArgs = vi.fn().mockReturnValue(largeArgs);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockCounter = { add: vi.fn() };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      result$.subscribe();

      expect(metricsService.createCounter).toHaveBeenCalled();
      expect(mockCounter.add).toHaveBeenCalled();
    });

    it('应该处理计数器和直方图都创建失败的情况', () => {
      const metricsOptions = {
        counter: 'test_counter',
        histogram: 'test_histogram',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      metricsService.createCounter = vi.fn().mockImplementation(() => {
        throw new Error('Counter creation failed');
      });
      metricsService.createHistogram = vi.fn().mockImplementation(() => {
        throw new Error('Histogram creation failed');
      });

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      result$.subscribe();

      expect(metricsService.incrementCounter).toHaveBeenCalled();
      expect(metricsService.recordHistogram).toHaveBeenCalled();
    });

    it('应该处理计数器 add 方法抛出异常的情况', () => {
      const metricsOptions = {
        counter: 'test_counter',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockCounter = {
        add: vi.fn().mockImplementation(() => {
          throw new Error('Counter add failed');
        }),
      };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      result$.subscribe({
        next: () => {},
        error: (error) => {
          expect(error.message).toBe('Counter add failed');
        },
      });
    });

    it('应该处理直方图 record 方法抛出异常的情况', () => {
      const metricsOptions = {
        histogram: 'test_histogram',
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockHistogram = {
        record: vi.fn().mockImplementation(() => {
          throw new Error('Histogram record failed');
        }),
      };
      metricsService.createHistogram = vi.fn().mockReturnValue(mockHistogram);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      result$.subscribe({
        next: () => {},
        error: (error) => {
          expect(error.message).toBe('Histogram record failed');
        },
      });
    });

    it('应该处理 reflector.get 抛出异常的情况', () => {
      reflector.get = vi.fn().mockImplementation(() => {
        throw new Error('Reflector error');
      });
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      expect(() => {
        interceptor.intercept(mockContext, mockCallHandler);
      }).toThrow('Reflector error');
    });

    it('应该处理包含特殊字符的参数', () => {
      const metricsOptions = {
        counter: 'test_counter',
        recordArgs: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockContext.getArgs = vi
        .fn()
        .mockReturnValue([
          'normal_string',
          'string with spaces',
          'string\nwith\nnewlines',
          'string\twith\ttabs',
          'string"with"quotes',
          "string'with'quotes",
          'string\\with\\backslashes',
          'string/with/slashes',
          'string@with@symbols',
          'string#with#hash',
          'string$with$dollar',
        ]);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockCounter = { add: vi.fn() };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      result$.subscribe();

      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          arg_arg0: 'normal_string',
          arg_arg1: 'string with spaces',
          arg_arg2: 'string\nwith\nnewlines',
          arg_arg3: 'string\twith\ttabs',
          arg_arg4: 'string"with"quotes',
          arg_arg5: "string'with'quotes",
          arg_arg6: 'string\\with\\backslashes',
          arg_arg7: 'string/with/slashes',
          arg_arg8: 'string@with@symbols',
          arg_arg9: 'string#with#hash',
          arg_arg10: 'string$with$dollar',
        }),
      );
    });

    it('应该处理非常大的数字参数', () => {
      const metricsOptions = {
        counter: 'test_counter',
        recordArgs: true,
        originalMethodName: 'testMethod',
      };

      reflector.get = vi.fn().mockReturnValue(metricsOptions);
      mockContext.getArgs = vi
        .fn()
        .mockReturnValue([
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
        ]);
      mockCallHandler.handle = vi.fn().mockReturnValue(of('result'));

      const mockCounter = { add: vi.fn() };
      metricsService.createCounter = vi.fn().mockReturnValue(mockCounter);

      const result$ = interceptor.intercept(mockContext, mockCallHandler);
      result$.subscribe();

      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          arg_arg0: Number.MAX_SAFE_INTEGER,
          arg_arg1: Number.MIN_SAFE_INTEGER,
          arg_arg2: Number.POSITIVE_INFINITY,
          arg_arg3: Number.NEGATIVE_INFINITY,
          arg_arg4: Number.NaN,
          arg_arg5: 0,
          arg_arg6: -0,
          arg_arg7: 3.141592653589793,
          arg_arg8: 1e-10,
          arg_arg9: 1e10,
        }),
      );
    });
  });
});
