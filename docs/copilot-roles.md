# Copilot 在这些演示中到底做了什么

[English](copilot-roles.en.md) · [文档首页](README.md) · [演示路线](presenter.md)

## 先区分两类证据

面向客户的交付主线与受控工程实验**不是同一套流程**。
操作者账号下的结果评论，不是 Copilot 编写实现的 PR。

| 演示 | 目的 | Copilot 的实际贡献 | 最适合展示的证据 |
|---|---|---|---|
| [工单负责人](cases/ownership.zh-CN.md) | 增加责任归属和交接，不破坏已有工作 | 编码 Agent 编写实现并创建 PR | [PR #9](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9)，作者为 `app/copilot-swe-agent`，查看差异、CI 和镜像验收 |
| [数据库就绪检查](cases/readiness.md) | 把观察到的数据库缺口变成经审查、验收的修改 | 编码 Agent 实现获批的就绪约定 | [PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26)，同一机器人作者，冻结测试与指定镜像验证 |
| [发布可靠性](cases/reliability.md) | 验证准入、故障检测、回退和数据保留 | 使用此前交付的镜像；本次演练**没有新增 CLI 诊断或修复调用** | 确定性资格验证与两次运行观察，不是 AI 自主修复 |
| [代理负责人影响](cases/change-impact.md) | 识别兼容性范围，再实现有限候选代码 | CLI 用两次调用生成影响方案与候选源码 | 已审查的输出摘录、选定代码差异和独立 15+35 检查 |
| [诊断与策略](cases/engineering-judgment.md) | 比较故障分类、修复和多一步诊断的成本 | CLI 用九次调用生成诊断与修复候选 | 实际理由、分类摘录、选定补丁和六组完整结果 |

客户演示先讲前两项。其余作为工程附录，不要当作更多机器人创建产品 PR 的案例。

## 各方分别负责什么

| 参与者 | 职责 | 不要混同为 |
|---|---|---|
| GitHub Copilot Coding Agent | 以 `app/copilot-swe-agent` 身份提交实现 PR | 用户账号创建的文档 PR |
| Copilot CLI | 生成结构化方案、理由、分类和候选文本 | 本次受限实验中自主操作 GitHub 的贡献者 |
| VS Code 中使用 Copilot SDK 的 AI 助手 | 编排实验、审查输出、记录委托的本地决定，并通过授权账号发布审查后的摘要 | 独立人类审查者或另外一个机器人身份 |
| GitHub Actions／可信验证程序 | 执行检查、应用白名单候选、运行受限 Docker 并记录结果 | Copilot 给自己提出的修复打分 |
| 用户／配置的审查者 | 授权决定，明确批准交付阶段并验收 | 所有显示用户账号的评论 |

本地回执中的 `copilot-operator` 只是标签，**不是经过身份认证的 GitHub Copilot 账号**。
记录中的 `independentHumanReview: false` 仍为 false，不能讲成独立人类验收。

## 为什么 Issue 里都是 huangyingting 的评论

普通实验记录
[#28](https://github.com/huangyingting/ai-native-sdlc-demo/issues/28)、
[#29](https://github.com/huangyingting/ai-native-sdlc-demo/issues/29)和
[#30](https://github.com/huangyingting/ai-native-sdlc-demo/issues/30)
中的评论，由助手使用用户授权的 GitHub 凭据发布。
显示的账号说明谁发布，不一定说明谁或哪个模型生成了内容。

这些 CLI 调用特意验证可用工具数和工具请求数均为零。
CLI 不能修改仓库、评论 GitHub、创建 PR 或批准自己。
操作者的结果摘要不是编码 Agent 的评论。
同样，[PR #31](https://github.com/huangyingting/ai-native-sdlc-demo/pull/31)和
[PR #32](https://github.com/huangyingting/ai-native-sdlc-demo/pull/32)
由 `huangyingting` 发布文档和证据，不是模型提交的实现 PR。

## 两条实际执行链路

```text
交付主线：
  用户决定与批准 → 编码 Agent 实现 PR
    → Actions 检查 → 实际发布镜像 → 用户明确验收

受限实验：
  固定模拟输入 → Copilot CLI 方案／诊断／候选文本
    → 可信白名单适配器 → Docker 测试与独立检查
    → 助手审查摘要，通过操作者账号发布
```

工程实验基线特意保持不变。隔离代理候选通过，不代表服务台已经部署代理负责人功能。

## 展示过程，不只展示用量数字

CLI 实验应依次展示四项：

1. **输入：**固定请求，以及实际提供的相关故障或基线代码。
2. **模型输出：**实际理由或分类，不是操作者转述。
3. **候选差异：**模型提出的代码中经过审查的摘录。
4. **独立结果：**修改范围、测试保留、行为检查和分类关卡。

[已审查摘录记录](cases/assets/engineering/copilot-excerpts.json)
包含选定的准确最终回答文本和单行差异，绑定到实测摘要中已有的响应哈希。
[影响案例](cases/change-impact.md#copilot-实际生成了什么)和
[诊断案例](cases/engineering-judgment.md#copilot-实际说了什么)
讲解这些摘录。两种语言页面都保留模型英文原句，周围说明分别翻译。

这些选段由助手审查，不是经过身份认证的独立人类审查。
它们**不是完整原始会话或完整候选文件**。
私有或系统提示词、凭据、原始会话和完整候选载荷仍不公开。
本次整理文档没有新增实验调用，没有修改或重跑失败组。

## 讲解时不能声称什么

- 按固定策略运行的可靠性脚本，不是 Copilot 自主决定回退。
- 模型说明配置原因正确，不会自动纠正错误的 `classification` 字段。
- 行为绿灯不等于实验完整验收；两次分类失败仍然存在。
- CLI 用量和哈希本身不能解释模型怎样推理。
- 操作者账号评论不是 Copilot 作者身份或本人亲自审查的证明。
- 不虚构机器人身份、独立批准、部署或生产认证。
