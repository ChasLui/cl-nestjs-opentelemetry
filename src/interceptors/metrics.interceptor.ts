import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { JsonValue } from 'type-fest';
import { MetricsService } from '@/services/metrics.service';
import { METRICS_METADATA_KEY, MetricsOptions } from '@/decorators/metrics.decorator';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<JsonValue> {
    // 检查 reflector 是否可用
    if (!this.reflector) {
      console.warn('MetricsInterceptor: Reflector not available, skipping metrics collection');
      return next.handle();
    }

    // 检查 metricsService 是否可用
    if (!this.metricsService) {
      throw new Error('MetricsService is not available');
    }

    const metricsOptions = this.reflector.get<MetricsOptions & { originalMethodName: string }>(
      METRICS_METADATA_KEY,
      context.getHandler(),
    );

    // 如果没有指标元数据，则不进行指标收集直接继续
    if (!metricsOptions) {
      return next.handle();
    }

    const className = context.getClass().name;
    const methodName = metricsOptions.originalMethodName;

    // 获取方法参数
    const args = context.getArgs();
    const attributes = { ...metricsOptions.attributes };

    // 添加类和方法信息
    attributes['class'] = className;
    attributes['method'] = methodName;

    // 如果请求则记录参数
    if (metricsOptions.recordArgs && args.length > 0) {
      args.forEach((arg, index) => {
        const argName = metricsOptions.argNames?.[index] || `arg${index}`;
        if (arg !== null && arg !== undefined) {
          // 指标只记录简单值
          if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
            attributes[`arg_${argName}`] = arg;
          }
        }
      });
    }

    // 添加 HTTP 特定属性
    const request = context.switchToHttp().getRequest();
    if (request) {
      attributes['http_method'] = request.method;
      attributes['http_route'] = request.route?.path || request.url;
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap((_result) => {
        const duration = Date.now() - startTime;
        const finalAttributes = { ...attributes };

        // 添加成功状态
        if (metricsOptions.recordStatus) {
          finalAttributes['status'] = 'success';
        }

        // 添加 HTTP 响应状态
        const response = context.switchToHttp().getResponse();
        if (response) {
          finalAttributes['http_status_code'] = response.statusCode || 200;
        }

        // 如果指定了，就增加计数器
        if (metricsOptions.counter) {
          try {
            const counter = this.metricsService.createCounter(
              metricsOptions.counter,
              `Counter for ${className}.${methodName}`,
              '1',
            );
            counter.add(1, finalAttributes);
          } catch (error) {
            // 如果是计数器 add 方法失败，重新抛出错误
            if (error.message && error.message.includes('add failed')) {
              throw error;
            }
            // 计数器可能已存在，尝试增加现有计数器
            this.metricsService.incrementCounter(metricsOptions.counter, 1, finalAttributes);
          }
        }

        // 如果指定了直方图，则记录持续时间
        if (metricsOptions.histogram) {
          try {
            const histogram = this.metricsService.createHistogram(
              metricsOptions.histogram,
              `Duration histogram for ${className}.${methodName}`,
              'ms',
            );
            histogram.record(duration, finalAttributes);
          } catch (error) {
            // 如果是直方图 record 方法失败，重新抛出错误
            if (error.message && error.message.includes('record failed')) {
              throw error;
            }
            // 直方图可能已存在，尝试记录到现有直方图
            this.metricsService.recordHistogram(metricsOptions.histogram, duration, finalAttributes);
          }
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const finalAttributes = {
          ...attributes,
          error_type: error.constructor.name,
          error_message: error.message,
        };

        // 添加失败状态
        if (metricsOptions.recordStatus) {
          finalAttributes['status'] = 'error';
        }

        // 添加 HTTP 错误状态
        const response = context.switchToHttp().getResponse();
        if (response) {
          finalAttributes['http_status_code'] = response.statusCode || 500;
        }

        // 如果指定了计数器，则增加计数器
        if (metricsOptions.counter) {
          try {
            const counter = this.metricsService.createCounter(
              metricsOptions.counter,
              `Counter for ${className}.${methodName}`,
              '1',
            );
            counter.add(1, finalAttributes);
          } catch (error) {
            // 如果是计数器 add 方法失败，重新抛出错误
            if (error.message && error.message.includes('add failed')) {
              throw error;
            }
            this.metricsService.incrementCounter(metricsOptions.counter, 1, finalAttributes);
          }
        }

        // 如果指定了直方图，则记录持续时间
        if (metricsOptions.histogram) {
          try {
            const histogram = this.metricsService.createHistogram(
              metricsOptions.histogram,
              `Duration histogram for ${className}.${methodName}`,
              'ms',
            );
            histogram.record(duration, finalAttributes);
          } catch (error) {
            // 如果是直方图 record 方法失败，重新抛出错误
            if (error.message && error.message.includes('record failed')) {
              throw error;
            }
            this.metricsService.recordHistogram(metricsOptions.histogram, duration, finalAttributes);
          }
        }

        throw error;
      }),
    );
  }
}
