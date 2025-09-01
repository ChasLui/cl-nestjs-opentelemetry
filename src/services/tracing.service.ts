import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { trace, Tracer, Span, SpanStatusCode, SpanKind, context, Context, SpanOptions } from '@opentelemetry/api';
import { OpenTelemetryConfig } from '@/interfaces/opentelemetry-config.interface';

const OPENTELEMETRY_CONFIG = 'OPENTELEMETRY_CONFIG';

@Injectable()
export class TracingService implements OnModuleInit {
  private tracer: Tracer;

  constructor(@Inject(OPENTELEMETRY_CONFIG) private readonly config: OpenTelemetryConfig) {
    if (this.config.tracing?.enabled !== false) {
      this.tracer = trace.getTracer(this.config.serviceName, this.config.serviceVersion || '1.0.0');
    }
  }

  onModuleInit() {
    // 追踪器在构造函数中初始化
  }

  /**
   * 开始一个新的 Span
   */
  startSpan(
    name: string,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
      parent?: Context;
    },
  ): Span {
    if (!this.tracer) {
      return trace.getActiveSpan() || trace.getTracer('noop').startSpan(name);
    }

    const spanOptions: SpanOptions = {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes || {},
    };

    if (options?.parent) {
      return this.tracer.startSpan(name, spanOptions, options.parent);
    }

    return this.tracer.startSpan(name, spanOptions);
  }

  /**
   * 从当前活跃的 Span 开始一个子 Span
   */
  startChildSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
    return this.startSpan(name, {
      attributes,
      parent: context.active(),
    });
  }

  /**
   * 在 Span 上下文中执行函数
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    },
  ): Promise<T> {
    const span = this.startSpan(name, options);

    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return await fn(span);
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * 在 Span 上下文中执行同步函数
   */
  withSpanSync<T>(
    name: string,
    fn: (span: Span) => T,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    },
  ): T {
    const span = this.startSpan(name, options);

    try {
      const result = context.with(trace.setSpan(context.active(), span), () => {
        return fn(span);
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * 获取当前活跃的 Span
   */
  getActiveSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * 向当前活跃的 Span 添加属性
   */
  addAttributes(attributes: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttributes(attributes);
    }
  }

  /**
   * 向当前活跃的 Span 添加单个属性
   */
  addAttribute(key: string, value: string | number | boolean): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttribute(key, value);
    }
  }

  /**
   * 向当前活跃的 Span 添加事件
   */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent(name, attributes);
    }
  }

  /**
   * 在当前活跃的 Span 中记录异常
   */
  recordException(exception: Error): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.recordException(exception);
      activeSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: exception.message,
      });
    }
  }

  /**
   * 设置当前活跃 Span 的状态
   */
  setStatus(code: SpanStatusCode, message?: string): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setStatus({ code, message });
    }
  }

  /**
   * 为 HTTP 请求创建 Span
   */
  startHttpSpan(
    method: string,
    url: string,
    options?: {
      attributes?: Record<string, string | number | boolean>;
      kind?: SpanKind;
    },
  ): Span {
    const spanName = `${method} ${url}`;
    const attributes = {
      'http.method': method,
      'http.url': url,
      'http.scheme': url.startsWith('https') ? 'https' : 'http',
      ...options?.attributes,
    };

    return this.startSpan(spanName, {
      kind: options?.kind || SpanKind.CLIENT,
      attributes,
    });
  }

  /**
   * 为数据库操作创建 Span
   */
  startDbSpan(
    operation: string,
    table: string,
    options?: {
      query?: string;
      attributes?: Record<string, string | number | boolean>;
    },
  ): Span {
    const spanName = `${operation} ${table}`;
    const attributes = {
      'db.operation': operation,
      'db.name': table,
      'db.system': 'unknown',
      ...options?.attributes,
    };

    if (options?.query) {
      attributes['db.statement'] = options.query;
    }

    return this.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes,
    });
  }

  /**
   * 为业务操作创建 Span
   */
  startBusinessSpan(operation: string, attributes?: Record<string, string | number | boolean>): Span {
    return this.startSpan(operation, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'operation.type': 'business',
        ...attributes,
      },
    });
  }

  /**
   * 获取当前追踪 ID
   */
  getCurrentTraceId(): string | undefined {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      return activeSpan.spanContext().traceId;
    }
    return undefined;
  }

  /**
   * 获取当前 Span ID
   */
  getCurrentSpanId(): string | undefined {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      return activeSpan.spanContext().spanId;
    }
    return undefined;
  }

  /**
   * 获取追踪器实例
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * 创建手动 Span（需要手动结束）
   */
  createSpan(
    name: string,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    },
  ): Span {
    return this.startSpan(name, options);
  }
}
