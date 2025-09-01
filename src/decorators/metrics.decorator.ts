import { SetMetadata } from '@nestjs/common';
import { Class } from 'type-fest';

export const METRICS_METADATA_KEY = 'otel:metrics';

export interface MetricsOptions {
  /**
   * 方法执行次数计数器名称
   */
  counter?: string;

  /**
   * 方法执行时长直方图名称
   */
  histogram?: string;

  /**
   * 添加到指标的额外属性
   */
  attributes?: Record<string, string | number | boolean>;

  /**
   * 是否将方法参数记录为指标属性
   */
  recordArgs?: boolean;

  /**
   * 参数的自定义属性名称
   */
  argNames?: string[];

  /**
   * 是否将成功/失败状态记录为指标属性
   */
  recordStatus?: boolean;
}

/**
 * 自动收集方法执行指标的装饰器
 *
 * @param options 指标配置选项
 *
 * @example
 * ```typescript
 * @Metrics({
 *   counter: 'user_operations_total',
 *   histogram: 'user_operation_duration_seconds',
 *   attributes: { operation: 'get_user' }
 * })
 * async getUserById(id: string) {
 *   return this.userService.findById(id);
 * }
 * ```
 */
export function Metrics(options: MetricsOptions = {}): MethodDecorator {
  return (target: Class<unknown>, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    // 为拦截器存储元数据
    SetMetadata(METRICS_METADATA_KEY, {
      ...options,
      originalMethodName: String(propertyKey),
    })(target, propertyKey, descriptor);

    return descriptor;
  };
}

/**
 * HTTP 端点指标的装饰器
 */
export function MetricsHttp(
  options: Omit<MetricsOptions, 'counter' | 'histogram'> & {
    counter?: string;
    histogram?: string;
  } = {},
): MethodDecorator {
  return Metrics({
    counter: options.counter || 'http_requests_total',
    histogram: options.histogram || 'http_request_duration_seconds',
    attributes: {
      'operation.type': 'http',
      ...options.attributes,
    },
    recordStatus: true,
    ...options,
  });
}

/**
 * 数据库操作指标的装饰器
 */
export function MetricsDb(
  options: Omit<MetricsOptions, 'counter' | 'histogram'> & {
    counter?: string;
    histogram?: string;
    operation?: string;
    table?: string;
  } = {},
): MethodDecorator {
  const { operation, table, ...metricsOptions } = options;

  return Metrics({
    counter: metricsOptions.counter || 'db_operations_total',
    histogram: metricsOptions.histogram || 'db_operation_duration_seconds',
    attributes: {
      'operation.type': 'database',
      ...(operation && { 'db.operation': operation }),
      ...(table && { 'db.name': table }),
      ...metricsOptions.attributes,
    },
    recordStatus: true,
    ...metricsOptions,
  });
}

/**
 * 业务操作指标的装饰器
 */
export function MetricsBusiness(
  options: Omit<MetricsOptions, 'counter' | 'histogram'> & {
    counter?: string;
    histogram?: string;
    operation?: string;
  } = {},
): MethodDecorator {
  const { operation, ...metricsOptions } = options;

  return Metrics({
    counter: metricsOptions.counter || 'business_operations_total',
    histogram: metricsOptions.histogram || 'business_operation_duration_seconds',
    attributes: {
      'operation.type': 'business',
      ...(operation && { 'business.operation': operation }),
      ...metricsOptions.attributes,
    },
    recordStatus: true,
    ...metricsOptions,
  });
}
