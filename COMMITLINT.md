# Commitlint 使用指南

本项目使用 [commitlint](https://commitlint.js.org/) 来强制执行约定式提交消息。这确保了提交历史的一致性和可读性。

## 提交消息格式

所有提交消息必须遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```txt
<类型>[可选范围]: <描述>

[可选正文]

[可选脚注]
```

### 提交类型

允许使用以下提交类型：

- **feat**: 新功能
- **fix**: 错误修复
- **docs**: 仅文档更改
- **style**: 不影响代码含义的更改（空格、格式化、缺少分号等）
- **refactor**: 既不修复错误也不添加功能的代码更改
- **perf**: 提高性能的代码更改
- **test**: 添加缺失的测试或修正现有测试
- **build**: 影响构建系统或外部依赖的更改
- **ci**: CI 配置文件和脚本的更改
- **chore**: 不修改 src 或测试文件的其他更改
- **revert**: 撤销之前的提交

### 范围（Scope）

范围是可选的，用于指定更改影响的具体模块或功能：

```bash
feat(auth): 添加用户认证功能
fix(api): 修复登录端点错误
docs(readme): 更新安装指南
refactor(utils): 简化用户验证逻辑
```

### 示例

#### 正确的示例

```bash
# 基本格式
git commit -m "feat: 添加用户认证功能"
git commit -m "fix(api): 修复登录端点错误"
git commit -m "docs: 更新安装指南"
git commit -m "refactor: 简化用户验证逻辑"

# 带范围的格式
git commit -m "feat(auth): 实现 JWT 令牌验证"
git commit -m "fix(database): 修复连接池泄漏问题"
git commit -m "docs(api): 添加 API 文档"

# 带正文的格式
git commit -m "feat: 添加用户认证功能

- 实现 JWT 令牌生成和验证
- 添加密码加密功能
- 集成 Redis 用于令牌存储"
```

#### 错误的示例（将被拒绝）

```bash
git commit -m "修复了 bug"
git commit -m "FEAT: 新功能"
git commit -m "更新代码"
git commit -m "feat: 添加新功能."
git commit -m "feat: 这是一个非常长的提交消息，超过了100个字符的限制，这会导致提交被拒绝"
```

### 规则

- 类型必须是小写
- 类型不能为空
- 主题不能为空
- 主题不能以句号结尾
- 标题（类型 + 范围 + 主题）不能超过 100 个字符
- 范围（如果存在）必须是小写
- 描述应该使用命令式语气（如"添加"而不是"添加了"）

## 验证

Commitlint 验证通过 Husky git hooks 在每次提交时自动进行。如果您的提交消息不符合约定格式，提交将被拒绝。

### 手动验证提交消息

```bash
# 验证单个提交消息
echo "feat: 添加新功能" | npx commitlint

# 验证最近的提交
npx commitlint --from HEAD~1 --to HEAD --verbose
```

### 修复提交消息

如果提交被拒绝，您可以使用以下命令修改最近的提交消息：

```bash
git commit --amend -m "feat: 添加新功能"
```

## 配置

Commitlint 配置定义在 [`commitlint.config.mjs`](./commitlint.config.mjs) 文件中。

### 自定义规则

您可以在配置文件中添加自定义规则：

```javascript
// commitlint.config.mjs
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
  },
};
```

## 最佳实践

1. **保持简洁**: 描述应该简洁明了，通常不超过 50 个字符
2. **使用命令式语气**: 使用"添加"、"修复"、"更新"等动词
3. **包含范围**: 当更改影响特定模块时，使用范围来提供更多上下文
4. **详细说明**: 对于复杂更改，使用正文部分提供更多详细信息
5. **引用问题**: 在脚注中引用相关的 issue 或 PR

### 示例工作流

```bash
# 1. 创建功能分支
git checkout -b feat/user-authentication

# 2. 进行更改并提交
git add .
git commit -m "feat(auth): 添加用户登录功能"

# 3. 继续开发
git add .
git commit -m "feat(auth): 实现密码验证逻辑"

# 4. 修复问题
git add .
git commit -m "fix(auth): 修复登录表单验证错误"

# 5. 合并到主分支
git checkout main
git merge feat/user-authentication
```

## 故障排除

### 常见错误

1. **提交被拒绝**: 检查消息格式是否符合规范
2. **Husky hooks 不工作**: 确保已安装并配置 Husky
3. **配置问题**: 检查 `commitlint.config.mjs` 文件是否正确

### 跳过验证（不推荐）

在紧急情况下，可以跳过验证：

```bash
git commit -m "紧急修复" --no-verify
```

**注意**: 仅在真正紧急的情况下使用此选项，并确保稍后修正提交消息。
