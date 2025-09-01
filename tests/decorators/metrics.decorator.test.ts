import { describe, it, expect, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import {
  Metrics,
  MetricsHttp,
  MetricsDb,
  MetricsBusiness,
  METRICS_METADATA_KEY,
  MetricsOptions,
} from '@/decorators/metrics.decorator';

describe('Metrics Decorators', () => {
  let reflector: Reflector;
  let testClass: any;
  let testMethod: any;

  beforeEach(() => {
    reflector = new Reflector();
    testClass = {};
    testMethod = function testMethod() {
      return 'test result';
    };
  });

  describe('Metrics', () => {
    it('应该设置默认元数据', () => {
      const decorator = Metrics();
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        originalMethodName: 'testMethod',
      });
    });

    it('应该设置完整的元数据', () => {
      const options: MetricsOptions = {
        counter: 'test_counter',
        histogram: 'test_histogram',
        attributes: { test: 'value' },
        recordArgs: true,
        argNames: ['id', 'name'],
        recordStatus: true,
      };

      const decorator = Metrics(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        ...options,
        originalMethodName: 'testMethod',
      });
    });

    it('应该处理部分选项', () => {
      const options: MetricsOptions = {
        counter: 'test_counter',
        attributes: { test: 'value' },
      };

      const decorator = Metrics(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        ...options,
        originalMethodName: 'testMethod',
      });
    });

    it('应该返回原始描述符', () => {
      const decorator = Metrics();
      const descriptor = { value: testMethod };

      const result = decorator(testClass, 'testMethod', descriptor);

      expect(result).toBe(descriptor);
    });
  });

  describe('MetricsHttp', () => {
    it('应该设置默认 HTTP 指标配置', () => {
      const decorator = MetricsHttp();
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        counter: 'http_requests_total',
        histogram: 'http_request_duration_seconds',
        attributes: {
          'operation.type': 'http',
        },
        recordStatus: true,
        originalMethodName: 'testMethod',
      });
    });

    it('应该合并自定义选项', () => {
      const options = {
        counter: 'custom_http_counter',
        histogram: 'custom_http_histogram',
        attributes: { custom: 'value' },
        recordArgs: true,
      };

      const decorator = MetricsHttp(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        counter: 'custom_http_counter',
        histogram: 'custom_http_histogram',
        attributes: {
          custom: 'value',
        },
        recordStatus: true,
        recordArgs: true,
        originalMethodName: 'testMethod',
      });
    });

    it('应该使用默认值当选项未提供时', () => {
      const options = {
        attributes: { custom: 'value' },
      };

      const decorator = MetricsHttp(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        counter: 'http_requests_total',
        histogram: 'http_request_duration_seconds',
        attributes: {
          custom: 'value',
        },
        recordStatus: true,
        originalMethodName: 'testMethod',
      });
    });
  });

  describe('MetricsDb', () => {
    it('应该设置默认数据库指标配置', () => {
      const decorator = MetricsDb();
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        counter: 'db_operations_total',
        histogram: 'db_operation_duration_seconds',
        attributes: {
          'operation.type': 'database',
        },
        recordStatus: true,
        originalMethodName: 'testMethod',
      });
    });

    it('应该包含操作和表信息', () => {
      const options = {
        operation: 'SELECT',
        table: 'users',
        counter: 'custom_db_counter',
        attributes: { custom: 'value' },
      };

      const decorator = MetricsDb(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        counter: 'custom_db_counter',
        histogram: 'db_operation_duration_seconds',
        attributes: {
          custom: 'value',
        },
        recordStatus: true,
        originalMethodName: 'testMethod',
      });
    });

    it('应该处理只有操作的情况', () => {
      const options = {
        operation: 'INSERT',
      };

      const decorator = MetricsDb(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        counter: 'db_operations_total',
        histogram: 'db_operation_duration_seconds',
        attributes: {
          'operation.type': 'database',
          'db.operation': 'INSERT',
        },
        recordStatus: true,
        originalMethodName: 'testMethod',
      });
    });

    it('应该处理只有表的情况', () => {
      const options = {
        table: 'products',
      };

      const decorator = MetricsDb(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        counter: 'db_operations_total',
        histogram: 'db_operation_duration_seconds',
        attributes: {
          'operation.type': 'database',
          'db.name': 'products',
        },
        recordStatus: true,
        originalMethodName: 'testMethod',
      });
    });
  });

  describe('MetricsBusiness', () => {
    it('应该设置默认业务指标配置', () => {
      const decorator = MetricsBusiness();
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        counter: 'business_operations_total',
        histogram: 'business_operation_duration_seconds',
        attributes: {
          'operation.type': 'business',
        },
        recordStatus: true,
        originalMethodName: 'testMethod',
      });
    });

    it('应该包含操作信息', () => {
      const options = {
        operation: 'user_registration',
        counter: 'custom_business_counter',
        attributes: { custom: 'value' },
      };

      const decorator = MetricsBusiness(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        counter: 'custom_business_counter',
        histogram: 'business_operation_duration_seconds',
        attributes: {
          custom: 'value',
        },
        recordStatus: true,
        originalMethodName: 'testMethod',
      });
    });

    it('应该处理没有操作的情况', () => {
      const options = {
        attributes: { custom: 'value' },
      };

      const decorator = MetricsBusiness(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(METRICS_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        counter: 'business_operations_total',
        histogram: 'business_operation_duration_seconds',
        attributes: {
          custom: 'value',
        },
        recordStatus: true,
        originalMethodName: 'testMethod',
      });
    });
  });
});
