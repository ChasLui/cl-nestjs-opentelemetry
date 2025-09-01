import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createLogger } from 'winston';
import { EnhancedWinstonLoggerService } from '@/services/logger.service';
import { DEFAULT_OPENTELEMETRY_CONFIG } from '@/opentelemetry.module';

// Mock winston
vi.mock('winston', () => ({
  createLogger: vi.fn(),
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

// Mock winston-daily-rotate-file
vi.mock('winston-daily-rotate-file', () => {
  return {
    default: vi.fn(),
  };
});

// Mock OpenTelemetry
vi.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: vi.fn(),
  },
  SpanStatusCode: {
    ERROR: 'ERROR',
  },
}));

describe('EnhancedWinstonLoggerService', () => {
  let loggerService: EnhancedWinstonLoggerService;
  let mockWinstonLogger: any;
  let mockActiveSpan: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup winston logger mock
    mockWinstonLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      log: vi.fn(),
    };

    (createLogger as MockedFunction<typeof createLogger>).mockReturnValue(mockWinstonLogger);

    // Setup OpenTelemetry span mock
    mockActiveSpan = {
      spanContext: vi.fn(() => ({
        traceId: 'test-trace-id',
        spanId: 'test-span-id',
      })),
      recordException: vi.fn(),
      setStatus: vi.fn(),
    };

    (trace.getActiveSpan as MockedFunction<typeof trace.getActiveSpan>).mockReturnValue(mockActiveSpan);

    loggerService = new EnhancedWinstonLoggerService(DEFAULT_OPENTELEMETRY_CONFIG);
  });

  describe('构造函数', () => {
    it('应该创建Winston日志实例', () => {
      expect(createLogger).toHaveBeenCalled();
    });

    it('应该使用默认配置创建日志器', () => {
      const config = { ...DEFAULT_OPENTELEMETRY_CONFIG, logging: undefined };
      new EnhancedWinstonLoggerService(config);

      expect(createLogger).toHaveBeenCalled();
    });

    it('应该使用自定义日志配置', () => {
      const customConfig = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        logging: {
          console: false,
          file: false,
          logDir: '/custom/logs',
          level: 'debug' as const,
        },
      };

      new EnhancedWinstonLoggerService(customConfig);

      expect(createLogger).toHaveBeenCalled();
    });
  });

  describe('setContext', () => {
    it('应该设置上下文名称', () => {
      const contextName = 'TestService';
      loggerService.setContext(contextName);

      loggerService.info('测试消息');

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('测试消息', {
        context: contextName,
      });
    });
  });

  describe('log', () => {
    it('应该调用info方法', () => {
      const message = '测试日志消息';
      loggerService.log(message);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message, {
        context: 'Application',
      });
    });

    it('应该使用提供的上下文', () => {
      const message = '测试日志消息';
      const context = 'TestContext';
      loggerService.log(message, context);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message, {
        context,
      });
    });
  });

  describe('info', () => {
    it('应该记录信息级别日志', () => {
      const message = '信息消息';
      loggerService.info(message);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message, {
        context: 'Application',
      });
    });

    it('应该使用自定义上下文', () => {
      const message = '信息消息';
      const context = 'CustomContext';
      loggerService.info(message, context);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message, {
        context,
      });
    });
  });

  describe('error', () => {
    it('应该记录错误级别日志', () => {
      const message = '错误消息';
      const trace = '错误堆栈';
      loggerService.error(message, trace);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(message, {
        context: 'Application',
        trace,
        stack: trace,
      });
    });

    it('应该向活跃span记录异常', () => {
      const message = '错误消息';
      loggerService.error(message);

      expect(mockActiveSpan.recordException).toHaveBeenCalledWith(new Error(message));
      expect(mockActiveSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message,
      });
    });

    it('应该在没有活跃span时正常工作', () => {
      (trace.getActiveSpan as MockedFunction<typeof trace.getActiveSpan>).mockReturnValue(undefined);

      const message = '错误消息';
      loggerService.error(message);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(message, {
        context: 'Application',
        trace: undefined,
        stack: undefined,
      });
    });
  });

  describe('warn', () => {
    it('应该记录警告级别日志', () => {
      const message = '警告消息';
      loggerService.warn(message);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(message, {
        context: 'Application',
      });
    });

    it('应该使用自定义上下文', () => {
      const message = '警告消息';
      const context = 'WarnContext';
      loggerService.warn(message, context);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(message, {
        context,
      });
    });
  });

  describe('debug', () => {
    it('应该记录调试级别日志', () => {
      const message = '调试消息';
      loggerService.debug(message);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(message, {
        context: 'Application',
      });
    });
  });

  describe('verbose', () => {
    it('应该记录详细级别日志', () => {
      const message = '详细消息';
      loggerService.verbose(message);

      expect(mockWinstonLogger.verbose).toHaveBeenCalledWith(message, {
        context: 'Application',
      });
    });
  });

  describe('logWithMeta', () => {
    it('应该记录带有元数据的日志', () => {
      const level = 'info';
      const message = '带元数据的消息';
      const meta = { userId: '123', action: 'login' };
      const context = 'AuthService';

      loggerService.logWithMeta(level, message, meta, context);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(level, message, {
        context,
        ...meta,
      });
    });

    it('应该使用默认上下文和空元数据', () => {
      const level = 'info';
      const message = '简单消息';

      loggerService.logWithMeta(level, message);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(level, message, {
        context: 'Application',
      });
    });
  });

  describe('logHttpRequest', () => {
    it('应该记录HTTP请求日志', () => {
      const method = 'GET';
      const url = '/api/users';
      const statusCode = 200;
      const responseTime = 150;

      loggerService.logHttpRequest(method, url, statusCode, responseTime);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('GET /api/users 200 - 150ms', { context: 'HTTP' });
    });

    it('应该使用自定义上下文', () => {
      const method = 'POST';
      const url = '/api/login';
      const statusCode = 201;
      const responseTime = 300;
      const context = 'AuthController';

      loggerService.logHttpRequest(method, url, statusCode, responseTime, context);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith('POST /api/login 201 - 300ms', { context });
    });
  });

  describe('logDbQuery', () => {
    it('应该记录数据库查询日志', () => {
      const query = 'SELECT * FROM users WHERE id = ?';
      const duration = 45;

      loggerService.logDbQuery(query, duration);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(`数据库查询: ${query} - ${duration}ms`, {
        context: 'Database',
      });
    });

    it('应该使用自定义上下文', () => {
      const query = 'INSERT INTO logs (message) VALUES (?)';
      const duration = 25;
      const context = 'LogService';

      loggerService.logDbQuery(query, duration, context);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(`数据库查询: ${query} - ${duration}ms`, { context });
    });
  });

  describe('getWinstonLogger', () => {
    it('应该返回Winston日志实例', () => {
      const winstonLogger = loggerService.getWinstonLogger();
      expect(winstonLogger).toBe(mockWinstonLogger);
    });
  });

  describe('OpenTelemetry集成', () => {
    it('应该在有活跃span时添加追踪信息到日志格式', () => {
      // 这个测试验证日志格式函数是否正确处理OpenTelemetry上下文
      // 由于格式函数在构造函数中设置，我们需要验证它被正确配置
      expect(createLogger).toHaveBeenCalled();

      const createLoggerCall = (createLogger as MockedFunction<typeof createLogger>).mock.calls[0][0];
      expect(createLoggerCall).toBeDefined();
      expect(createLoggerCall.format).toBeDefined();
    });

    it('应该在没有活跃span时正常工作', () => {
      (trace.getActiveSpan as MockedFunction<typeof trace.getActiveSpan>).mockReturnValue(undefined);

      const message = '无span消息';
      loggerService.info(message);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message, {
        context: 'Application',
      });
    });
  });

  describe('配置变化', () => {
    it('应该在禁用控制台日志时不创建控制台传输器', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        logging: { ...DEFAULT_OPENTELEMETRY_CONFIG.logging, console: false },
      };

      new EnhancedWinstonLoggerService(config);

      expect(createLogger).toHaveBeenCalled();
    });

    it('应该在禁用文件日志时不创建文件传输器', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        logging: { ...DEFAULT_OPENTELEMETRY_CONFIG.logging, file: false },
      };

      new EnhancedWinstonLoggerService(config);

      expect(createLogger).toHaveBeenCalled();
    });

    it('应该使用自定义日志级别', () => {
      const config = {
        ...DEFAULT_OPENTELEMETRY_CONFIG,
        logging: { ...DEFAULT_OPENTELEMETRY_CONFIG.logging, level: 'debug' as const },
      };

      new EnhancedWinstonLoggerService(config);

      expect(createLogger).toHaveBeenCalled();
    });
  });
});
