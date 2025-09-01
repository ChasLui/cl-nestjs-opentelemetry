import { SetMetadata } from '@nestjs/common';
import { SpanKind } from '@opentelemetry/api';
import { Class } from 'type-fest';

export const TRACE_METADATA_KEY = 'otel:trace';

export interface TraceOptions {
  /**
   * 自定义 Span 名称，如果未提供则使用方法名
   */
  name?: string;

  /**
   * Span 类型
   */
  kind?: SpanKind;

  /**
   * 添加到 Span 的额外属性
   */
  attributes?: Record<string, string | number | boolean>;

  /**
   * 是否将方法参数记录为 Span 属性
   */
  recordArgs?: boolean;

  /**
   * 是否将方法结果记录为 Span 属性
   */
  recordResult?: boolean;

  /**
   * 参数的自定义属性名称
   */
  argNames?: string[];
}

/**
 * 自动追踪方法执行的装饰器
 *
 * @param options 追踪配置选项
 *
 * @example
 * ```typescript
 * @Trace()
 * async getUserById(id: string) {
 *   return this.userService.findById(id);
 * }
 *
 * @Trace({
 *   name: '自定义-span-名称',
 *   attributes: { 'operation.type': 'database' },
 *   recordArgs: true
 * })
 * async createUser(userData: CreateUserDto) {
 *   return this.userService.create(userData);
 * }
 * ```
 */
export function Trace(options: TraceOptions = {}): MethodDecorator {
  return (target: Class<unknown>, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    // 为拦截器存储元数据
    SetMetadata(TRACE_METADATA_KEY, {
      ...options,
      originalMethodName: String(propertyKey),
    })(target, propertyKey, descriptor);

    return descriptor;
  };
}

/**
 * HTTP 操作的装饰器
 */
export function TraceHttp(options: Omit<TraceOptions, 'kind'> = {}): MethodDecorator {
  return Trace({
    ...options,
    kind: SpanKind.SERVER,
    attributes: {
      'operation.type': 'http',
      ...options.attributes,
    },
  });
}

/**
 * 数据库操作的装饰器
 */
export function TraceDb(
  options: Omit<TraceOptions, 'kind'> & {
    operation?: string;
    table?: string;
  } = {},
): MethodDecorator {
  const { operation, table, ...traceOptions } = options;

  return Trace({
    ...traceOptions,
    kind: SpanKind.CLIENT,
    attributes: {
      'operation.type': 'database',
      ...(operation && { 'db.operation': operation }),
      ...(table && { 'db.name': table }),
      ...traceOptions.attributes,
    },
  });
}

/**
 * 外部服务调用的装饰器
 */
export function TraceExternal(
  options: Omit<TraceOptions, 'kind'> & {
    service?: string;
  } = {},
): MethodDecorator {
  const { service, ...traceOptions } = options;

  return Trace({
    ...traceOptions,
    kind: SpanKind.CLIENT,
    attributes: {
      'operation.type': 'external',
      ...(service && { 'external.service': service }),
      ...traceOptions.attributes,
    },
  });
}

/**
 * 业务逻辑操作的装饰器
 */
export function TraceBusiness(options: Omit<TraceOptions, 'kind'> = {}): MethodDecorator {
  return Trace({
    ...options,
    kind: SpanKind.INTERNAL,
    attributes: {
      'operation.type': 'business',
      ...options.attributes,
    },
  });
}
