<a id="copilot-cli-trace-viewer"></a>
# Copilot CLI 调用链路追踪查看器 (Trace Viewer)

[English](README.en.md)

本目录提供了服务于 Copilot CLI 演示工作流的轻量化追踪解析与可视化渲染套件（零外部依赖）。
独立维护的 package.json 使得该组件可以作为独立模块进行测试与演进，避免将整个仓库改造成复杂的 npm workspaces 结构。

<a id="structure"></a>
## 模块目录结构

- `action.yml`：将报告渲染器封装为本地复合 GitHub Action。
- `trace-model.mjs`：将原始 JSONL 事件流与 OTLP span 统一规范化为标准的调用链路追踪模型。
- `html-renderer.mjs`：负责渲染调用时序视图（Trace View）与依赖拓扑视图（Dependency View）。
- `render-trace-report.mjs`：主入口，负责生成度量摘要、HTML 交互报告及标准追踪数据文件。
- `capture-dependency-graph.mjs`：从生成的 HTML 报告中自动提取依赖拓扑图元数据。
- `web/`：包含可托管于 GitHub Pages 的单页交互式 Web 客户端。
- `model-pricing.json`：包含大语言模型调用的计费基准回退配置。
- `render-trace-report.test.mjs`：针对事件规范化、脱敏校验、图表渲染与依赖捕获的自动化测试套件。

特定于工作流的请求构建、Issue 评论交互及 GitHub Pages 发布脚本统一维护在 `.github/scripts/` 目录下；它们调用本目录的基础解析能力，但与可复用的 Action 保持解耦。

<a id="publication-and-validation"></a>
## 报告发布与数据脱敏安全规范

- **严格的载荷有效性判定**：事件捕获支持标准的生成式 AI 消息 `parts` 格式以及旧版 `content` 格式（包含 Tool Call 载荷）。若消息正文为空或仅包含角色标签（role），将被视为无效数据，无法满足证据链的合规要求。
- **全方位敏感信息脱敏**：在将数据序列化输出至 JSON、HTML 报告及诊断日志前，程序会自动对 Authorization 认证请求头、各类 API Token、密钥字段，以及本地操作系统的 `$HOME`、工作区与临时目录前缀执行递归脱敏。对于旧版函数调用参数及标准工具调用中以 JSON 字符串编码的结构化参数，解析器会先反序列化递归脱敏后再重新编码，确保内部嵌套的路径和凭证无一遗漏。畸形的 JSON 字符串与普通文本采用安全正则脱敏。该脱敏机制在只输出元数据的模式下同样生效。除当前工作目录与常见 CI 运行环境路径外，程序还会严格识别并擦除 `GITHUB_WORKSPACE`、`RUNNER_WORKSPACE` 与 `RUNNER_TEMP` 根路径。外部公开 URL 与相对仓库根目录的路径会妥善保留。需要说明的是：脱敏程序无法保证 100% 过滤自然语言对话中的私密内容；在公开归档前务必人工复核。
- **Token 统计口径一致性**：命中的缓存输入 Token（Cache Read Tokens）属于输入总量的子集，严禁将其与总输入 Token 简单相加造成重复统计。计价引擎同时兼容 OpenTelemetry 规范的 `gen_ai.usage.cache_read.input_tokens` 字段与旧版的 `cached_input_tokens`、`cache_read_input_tokens` 统计属性。
- **并行执行的判定标准**：证明多个 Agent 具备真正的并行并发能力，必须要求其执行时间在物理时钟上产生重叠，且彼此之间不存在父子级派生关系。图表中展示的峰值并发数（Peak Concurrency）会精准统计当前时间窗口内活跃的所有子 Agent span（包含深层嵌套的 Agent 实例）。
- **模型校验要求**：即使在配置中关闭了 `require-pattern-evidence` 选项，系统依然会强制校验 `require-model`。当校验未通过时，依然会输出带诊断信息的报告以便排查。

<a id="validate"></a>
## 本地测试与验证

在仓库根目录下运行：

```sh
npm run test:trace-viewer
```
