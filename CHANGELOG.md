# Changelog

## 0.1.0 (2025-09-01)

- fix: cd ([f65ab67](https://github.com/chaslui/cl-nestjs-opentelemetry/commit/f65ab67))
- feat: 添加release-it配置并增强GitHub Actions，以实现更好的发布处理 ([42ed19d](https://github.com/chaslui/cl-nestjs-opentelemetry/commit/42ed19d))

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of cl-nestjs-opentelemetry
- OpenTelemetry integration for NestJS applications
- Comprehensive logging, metrics, and tracing support
- Winston logger integration
- Prometheus metrics exporter
- Jaeger tracing exporter
- Modular architecture with decorators and interceptors

### Fixed

- Test cases now dynamically read package.json version
- Fixed release workflow error handling

### Dependencies

- @opentelemetry/api ^1.9.0
- @opentelemetry/auto-instrumentations-node ^0.52.0
- winston ^3.11.0
- winston-daily-rotate-file ^4.7.1
