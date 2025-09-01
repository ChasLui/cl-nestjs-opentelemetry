import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Injectable } from '@nestjs/common';
import {
  OpenTelemetryModule,
  createOpenTelemetryConfigFromEnv,
  EnhancedWinstonLoggerService,
  MetricsService,
  TracingService,
  Trace,
  TraceHttp,
  Metrics,
  MetricsHttp,
} from '@/index';

// 带有追踪和指标的示例服务
@Injectable()
class UserService {
  constructor(
    private readonly logger: EnhancedWinstonLoggerService,
    private readonly tracingService: TracingService,
  ) {
    this.logger.setContext('UserService');
  }

  @Trace({ name: 'get-user-by-id', recordArgs: true })
  @Metrics({ counter: 'user_operations_total', histogram: 'user_operation_duration_ms' })
  async getUserById(id: string) {
    this.logger.info(`根据 ID 获取用户: ${id}`);

    // 模拟一些工作
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

    // 向当前 span 添加自定义属性
    this.tracingService.addAttribute('user.id', id);
    this.tracingService.addAttribute('user.found', true);

    return {
      id,
      name: `用户 ${id}`,
      email: `user${id}@example.com`,
      createdAt: new Date().toISOString(),
    };
  }

  @Trace({ name: 'create-user', recordArgs: true, recordResult: true })
  @Metrics({ counter: 'user_creations_total', histogram: 'user_creation_duration_ms' })
  async createUser(userData: { name: string; email: string }) {
    this.logger.info('创建新用户', userData);

    // 模拟数据库操作
    await this.tracingService.withSpan('database-insert', async (span) => {
      span.setAttributes({
        'db.operation': 'insert',
        'db.table': 'users',
        'db.system': 'postgresql',
      });

      // 模拟工作
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));
    });

    const newUser = {
      id: Math.random().toString(36).substr(2, 9),
      ...userData,
      createdAt: new Date().toISOString(),
    };

    this.logger.info('用户创建成功', { userId: newUser.id });
    return newUser;
  }
}

// 示例控制器
@Controller('users')
class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: EnhancedWinstonLoggerService,
    private readonly metricsService: MetricsService,
  ) {
    this.logger.setContext('UserController');
  }

  @Get(':id')
  @TraceHttp({ name: 'get-user-endpoint' })
  @MetricsHttp()
  async getUser(id: string) {
    this.logger.info(`GET /users/${id}`);

    // 记录自定义业务指标
    this.metricsService.recordBusinessEvent('user_lookup', 1, { 'lookup.type': 'by_id' });

    return this.userService.getUserById(id);
  }

  @Get()
  @TraceHttp({ name: 'create-user-endpoint' })
  @MetricsHttp()
  async createUser() {
    this.logger.info('POST /users');

    const userData = {
      name: '张三',
      email: 'zhangsan@example.com',
    };

    return this.userService.createUser(userData);
  }
}

// 示例应用模块
@Module({
  imports: [
    OpenTelemetryModule.forRoot({
      config: {
        ...createOpenTelemetryConfigFromEnv(),
        serviceName: 'playground-app',
        serviceVersion: '1.0.0',
        environment: 'development',
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
          interval: 10000,
        },
      },
    }),
  ],
  controllers: [UserController],
  providers: [UserService],
})
class AppModule {}

// 启动应用程序
async function bootstrap() {
  console.log('🚀 启动 OpenTelemetry 演示...');

  const app = await NestFactory.create(AppModule);
  const logger = app.get(EnhancedWinstonLoggerService);

  logger.setContext('Bootstrap');
  logger.info('应用程序启动中...');

  // 模拟一些操作
  const userService = app.get(UserService);
  const metricsService = app.get(MetricsService);

  try {
    // 测试用户操作
    logger.info('测试用户操作...');

    const user1 = await userService.getUserById('123');
    logger.info('检索到用户', user1);

    const newUser = await userService.createUser({
      name: '李四',
      email: 'lisi@example.com',
    });
    logger.info('创建了用户', newUser);

    // 记录一些自定义指标
    metricsService.incrementErrors('validation_error', 'UserService');
    metricsService.setActiveConnections(5);
    metricsService.recordBusinessEvent('app_startup', 1, { version: '1.0.0' });

    logger.info('✅ 演示操作成功完成！');

    // 显示一些指标
    const counters = metricsService.getCounters();
    const histograms = metricsService.getHistograms();

    logger.info(`📊 指标摘要:`, {
      counters: Array.from(counters.keys()),
      histograms: Array.from(histograms.keys()),
    });
  } catch (error) {
    logger.error('❌ 演示操作期间发生错误', error.stack);
  }

  logger.info('🏁 演示完成。检查日志目录以查看文件输出。');

  // 保持进程存活一段时间以查看指标
  setTimeout(() => {
    logger.info('关闭演示...');
    process.exit(0);
  }, 2000);
}

// 运行演示
bootstrap().catch(console.error);
