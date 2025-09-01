import { resolve } from 'path';
import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  declaration: true,
  clean: true,
  entries: ['src/index'],
  alias: {
    '@': resolve(__dirname, './src'),
    '~': resolve(__dirname, './playground'),
  },
  rollup: {
    emitCJS: true,
    // 禁用内联依赖以避免内存问题和警告
    inlineDependencies: false,
    esbuild: {
      target: 'node18',
      minify: false,
      // 生成 source map
      sourcemap: true,
      // 正确配置装饰器支持
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
        },
      },
    },
    // Rollup 配置
    output: {
      // 为 CJS 和 ESM 都生成 source map
      sourcemap: true,
    },
  },
  // 禁用构建警告导致的失败
  failOnWarn: false,
  outDir: 'dist',
  externals: [
    // 外部依赖，不打包进库中
    'fs',
    'path',
    'os',
    'crypto',
    'child_process',
    'util',
    'perf_hooks',
    // NestJS 相关
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/config',
    'reflect-metadata',
    'rxjs',
    // Winston 日志相关
    'winston',
    'winston-daily-rotate-file',
    'nest-winston',
    // 类型工具
    'type-fest',
    // 将所有 OpenTelemetry 包设为外部依赖
    '@opentelemetry/api',
    '@opentelemetry/sdk-node',
    '@opentelemetry/auto-instrumentations-node',
    '@opentelemetry/exporter-jaeger',
    '@opentelemetry/exporter-prometheus',
    '@opentelemetry/instrumentation-express',
    '@opentelemetry/instrumentation-fs',
    '@opentelemetry/instrumentation-http',
    '@opentelemetry/instrumentation-nestjs-core',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/sdk-trace-base',
    '@opentelemetry/sdk-metrics',
    '@opentelemetry/resources',
    '@opentelemetry/core',
  ],
});
