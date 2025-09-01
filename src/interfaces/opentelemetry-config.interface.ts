export interface OpenTelemetryConfig {
  /**
   * OpenTelemetry 应用名称
   */
  serviceName: string;

  /**
   * 应用版本
   */
  serviceVersion?: string;

  /**
   * 环境名称 (例如: 'production', 'development', 'staging')
   */
  environment?: string;

  /**
   * OTLP 端点，用于发送追踪和指标数据
   */
  otlpEndpoint?: string;

  /**
   * Jaeger 端点，用于发送追踪数据
   */
  jaegerEndpoint?: string;

  /**
   * Prometheus 指标端点
   */
  prometheusEndpoint?: string;

  /**
   * 日志配置
   */
  logging?: {
    /**
     * 启用控制台日志输出
     */
    console?: boolean;

    /**
     * 启用文件日志输出
     */
    file?: boolean;

    /**
     * 日志文件目录路径
     */
    logDir?: string;

    /**
     * 日志级别
     */
    level?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';

    /**
     * 单个日志文件最大大小
     */
    maxSize?: string;

    /**
     * 保留的最大日志文件数
     */
    maxFiles?: string;

    /**
     * 日志文件轮转的日期格式
     */
    datePattern?: string;
  };

  /**
   * 链路追踪配置
   */
  tracing?: {
    /**
     * 启用链路追踪
     */
    enabled?: boolean;

    /**
     * 采样率 (0.0 到 1.0)
     */
    sampleRate?: number;
  };

  /**
   * 指标收集配置
   */
  metrics?: {
    /**
     * 启用指标收集
     */
    enabled?: boolean;

    /**
     * 指标收集间隔时间（毫秒）
     */
    interval?: number;
  };
}

export interface OpenTelemetryModuleOptions {
  /** OpenTelemetry 配置 */
  config: OpenTelemetryConfig;
}

export interface OpenTelemetryModuleAsyncOptions {
  /** 异步配置工厂函数 */
  useFactory: (...args: unknown[]) => Promise<OpenTelemetryConfig> | OpenTelemetryConfig;
  /** 注入的依赖 */
  inject?: unknown[];
}
