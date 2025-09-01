// 主模块
export {
  OpenTelemetryModule,
  createOpenTelemetryConfigFromEnv,
  DEFAULT_OPENTELEMETRY_CONFIG,
} from './opentelemetry.module';

// 接口
export type {
  OpenTelemetryConfig,
  OpenTelemetryModuleOptions,
  OpenTelemetryModuleAsyncOptions,
} from './interfaces/opentelemetry-config.interface';

// 服务
export { EnhancedWinstonLoggerService } from './services/logger.service';
export { MetricsService } from './services/metrics.service';
export { TracingService } from './services/tracing.service';
export { OpenTelemetryService } from './services/opentelemetry.service';

// 装饰器
export {
  Trace,
  TraceHttp,
  TraceDb,
  TraceExternal,
  TraceBusiness,
  TRACE_METADATA_KEY,
  type TraceOptions,
} from './decorators/trace.decorator';

export {
  Metrics,
  MetricsHttp,
  MetricsDb,
  MetricsBusiness,
  METRICS_METADATA_KEY,
  type MetricsOptions,
} from './decorators/metrics.decorator';

// 拦截器
export { TracingInterceptor } from './interceptors/tracing.interceptor';
export { MetricsInterceptor } from './interceptors/metrics.interceptor';
