# AI-native software delivery: from request to working software

Follow a service-desk application from a business request through product
decisions, reviewed specifications, tests, implementation, deployment and
operation. Each case links to the work actually performed in this repository.

本仓库围绕一个 IT 服务台，展示如何把业务需求变成可用的软件：
明确问题、作出产品决策、审查方案、开发验证、部署验收，再根据运行反馈持续改进。
每个案例都将关联本仓库中实际产生的 Issue、PR、测试和运行记录。

## Start here / 从这里开始

- **[Demo documentation / 演示文档](docs/README.md)**:
  cases, presentation route and evidence for this repository.
- **[Presentation route / 演示路线](docs/presenter.md)**:
  a 30-minute tour of the completed ownership delivery.
- **Ticket ownership, end to end / 工单负责人完整案例**:
  [中文图文讲解](docs/cases/ownership.zh-CN.md) · [English walkthrough](docs/cases/ownership.en.md).
- **[Application / 运行服务台](demos/it-service-desk/README.md)**:
  local installation and application commands.
- **[Delivery commands / 交付命令参考](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery.md)**:
  document review, pull-request checks and image acceptance.

Reusable guides live in the [source repository](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.md);
this repository keeps only demonstration narratives, screenshots and delivery records.
通用方法和操作说明统一在指南仓库维护，本仓库不保留重复副本。

## Cases / 案例

| Case / 案例 | Business or engineering question / 要解决的问题 | Status / 状态 |
|---|---|---|
| Ticket ownership / 工单归属 | Who is responsible, and how do we hand over a ticket? / 谁负责，怎样交接？ | [Accepted / 已验收](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) |
| Database readiness / 数据库就绪检查 | Can the application serve requests, not merely keep a process alive? / 进程存活时，应用是否真的可用？ | Not started / 未开始 |
| Release reliability / 发布可靠性 | Can we detect a bad candidate, recover service and prevent recurrence? / 怎样拒绝异常实例、恢复服务并避免问题复发？ | Not started / 未开始 |
| Change impact / 变更影响 | How can we add a proxy owner without changing the accountable owner? / 增加代理负责人时，怎样保持原有责任关系？ | Not started / 未开始 |
| Failure diagnosis / 故障诊断 | Is a failure caused by product code, a test or configuration? / 问题出在产品代码、测试还是配置？ | Not started / 未开始 |
| Agent strategy evaluation / Agent 策略评估 | Does a separate diagnosis step improve results enough to justify its cost? / 单独增加诊断步骤，是否值得额外投入？ | Not started / 未开始 |

## How work moves forward / 如何推进

```text
Intent → product decisions → approved Spec → approved Plan
       → reviewed tests → reviewed implementation → verified image
       → user acceptance → operational follow-up
```

AI proposes documents and code. GitHub Actions executes checks and preserves
versioned records. Product decisions and version-specific approvals require
authorization from the configured reviewer, `huangyingting`. A successful
generation job is not an approval.

AI 起草文档和代码，GitHub Actions 执行检查并保存版本记录。
产品决策和对应版本的批准需要审查者 `huangyingting` 确认。
生成任务成功，不代表文档已经批准或应用已经验收。

The initial service-desk baseline had no ticket ownership; the first delivery
now includes it and has been accepted. The engineering application still has
no proxy ownership. Screenshots and measured results are added as work
completes; a planned case is not a completed delivery.

服务台的初始基线不支持工单归属；目前该功能已完成交付并通过验收。
工程实验应用的代理负责人功能仍未开始。截图和测量结果随实际进度补充，
未完成的案例会明确保留其当前状态。

## Validation / 验证

Use Node.js 24. Run repository automation and the independent engineering
fixture from the root:

```sh
npm test
npm --prefix demos/engineering-lab test
```

For the service desk:

```sh
cd demos/it-service-desk
npm ci
npm test
npm run lint
npm run build
```

Each application owns its dependencies and lockfile. Do not install demo
dependencies at the repository root.

## Source and reference material / 来源与参考资料

The implementation and workflow baseline comes from
[`huangyingting/ai-native-sdlc` at `b30e6bc3a693f674d48f1a9f76952176214eae9e`](https://github.com/huangyingting/ai-native-sdlc/tree/b30e6bc3a693f674d48f1a9f76952176214eae9e).
The [export record](brownfield-demo-provenance.json) identifies that baseline.
Toolkit guides and source case reports are supporting references, not results
of this repository's delivery. Use the [case index](docs/cases/README.md) for
this repository's evidence.

应用和工作流来自上述固定版本，来源记录与本次交付记录分别保存。
工具说明和源仓库案例仅作参考；本仓库的进度与证据统一从[案例索引](docs/cases/README.md)进入。
