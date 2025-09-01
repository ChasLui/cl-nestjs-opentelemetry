import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { Meter, Counter, Histogram, Gauge, metrics, ValueType } from '@opentelemetry/api';
import { OpenTelemetryConfig } from '@/interfaces/opentelemetry-config.interface';

const OPENTELEMETRY_CONFIG = 'OPENTELEMETRY_CONFIG';

@Injectable()
export class MetricsService implements OnModuleInit {
  private meter: Meter;
  private counters: Map<string, Counter> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private gauges: Map<string, Gauge> = new Map();

  // 通用指标
  private httpRequestsTotal: Counter;
  private httpRequestDuration: Histogram;
  private activeConnections: Gauge;
  private errorCounter: Counter;
  private businessMetrics: Counter;

  constructor(@Inject(OPENTELEMETRY_CONFIG) private readonly config: OpenTelemetryConfig) {
    if (this.config.metrics?.enabled !== false) {
      this.meter = metrics.getMeter(this.config.serviceName, this.config.serviceVersion || '1.0.0');
    }
  }

  onModuleInit() {
    if (!this.meter) return;

    // 初始化通用指标
    this.initializeCommonMetrics();
  }

  private initializeCommonMetrics(): void {
    // HTTP 请求计数器
    this.httpRequestsTotal = this.meter.createCounter('http_requests_total', {
      description: 'HTTP 请求总数',
      unit: '1',
    });

    // HTTP 请求持续时间直方图
    this.httpRequestDuration = this.meter.createHistogram('http_request_duration_seconds', {
      description: 'HTTP 请求持续时间（秒）',
      unit: 's',
    });

    // 活跃连接数量表
    this.activeConnections = this.meter.createGauge('active_connections', {
      description: '活跃连接数',
      unit: '1',
    });

    // 错误计数器
    this.errorCounter = this.meter.createCounter('errors_total', {
      description: '错误总数',
      unit: '1',
    });

    // 业务指标计数器
    this.businessMetrics = this.meter.createCounter('business_events_total', {
      description: '业务事件总数',
      unit: '1',
    });

    // 存储到映射中以便访问
    this.counters.set('http_requests_total', this.httpRequestsTotal);
    this.counters.set('errors_total', this.errorCounter);
    this.counters.set('business_events_total', this.businessMetrics);
    this.histograms.set('http_request_duration_seconds', this.httpRequestDuration);
    this.gauges.set('active_connections', this.activeConnections);
  }

  /**
   * 创建或获取计数器指标
   */
  createCounter(name: string, description?: string, unit?: string): Counter {
    if (!this.meter) {
      throw new Error('指标已禁用或测量器未初始化');
    }

    if (this.counters.has(name)) {
      return this.counters.get(name)!;
    }

    const counter = this.meter.createCounter(name, {
      description: description || `${name} 的计数器`,
      unit: unit || '1',
    });

    this.counters.set(name, counter);
    return counter;
  }

  /**
   * 创建或获取直方图指标
   */
  createHistogram(name: string, description?: string, unit?: string): Histogram {
    if (!this.meter) {
      throw new Error('指标已禁用或测量器未初始化');
    }

    if (this.histograms.has(name)) {
      return this.histograms.get(name)!;
    }

    const histogram = this.meter.createHistogram(name, {
      description: description || `${name} 的直方图`,
      unit: unit || '1',
    });

    this.histograms.set(name, histogram);
    return histogram;
  }

  /**
   * 创建或获取仪表盘指标
   */
  createGauge(name: string, description?: string, unit?: string): Gauge {
    if (!this.meter) {
      throw new Error('指标已禁用或测量器未初始化');
    }

    if (this.gauges.has(name)) {
      return this.gauges.get(name)!;
    }

    const gauge = this.meter.createGauge(name, {
      description: description || `${name} 的仪表盘`,
      unit: unit || '1',
      valueType: ValueType.DOUBLE,
    });

    this.gauges.set(name, gauge);
    return gauge;
  }

  /**
   * 增加 HTTP 请求计数
   */
  incrementHttpRequests(method: string, route: string, statusCode: number): void {
    if (this.httpRequestsTotal) {
      this.httpRequestsTotal.add(1, {
        method,
        route,
        status_code: statusCode.toString(),
      });
    }
  }

  /**
   * 记录 HTTP 请求持续时间
   */
  recordHttpRequestDuration(duration: number, method: string, route: string, statusCode: number): void {
    if (this.httpRequestDuration) {
      this.httpRequestDuration.record(duration / 1000, {
        // 转换为秒
        method,
        route,
        status_code: statusCode.toString(),
      });
    }
  }

  /**
   * 设置活跃连接数
   */
  setActiveConnections(count: number): void {
    if (this.activeConnections) {
      this.activeConnections.record(count);
    }
  }

  /**
   * 增加错误计数
   */
  incrementErrors(errorType: string, context?: string): void {
    if (this.errorCounter) {
      this.errorCounter.add(1, {
        error_type: errorType,
        context: context || 'unknown',
      });
    }
  }

  /**
   * 记录业务事件
   */
  recordBusinessEvent(eventType: string, value: number = 1, attributes?: Record<string, string>): void {
    if (this.businessMetrics) {
      this.businessMetrics.add(value, {
        event_type: eventType,
        ...attributes,
      });
    }
  }

  /**
   * 增加自定义计数器
   */
  incrementCounter(name: string, value: number = 1, attributes?: Record<string, string | number>): void {
    const counter = this.counters.get(name);
    if (counter) {
      counter.add(value, attributes);
    }
  }

  /**
   * 记录直方图值
   */
  recordHistogram(name: string, value: number, attributes?: Record<string, string | number>): void {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.record(value, attributes);
    }
  }

  /**
   * 设置仪表盘值
   */
  setGauge(name: string, value: number, attributes?: Record<string, string | number>): void {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.record(value, attributes);
    }
  }

  /**
   * 获取测量器实例
   */
  getMeter(): Meter {
    return this.meter;
  }

  /**
   * 获取所有已注册的计数器
   */
  getCounters(): Map<string, Counter> {
    return this.counters;
  }

  /**
   * 获取所有已注册的直方图
   */
  getHistograms(): Map<string, Histogram> {
    return this.histograms;
  }

  /**
   * 获取所有已注册的仪表盘
   */
  getGauges(): Map<string, Gauge> {
    return this.gauges;
  }
}
