<p align="center">
  <a href="http://nestjs.com"><img alt="Nest Logo" src="https://nestjs.com/img/logo-small.svg" width="120"></a>
</p>

<h1 align="center">
  cl-nestjs-opentelemetry
</h1>

[![npm version](https://badge.fury.io/js/cl-nestjs-opentelemetry.svg)](https://badge.fury.io/js/cl-nestjs-opentelemetry)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/ChasLui/cl-nestjs-opentelemetry/workflows/%F0%9F%94%A7%20CI%20-%20Build%20%26%20Test/badge.svg)](https://github.com/ChasLui/cl-nestjs-opentelemetry/actions)
[![codecov](https://codecov.io/github/ChasLui/cl-nestjs-opentelemetry/graph/badge.svg?token=HKXSC0QQEY)](https://codecov.io/github/ChasLui/cl-nestjs-opentelemetry)

> 一个全面的 NestJS OpenTelemetry 集成库，提供日志记录、指标收集和分布式链路追踪功能。

## 特性

- 🚀 **完整的 OpenTelemetry 集成** - 支持追踪、指标和日志三大支柱
- 📝 **增强的 Winston 日志** - 自动集成 OpenTelemetry 上下文和结构化日志
- 📊 **自动指标收集** - HTTP 请求、业务事件、错误统计和自定义指标
- 🔍 **分布式链路追踪** - 自动和手动链路追踪，支持装饰器模式
- 🎯 **装饰器支持** - 使用装饰器轻松添加追踪和指标收集
- ⚙️ **灵活配置** - 支持环境变量、静态配置和异步配置
- 📁 **文件日志轮转** - 自动日志文件管理和轮转
- 🐳 **Kubernetes 友好** - 专为容器化环境设计
- 🔧 **TypeScript 支持** - 完整的类型定义和智能提示
- ✅ **高质量代码** - 98.35% 测试覆盖率，290 个测试用例

## 项目结构

```txt
src/
├── index.ts                    # 统一导出入口
├── opentelemetry.module.ts     # OpenTelemetry 模块定义
├── interfaces/
│   └── opentelemetry-config.interface.ts  # 配置接口定义
├── services/
│   ├── logger.service.ts       # 增强的 Winston 日志服务
│   ├── metrics.service.ts      # 指标收集服务
│   ├── tracing.service.ts      # 链路追踪服务
│   └── opentelemetry.service.ts # OpenTelemetry 核心服务
├── decorators/
│   ├── trace.decorator.ts      # 追踪装饰器
│   └── metrics.decorator.ts    # 指标装饰器
└── interceptors/
    ├── tracing.interceptor.ts  # 追踪拦截器
    └── metrics.interceptor.ts  # 指标拦截器
```

## 安装

```bash
npm install cl-nestjs-opentelemetry
# 或
yarn add cl-nestjs-opentelemetry
# 或
pnpm add cl-nestjs-opentelemetry
```

**环境要求：**

- Node.js >= 18.0.0
- NestJS >= 9.0.0

## 快速开始

### 1. 基础配置

```typescript
import { Module } from '@nestjs/common';
import { OpenTelemetryModule } from 'cl-nestjs-opentelemetry';

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      config: {
        serviceName: 'my-nestjs-app',
        serviceVersion: '1.0.0',
        environment: 'production',
        logging: {
          console: true,
          file: true,
          logDir: './logs',
          level: 'info',
        },
        tracing: {
          enabled: true,
          sampleRate: 1.0,
        },
        metrics: {
          enabled: true,
          interval: 30000,
        },
      },
    }),
  ],
})
export class AppModule {}
```

### 2. 使用环境变量配置

```typescript
import { OpenTelemetryModule, createOpenTelemetryConfigFromEnv } from 'cl-nestjs-opentelemetry';

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      config: createOpenTelemetryConfigFromEnv(),
    }),
  ],
})
export class AppModule {}
```

### 3. 异步配置

```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenTelemetryModule } from 'cl-nestjs-opentelemetry';

@Module({
  imports: [
    ConfigModule.forRoot(),
    OpenTelemetryModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        serviceName: configService.get('APP_NAME'),
        serviceVersion: configService.get('APP_VERSION'),
        environment: configService.get('NODE_ENV'),
        otlpEndpoint: configService.get('OTEL_EXPORTER_OTLP_ENDPOINT'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## 使用示例

### 服务中使用追踪和指标

```typescript
import { Injectable } from '@nestjs/common';
import { EnhancedWinstonLoggerService, TracingService, MetricsService, Trace, Metrics } from 'cl-nestjs-opentelemetry';

@Injectable()
export class UserService {
  constructor(
    private readonly logger: EnhancedWinstonLoggerService,
    private readonly tracingService: TracingService,
    private readonly metricsService: MetricsService,
  ) {
    this.logger.setContext('UserService');
  }

  @Trace({ name: 'get-user-by-id', recordArgs: true })
  @Metrics({
    counter: 'user_operations_total',
    histogram: 'user_operation_duration_ms',
  })
  async getUserById(id: string) {
    this.logger.info(`根据 ID 获取用户: ${id}`);

    // 添加自定义属性到当前 span
    this.tracingService.addAttribute('user.id', id);

    // 模拟数据库查询
    return await this.tracingService.withSpan('database-query', async (span) => {
      span.setAttributes({
        'db.operation': 'select',
        'db.table': 'users',
        'db.system': 'postgresql',
      });

      // 数据库操作...
      const user = await this.findUserInDatabase(id);
      return user;
    });
  }

  @Trace({ name: 'create-user', recordArgs: true, recordResult: true })
  @Metrics({ counter: 'user_creations_total', histogram: 'user_creation_duration_ms' })
  async createUser(userData: any) {
    this.logger.info('创建新用户', userData);

    // 记录业务指标
    this.metricsService.recordBusinessEvent('user_created', 1, {
      'user.type': userData.type,
    });

    // 创建用户逻辑...
    return newUser;
  }
}
```

### 控制器中使用

```typescript
import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { TraceHttp, MetricsHttp, EnhancedWinstonLoggerService } from 'cl-nestjs-opentelemetry';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: EnhancedWinstonLoggerService,
  ) {
    this.logger.setContext('UserController');
  }

  @Get(':id')
  @TraceHttp({ name: 'get-user-endpoint' })
  @MetricsHttp()
  async getUser(@Param('id') id: string) {
    this.logger.info(`GET /users/${id}`);
    return this.userService.getUserById(id);
  }

  @Post()
  @TraceHttp({ name: 'create-user-endpoint' })
  @MetricsHttp()
  async createUser(@Body() userData: any) {
    this.logger.info('POST /users', userData);
    return this.userService.createUser(userData);
  }
}
```

## 配置选项

### 环境变量

```bash
# 服务信息
OTEL_SERVICE_NAME=my-app
OTEL_SERVICE_VERSION=1.0.0
NODE_ENV=production

# 导出器端点
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
OTEL_EXPORTER_PROMETHEUS_ENDPOINT=http://localhost:9464

# 日志配置
OTEL_LOG_CONSOLE=true
OTEL_LOG_FILE=true
OTEL_LOG_DIR=./logs
OTEL_LOG_LEVEL=info
OTEL_LOG_MAX_SIZE=20m
OTEL_LOG_MAX_FILES=14d
OTEL_LOG_DATE_PATTERN=YYYY-MM-DD

# 追踪配置
OTEL_TRACING_ENABLED=true
OTEL_TRACING_SAMPLE_RATE=1.0

# 指标配置
OTEL_METRICS_ENABLED=true
OTEL_METRICS_INTERVAL=30000
```

### 配置接口

```typescript
export interface OpenTelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  otlpEndpoint?: string;
  jaegerEndpoint?: string;
  prometheusEndpoint?: string;

  logging?: {
    console?: boolean;
    file?: boolean;
    logDir?: string;
    level?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
    maxSize?: string;
    maxFiles?: string;
    datePattern?: string;
  };

  tracing?: {
    enabled?: boolean;
    sampleRate?: number;
  };

  metrics?: {
    enabled?: boolean;
    interval?: number;
  };
}
```

## 装饰器

### 追踪装饰器

- `@Trace(options?)` - 基础追踪装饰器
- `@TraceHttp(options?)` - HTTP 操作追踪
- `@TraceDb(options?)` - 数据库操作追踪
- `@TraceExternal(options?)` - 外部服务调用追踪
- `@TraceBusiness(options?)` - 业务逻辑追踪

### 指标装饰器

- `@Metrics(options?)` - 基础指标装饰器
- `@MetricsHttp(options?)` - HTTP 操作指标
- `@MetricsDb(options?)` - 数据库操作指标
- `@MetricsBusiness(options?)` - 业务操作指标

## API 文档

### OpenTelemetryModule

#### `forRoot(options: OpenTelemetryModuleOptions)`

使用静态配置注册 OpenTelemetry 模块。

#### `forRootAsync(options: OpenTelemetryModuleAsyncOptions)`

使用异步配置注册 OpenTelemetry 模块。

#### `forFeature(config: Partial<OpenTelemetryConfig>)`

创建功能模块，适用于需要不同配置的微服务。

### 装饰器选项

#### TraceOptions

```typescript
interface TraceOptions {
  name?: string; // 自定义 Span 名称
  kind?: SpanKind; // Span 类型
  attributes?: Record<string, any>; // 额外属性
  recordArgs?: boolean; // 是否记录方法参数
  recordResult?: boolean; // 是否记录方法结果
  argNames?: string[]; // 参数的自定义属性名称
}
```

#### MetricsOptions

```typescript
interface MetricsOptions {
  counter?: string; // 计数器名称
  histogram?: string; // 直方图名称
  attributes?: Record<string, any>; // 额外属性
  recordArgs?: boolean; // 是否记录方法参数
  argNames?: string[]; // 参数的自定义属性名称
  recordStatus?: boolean; // 是否记录成功/失败状态
}
```

## 服务

### EnhancedWinstonLoggerService

增强的日志服务，自动包含 OpenTelemetry 上下文信息：

```typescript
constructor(private readonly logger: EnhancedWinstonLoggerService) {
  this.logger.setContext('MyService');
}

// 基础日志方法
this.logger.info('信息消息');
this.logger.warn('警告消息');
this.logger.error('错误消息', error.stack);
this.logger.debug('调试消息');

// 带元数据的日志
this.logger.logWithMeta('info', '消息', { key: 'value' });

// HTTP 请求日志
this.logger.logHttpRequest('GET', '/api/users', 200, 150);

// 数据库查询日志
this.logger.logDbQuery('SELECT * FROM users', 50);
```

### MetricsService

指标收集服务，提供完整的指标管理功能：

```typescript
constructor(private readonly metricsService: MetricsService) {}

// 创建指标
const counter = this.metricsService.createCounter('my_counter', '描述');
const histogram = this.metricsService.createHistogram('my_histogram', '描述');
const gauge = this.metricsService.createGauge('my_gauge', '描述');

// 记录指标
this.metricsService.incrementCounter('my_counter', 1, { label: 'value' });
this.metricsService.recordHistogram('my_histogram', 100, { label: 'value' });
this.metricsService.setGauge('my_gauge', 50, { label: 'value' });

// HTTP 指标
this.metricsService.incrementHttpRequests('GET', '/api/users', 200);
this.metricsService.recordHttpRequestDuration(150, 'GET', '/api/users', 200);

// 业务指标
this.metricsService.recordBusinessEvent('user_signup', 1, { plan: 'premium' });
this.metricsService.incrementErrors('validation_error', 'UserService');

// 连接指标
this.metricsService.setActiveConnections(5);

// 获取指标信息
const counters = this.metricsService.getCounters();
const histograms = this.metricsService.getHistograms();
const gauges = this.metricsService.getGauges();
```

### TracingService

链路追踪服务，提供完整的分布式追踪功能：

```typescript
constructor(private readonly tracingService: TracingService) {}

// 手动创建 span
const span = this.tracingService.startSpan('my-operation');
span.setAttributes({ 'key': 'value' });
span.end();

// 使用 withSpan 自动管理 span 生命周期
const result = await this.tracingService.withSpan('my-operation', async (span) => {
  span.setAttribute('input', 'value');
  return await someAsyncOperation();
});

// 同步 withSpan
const result = this.tracingService.withSpanSync('sync-operation', (span) => {
  span.setAttribute('input', 'value');
  return someSyncOperation();
});

// 创建子 span
const childSpan = this.tracingService.startChildSpan('child-operation', { 'child.key': 'value' });

// 添加属性到当前活跃 span
this.tracingService.addAttribute('user.id', userId);
this.tracingService.addAttributes({ 'key1': 'value1', 'key2': 'value2' });

// 记录事件
this.tracingService.addEvent('user_action', { action: 'login' });

// 记录异常
this.tracingService.recordException(new Error('出现了错误'));

// 设置状态
this.tracingService.setStatus(SpanStatusCode.OK, '操作成功');

// 获取当前活跃 span
const activeSpan = this.tracingService.getActiveSpan();

// HTTP 追踪
const httpSpan = this.tracingService.startHttpSpan('GET', '/api/users', {
  attributes: { 'custom.attribute': 'value' }
});
```

## 集成示例

### 完整的微服务示例

```typescript
import { Module, Controller, Get, Post, Body, Param } from '@nestjs/common';
import {
  OpenTelemetryModule,
  EnhancedWinstonLoggerService,
  MetricsService,
  TracingService,
  Trace,
  TraceHttp,
  Metrics,
  MetricsHttp,
} from 'cl-nestjs-opentelemetry';

@Injectable()
export class OrderService {
  constructor(
    private readonly logger: EnhancedWinstonLoggerService,
    private readonly tracingService: TracingService,
    private readonly metricsService: MetricsService,
  ) {
    this.logger.setContext('OrderService');
  }

  @Trace({ name: 'process-order', recordArgs: true })
  @Metrics({
    counter: 'orders_processed_total',
    histogram: 'order_processing_duration_ms',
  })
  async processOrder(orderData: any) {
    this.logger.info('处理订单', orderData);

    // 记录业务指标
    this.metricsService.recordBusinessEvent('order_created', 1, {
      'order.type': orderData.type,
      'order.amount': orderData.amount.toString(),
    });

    // 模拟订单处理
    return await this.tracingService.withSpan('order-processing', async (span) => {
      span.setAttributes({
        'order.id': orderData.id,
        'order.amount': orderData.amount,
        'processing.step': 'validation',
      });

      // 验证订单
      await this.validateOrder(orderData);

      span.setAttributes({ 'processing.step': 'payment' });
      // 处理支付
      await this.processPayment(orderData);

      span.setAttributes({ 'processing.step': 'inventory' });
      // 更新库存
      await this.updateInventory(orderData);

      return { orderId: orderData.id, status: 'completed' };
    });
  }

  private async validateOrder(orderData: any) {
    await this.tracingService.withSpan('order-validation', async (span) => {
      span.setAttribute('validation.type', 'business-rules');
      // 验证逻辑...
    });
  }

  private async processPayment(orderData: any) {
    await this.tracingService.withSpan('payment-processing', async (span) => {
      span.setAttribute('payment.method', orderData.paymentMethod);
      // 支付处理逻辑...
    });
  }

  private async updateInventory(orderData: any) {
    await this.tracingService.withSpan('inventory-update', async (span) => {
      span.setAttribute('inventory.operation', 'decrease');
      // 库存更新逻辑...
    });
  }
}

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly logger: EnhancedWinstonLoggerService,
  ) {
    this.logger.setContext('OrderController');
  }

  @Post()
  @TraceHttp({ name: 'create-order-endpoint' })
  @MetricsHttp()
  async createOrder(@Body() orderData: any) {
    this.logger.info('创建订单请求', orderData);
    return this.orderService.processOrder(orderData);
  }

  @Get(':id')
  @TraceHttp({ name: 'get-order-endpoint' })
  @MetricsHttp()
  async getOrder(@Param('id') id: string) {
    this.logger.info(`获取订单: ${id}`);
    // 获取订单逻辑...
  }
}

@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      config: {
        serviceName: 'order-service',
        serviceVersion: '1.0.0',
        environment: 'production',
        logging: {
          console: true,
          file: true,
          logDir: './logs',
          level: 'info',
        },
        tracing: {
          enabled: true,
          sampleRate: 1.0,
        },
        metrics: {
          enabled: true,
          interval: 30000,
        },
      },
    }),
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
```

## Kubernetes 集成

该库专为 Kubernetes 环境设计，日志会输出到指定目录，便于 Kubernetes 自动收集：

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
        - name: app
          image: my-app:latest
          env:
            - name: OTEL_SERVICE_NAME
              value: 'my-app'
            - name: OTEL_LOG_DIR
              value: '/app/logs'
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: 'http://otel-collector:4317'
          volumeMounts:
            - name: logs
              mountPath: /app/logs
      volumes:
        - name: logs
          emptyDir: {}
```

## 故障排除

### 常见问题

#### 1. 日志不输出到文件

- 检查 `logDir` 配置是否正确
- 确保应用有写入权限
- 验证 `file` 配置是否为 `true`

#### 2. 追踪数据不发送

- 检查 `otlpEndpoint` 或 `jaegerEndpoint` 配置
- 验证网络连接
- 确认 `tracing.enabled` 为 `true`

#### 3. 指标不收集

- 检查 `metrics.enabled` 配置
- 验证 Prometheus 端点配置
- 确认指标收集间隔设置

#### 4. 装饰器不生效

- 确保拦截器已正确注册
- 检查装饰器元数据是否正确设置
- 验证方法是否为公开方法

### 调试技巧

```typescript
// 启用调试日志
const config = {
  logging: {
    level: 'debug', // 设置为 debug 级别
  },
  // ... 其他配置
};

// 检查服务状态
const tracingService = app.get(TracingService);
const metricsService = app.get(MetricsService);
const logger = app.get(EnhancedWinstonLoggerService);

// 验证追踪器是否初始化
console.log('Tracer initialized:', !!tracingService.getActiveSpan());

// 验证指标是否启用
console.log('Metrics enabled:', !!metricsService.getMeter());
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（运行演示）
pnpm dev

# 构建
pnpm build

# 测试
pnpm test

# 测试覆盖率
pnpm coverage

# 代码检查
pnpm lint
```

## 许可证

[MIT](LICENSE)

## 贡献

欢迎提交 Pull Request 和 Issue！

### 开发环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Git

### 开发流程

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/my-feature`
3. 提交更改: `git commit -am 'Add some feature'`
4. 推送到分支: `git push origin feature/my-feature`
5. 提交 Pull Request

### 代码质量要求

- 所有测试必须通过
- 代码覆盖率需保持在 95% 以上
- 遵循 ESLint 和 Prettier 规则
- 提交信息需符合 [Conventional Commits](https://conventionalcommits.org/) 规范

## 更新日志

查看 [RELEASE.md](RELEASE.md) 了解版本历史。

## 参考资料

- [OpenTelemetry 官方文档](https://opentelemetry.io/docs/)
- [NestJS 文档](https://nestjs.com/)
- [Winston 文档](https://github.com/winstonjs/winston)
- [nest-winston](https://github.com/gremo/nest-winston)
