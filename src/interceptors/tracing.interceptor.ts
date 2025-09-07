import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { JsonValue } from 'type-fest';
import { TracingService } from '@/services/tracing.service';
import { TRACE_METADATA_KEY, TraceOptions } from '@/decorators/trace.decorator';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(
    private readonly tracingService: TracingService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<JsonValue> {
    const traceOptions = this.reflector.get<TraceOptions & { originalMethodName: string }>(
      TRACE_METADATA_KEY,
      context.getHandler(),
    );

    // 如果没有追踪元数据，则不进行追踪直接继续
    if (!traceOptions) {
      return next.handle();
    }

    const className = context.getClass().name;
    const methodName = traceOptions.originalMethodName;
    const spanName = traceOptions.name || `${className}.${methodName}`;

    // 获取方法参数
    const args = context.getArgs();
    const attributes = { ...traceOptions.attributes };

    // 添加类和方法信息
    attributes['code.function'] = methodName;
    attributes['code.namespace'] = className;

    // 如果请求则记录参数
    if (traceOptions.recordArgs && args.length > 0) {
      args.forEach((arg, index) => {
        const argName = traceOptions.argNames?.[index] || `arg${index}`;
        if (arg !== null && arg !== undefined) {
          // 序列化复杂对象
          const value = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
          attributes[`args.${argName}`] = value;
        }
      });
    }

    // 为 HTTP 请求添加 HTTP 特定属性
    if (traceOptions.kind === SpanKind.SERVER) {
      const request = context.switchToHttp().getRequest();
      if (request) {
        attributes['http.method'] = request.method;
        attributes['http.url'] = request.url;
        attributes['http.route'] = request.route?.path;
        attributes['http.user_agent'] = request.headers?.['user-agent'];
      }
    }

    const span = this.tracingService.startSpan(spanName, {
      kind: traceOptions.kind || SpanKind.INTERNAL,
      attributes,
    });

    const startTime = Date.now();

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;
        span.setAttribute('operation.duration_ms', duration);

        // 如果请求则记录结果
        if (traceOptions.recordResult && result !== undefined) {
          const resultValue = typeof result === 'object' ? JSON.stringify(result) : String(result);
          span.setAttribute('result', resultValue);
        }

        // 添加 HTTP 响应属性
        if (traceOptions.kind === SpanKind.SERVER) {
          const response = context.switchToHttp().getResponse();
          if (response) {
            span.setAttribute('http.status_code', response.statusCode || 200);
          }
        }

        span.setStatus({ code: SpanStatusCode.OK });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        span.setAttribute('operation.duration_ms', duration);
        span.setAttribute('error.name', error.constructor.name);
        span.setAttribute('error.message', error.message);

        if (error.stack) {
          span.setAttribute('error.stack', error.stack);
        }

        // 添加 HTTP 错误状态
        if (traceOptions.kind === SpanKind.SERVER) {
          const response = context.switchToHttp().getResponse();
          if (response) {
            span.setAttribute('http.status_code', response.statusCode || 500);
          }
        }

        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });

        throw error;
      }),
      finalize(() => {
        span.end();
      }),
    );
  }
}
