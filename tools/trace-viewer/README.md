<a id="copilot-cli-trace-viewer"></a>
# Copilot CLI 追踪查看器

[English](README.en.md)

本目录维护 Copilot CLI 演示工作流所使用的无依赖追踪解析与渲染功能。
本地包清单使该组件可以独立测试，而不必把各个独立演示改造成 npm workspaces。

<a id="structure"></a>
## 目录结构

- `action.yml` 将渲染器暴露为本地复合 GitHub Action。
- `trace-model.mjs` 将 JSONL 与 OTLP span 规范化为标准模型。
- `html-renderer.mjs` 渲染追踪视图与依赖视图。
- `render-trace-report.mjs` 生成摘要、HTML 与标准追踪数据。
- `capture-dependency-graph.mjs` 从生成的 HTML 中捕获依赖图。
- `web/` 包含共享的 GitHub Pages 应用。
- `model-pricing.json` 包含模型价格回退数据。
- `render-trace-report.test.mjs` 覆盖规范化、验证、渲染和捕获行为。

工作流专属的请求准备、Issue 评论和 Pages 发布仍保留在 `.github/scripts/`；
它们使用本目录组件，但不属于可复用 Action 的一部分。

<a id="publication-and-validation"></a>
## 发布与验证

- 载荷捕获接受标准 GenAI 消息 `parts` 和旧版 `content`，包括工具调用载荷。
  空消息或只有角色标签，都不能满足所要求的消息证据。
- 发布到 JSON、HTML、摘要和渲染器诊断信息之前，会对 Authorization 请求头、
  已知令牌或秘密字段，以及本地主目录、工作区和临时目录前缀进行脱敏。
  结构化载荷在序列化之前会递归脱敏，包括旧版函数调用及标准工具调用部分中
  以 JSON 编码的参数字符串。嵌套 JSON 字符串保留字符串类型；
  格式错误的 JSON 和普通文本改用文本脱敏。
  这同样适用于仅元数据模式中的失败原因。
  除当前工作目录、主目录和常见运行器路径前缀外，
  也会识别配置的 `GITHUB_WORKSPACE`、`RUNNER_WORKSPACE` 和 `RUNNER_TEMP` 根路径。
  公开 URL 与仓库相对路径会保留。
  脱敏不能保证过滤任意敏感自然语言内容；发布前请审阅载荷。
- 缓存输入属于总输入令牌的一部分，不是额外输入。
  计价同时接受 `gen_ai.usage.cache_read.input_tokens`，
  以及旧版 `cached_input_tokens`、`cache_read_input_tokens` 用量属性。
- 并行证据要求独立智能体分支在时间上重叠：任一分支都不得是另一分支的祖先。
  显示的峰值并发数仍统计所有活跃的子智能体 span，包括嵌套智能体。
- 即使禁用 `require-pattern-evidence`，仍会强制执行 `require-model`。
  验证失败时也会生成报告，以供诊断。

<a id="validate"></a>
## 验证

在仓库根目录运行：

```sh
npm run test:trace-viewer
```
