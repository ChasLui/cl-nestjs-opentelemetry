import { Injectable, LoggerService, Inject } from '@nestjs/common';
import { createLogger, Logger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { JsonValue } from 'type-fest';
import { OpenTelemetryConfig } from '@/interfaces/opentelemetry-config.interface';

const OPENTELEMETRY_CONFIG = 'OPENTELEMETRY_CONFIG';

@Injectable()
export class EnhancedWinstonLoggerService implements LoggerService {
  private readonly logger: Logger;
  private contextName = 'Application';

  constructor(@Inject(OPENTELEMETRY_CONFIG) private readonly config: OpenTelemetryConfig) {
    this.logger = this.createWinstonLogger();
  }

  private createWinstonLogger(): Logger {
    const logConfig = this.config.logging || {};
    const logDir = logConfig.logDir || './logs';
    const level = logConfig.level || 'info';

    const logFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.json(),
      format.printf(({ timestamp, level, message, context, trace: _traceInfo, ...meta }) => {
        const logEntry: Record<string, JsonValue> = {
          timestamp,
          level,
          message,
          service: this.config.serviceName,
          version: this.config.serviceVersion,
          environment: this.config.environment,
          context: context || this.contextName,
          ...meta,
        };

        // 添加 OpenTelemetry 追踪上下文
        const activeSpan = trace.getActiveSpan();
        if (activeSpan) {
          const spanContext = activeSpan.spanContext();
          logEntry.traceId = spanContext.traceId;
          logEntry.spanId = spanContext.spanId;
        }

        return JSON.stringify(logEntry);
      }),
    );

    const transportsList: (transports.ConsoleTransportInstance | DailyRotateFile)[] = [];

    // 控制台传输器
    if (logConfig.console !== false) {
      transportsList.push(
        new transports.Console({
          level,
          format: format.combine(
            format.colorize(),
            format.simple(),
            format.printf(({ timestamp, level, message, context }) => {
              return `${timestamp} [${level}] [${context || this.contextName}] ${message}`;
            }),
          ),
        }),
      );
    }

    // 文件传输器
    if (logConfig.file !== false) {
      transportsList.push(
        new DailyRotateFile({
          filename: `${logDir}/application-%DATE%.log`,
          datePattern: logConfig.datePattern || 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: logConfig.maxSize || '20m',
          maxFiles: logConfig.maxFiles || '14d',
          level,
          format: logFormat,
        }),
      );

      // 错误日志文件
      transportsList.push(
        new DailyRotateFile({
          filename: `${logDir}/error-%DATE%.log`,
          datePattern: logConfig.datePattern || 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: logConfig.maxSize || '20m',
          maxFiles: logConfig.maxFiles || '14d',
          level: 'error',
          format: logFormat,
        }),
      );
    }

    return createLogger({
      level,
      format: logFormat,
      transports: transportsList,
      exitOnError: false,
    });
  }

  setContext(context: string): void {
    this.contextName = context;
  }

  log(message: unknown, context?: string): void {
    this.info(message, context);
  }

  info(message: unknown, context?: string): void {
    this.logger.info(message, { context: context || this.contextName });
  }

  error(message: unknown, traceStack?: string, context?: string): void {
    // 如果存在活跃的 span，则添加错误信息
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.recordException(new Error(message));
      activeSpan.setStatus({ code: SpanStatusCode.ERROR, message });
    }

    this.logger.error(message, {
      context: context || this.contextName,
      trace: traceStack,
      stack: traceStack,
    });
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(message, { context: context || this.contextName });
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(message, { context: context || this.contextName });
  }

  verbose(message: unknown, context?: string): void {
    this.logger.verbose(message, { context: context || this.contextName });
  }

  /**
   * 使用自定义元数据记录日志
   */
  logWithMeta(level: string, message: string, meta: Record<string, JsonValue> = {}, context?: string): void {
    this.logger.log(level, message, {
      context: context || this.contextName,
      ...meta,
    });
  }

  /**
   * 记录 HTTP 请求日志
   */
  logHttpRequest(method: string, url: string, statusCode: number, responseTime: number, context?: string): void {
    this.info(`${method} ${url} ${statusCode} - ${responseTime}ms`, context || 'HTTP');
  }

  /**
   * 记录数据库查询日志
   */
  logDbQuery(query: string, duration: number, context?: string): void {
    this.debug(`数据库查询: ${query} - ${duration}ms`, context || 'Database');
  }

  /**
   * 获取 Winston 日志实例
   */
  getWinstonLogger(): Logger {
    return this.logger;
  }
}
