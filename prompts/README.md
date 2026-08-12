# AI 提示词模板

本目录存放 V9 智能投研复盘系统的 AI 提示词模板，用于统一 AI 生成代码的风格、约束与输出格式。

## 文件说明

| 文件 | 用途 |
|------|------|
| `system-prompt-template.md` | 通用系统提示词，描述项目架构、分层规则、颜色令牌、日志规范等核心约束 |
| `component-prompt-template.md` | UI 组件生成专用，含设计体系、组件层级、Widget 三处注册要求 |
| `service-prompt-template.md` | Service 生成专用，含 DataBridge 使用、事件规范、日志规范 |
| `store-prompt-template.md` | Store 生成专用，含 withBroadcast 使用规范 |
| `types-prompt-template.md` | 类型定义生成专用，含零依赖原则 |

## 使用方式

### 方式一：复制到 AI 对话系统提示词

将 `system-prompt-template.md` 内容粘贴到 Cursor / Trae / WorkBuddy 等工具的系统提示词（System Prompt）中。根据当前任务，追加对应场景的专用模板。

### 方式二：通过 `.cursorrules` 引用

项目根目录的 `.cursorrules` 已配置引用本目录模板。Cursor 会自动加载这些约束。

### 方式三：任务开始时手动加载

在每次复杂开发任务开始前，将相关模板作为上下文提供给 AI：

```text
请严格遵循 prompts/system-prompt-template.md 与 prompts/component-prompt-template.md 中的约束，完成以下任务：
...
```

## 维护

当 `AGENTS.md`、设计令牌体系、质量门禁规则发生变化时，需同步更新本目录中的对应模板。

