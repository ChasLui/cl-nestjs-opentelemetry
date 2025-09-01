import { describe, it, expect, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { SpanKind } from '@opentelemetry/api';
import {
  Trace,
  TraceHttp,
  TraceDb,
  TraceExternal,
  TraceBusiness,
  TRACE_METADATA_KEY,
  TraceOptions,
} from '@/decorators/trace.decorator';

describe('Trace Decorators', () => {
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

  describe('Trace', () => {
    it('应该设置默认元数据', () => {
      const decorator = Trace();
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        originalMethodName: 'testMethod',
      });
    });

    it('应该设置完整的元数据', () => {
      const options: TraceOptions = {
        name: 'custom_span_name',
        kind: SpanKind.CLIENT,
        attributes: { test: 'value' },
        recordArgs: true,
        recordResult: true,
        argNames: ['id', 'name'],
      };

      const decorator = Trace(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        ...options,
        originalMethodName: 'testMethod',
      });
    });

    it('应该处理部分选项', () => {
      const options: TraceOptions = {
        name: 'custom_span_name',
        attributes: { test: 'value' },
      };

      const decorator = Trace(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        ...options,
        originalMethodName: 'testMethod',
      });
    });

    it('应该返回原始描述符', () => {
      const decorator = Trace();
      const descriptor = { value: testMethod };

      const result = decorator(testClass, 'testMethod', descriptor);

      expect(result).toBe(descriptor);
    });
  });

  describe('TraceHttp', () => {
    it('应该设置默认 HTTP 追踪配置', () => {
      const decorator = TraceHttp();
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        kind: SpanKind.SERVER,
        attributes: {
          'operation.type': 'http',
        },
        originalMethodName: 'testMethod',
      });
    });

    it('应该合并自定义选项', () => {
      const options = {
        name: 'custom_http_span',
        attributes: { custom: 'value' },
        recordArgs: true,
        recordResult: true,
      };

      const decorator = TraceHttp(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        name: 'custom_http_span',
        kind: SpanKind.SERVER,
        attributes: {
          'operation.type': 'http',
          custom: 'value',
        },
        recordArgs: true,
        recordResult: true,
        originalMethodName: 'testMethod',
      });
    });

    it('应该覆盖 kind 属性', () => {
      const options = {
        kind: SpanKind.CLIENT, // 这个应该被覆盖
        attributes: { custom: 'value' },
      };

      const decorator = TraceHttp(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata.kind).toBe(SpanKind.SERVER);
    });
  });

  describe('TraceDb', () => {
    it('应该设置默认数据库追踪配置', () => {
      const decorator = TraceDb();
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        kind: SpanKind.CLIENT,
        attributes: {
          'operation.type': 'database',
        },
        originalMethodName: 'testMethod',
      });
    });

    it('应该包含操作和表信息', () => {
      const options = {
        operation: 'SELECT',
        table: 'users',
        name: 'custom_db_span',
        attributes: { custom: 'value' },
      };

      const decorator = TraceDb(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        name: 'custom_db_span',
        kind: SpanKind.CLIENT,
        attributes: {
          'operation.type': 'database',
          'db.operation': 'SELECT',
          'db.name': 'users',
          custom: 'value',
        },
        originalMethodName: 'testMethod',
      });
    });

    it('应该处理只有操作的情况', () => {
      const options = {
        operation: 'INSERT',
      };

      const decorator = TraceDb(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        kind: SpanKind.CLIENT,
        attributes: {
          'operation.type': 'database',
          'db.operation': 'INSERT',
        },
        originalMethodName: 'testMethod',
      });
    });

    it('应该处理只有表的情况', () => {
      const options = {
        table: 'products',
      };

      const decorator = TraceDb(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        kind: SpanKind.CLIENT,
        attributes: {
          'operation.type': 'database',
          'db.name': 'products',
        },
        originalMethodName: 'testMethod',
      });
    });

    it('应该覆盖 kind 属性', () => {
      const options = {
        kind: SpanKind.SERVER, // 这个应该被覆盖
        operation: 'SELECT',
      };

      const decorator = TraceDb(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata.kind).toBe(SpanKind.CLIENT);
    });
  });

  describe('TraceExternal', () => {
    it('应该设置默认外部服务追踪配置', () => {
      const decorator = TraceExternal();
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        kind: SpanKind.CLIENT,
        attributes: {
          'operation.type': 'external',
        },
        originalMethodName: 'testMethod',
      });
    });

    it('应该包含服务信息', () => {
      const options = {
        service: 'payment_service',
        name: 'custom_external_span',
        attributes: { custom: 'value' },
      };

      const decorator = TraceExternal(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        name: 'custom_external_span',
        kind: SpanKind.CLIENT,
        attributes: {
          'operation.type': 'external',
          'external.service': 'payment_service',
          custom: 'value',
        },
        originalMethodName: 'testMethod',
      });
    });

    it('应该处理没有服务的情况', () => {
      const options = {
        attributes: { custom: 'value' },
      };

      const decorator = TraceExternal(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        kind: SpanKind.CLIENT,
        attributes: {
          'operation.type': 'external',
          custom: 'value',
        },
        originalMethodName: 'testMethod',
      });
    });

    it('应该覆盖 kind 属性', () => {
      const options = {
        kind: SpanKind.SERVER, // 这个应该被覆盖
        service: 'api_service',
      };

      const decorator = TraceExternal(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata.kind).toBe(SpanKind.CLIENT);
    });
  });

  describe('TraceBusiness', () => {
    it('应该设置默认业务追踪配置', () => {
      const decorator = TraceBusiness();
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        kind: SpanKind.INTERNAL,
        attributes: {
          'operation.type': 'business',
        },
        originalMethodName: 'testMethod',
      });
    });

    it('应该合并自定义选项', () => {
      const options = {
        name: 'custom_business_span',
        attributes: { custom: 'value' },
        recordArgs: true,
        recordResult: true,
      };

      const decorator = TraceBusiness(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata).toEqual({
        name: 'custom_business_span',
        kind: SpanKind.INTERNAL,
        attributes: {
          'operation.type': 'business',
          custom: 'value',
        },
        recordArgs: true,
        recordResult: true,
        originalMethodName: 'testMethod',
      });
    });

    it('应该覆盖 kind 属性', () => {
      const options = {
        kind: SpanKind.CLIENT, // 这个应该被覆盖
        attributes: { custom: 'value' },
      };

      const decorator = TraceBusiness(options);
      const descriptor = { value: testMethod };

      decorator(testClass, 'testMethod', descriptor);

      const metadata = reflector.get(TRACE_METADATA_KEY, testMethod);
      expect(metadata.kind).toBe(SpanKind.INTERNAL);
    });
  });
});
