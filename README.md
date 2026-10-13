# AI 原生软件交付：从需求到可用软件

[English](README.en.md)

本仓库基于一个真实的 IT 服务台系统，完整演示了如何通过 AI 原生交付流程将业务需求转化为可靠可用的生产软件：从澄清业务问题、确立产品决策、审查架构方案，到编码验证、发布验收，并基于运行时真实反馈实现闭环迭代。每个案例均完整关联了本仓库中真实产生的 Issue、PR、自动化测试与运行记录。

## 从这里开始

- **[演示目的与 Copilot 作用](docs/copilot-roles.md)**：各演示场景的目标、模型贡献、验证证据与结论边界。
- **[演示文档导航](docs/README.md)**：本仓库的核心案例、演示路线与证据索引入口。
- **[演示讲解路线](docs/presenter.md)**：针对已交付的“工单负责人”案例设计的 30 分钟标准讲解指南。
- **[工单负责人完整案例](docs/cases/ownership.zh-CN.md)**：从需求澄清到最终生产镜像验收的全流程图文实录。
- **[数据库就绪检查案例](docs/cases/readiness.md)**：批量决策、受控 Red 阶段、只读健康探测与精确镜像验收实录。
- **[发布可靠性演练](docs/cases/reliability.md)**：两次隔离环境下的准入拦截、自动回滚与数据恢复演练。
- **[故障诊断与策略评估](docs/cases/engineering-judgment.md)**：基于真实样本的 6 组对照实验，记录分类失败详情并量化调用成本。
- **[变更影响分析](docs/cases/change-impact.md)**：代理人方案审查、隔离候选实现、15 项既有回归测试与 35 项独立行为检查。
- **[运行 IT 服务台](demos/it-service-desk/README.md)**：本地运行环境依赖与常用操作命令。
- **[交付流程命令参考](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery.md)**：
  文档审查、PR 检查门禁与镜像验收操作指南。

通用交付方法论与通用工具集统一在[方法指南仓库](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.md)中维护；本仓库仅保存具体案例的实录、现场截图与交付证据，不存放重复的文档副本。

## 案例概览

| 案例 | 核心问题 | Copilot 的角色 | 当前状态 |
|---|---|---|---|
| 工单负责人 | 工单由谁负责？如何完成流转与交接？ | Coding Agent 提交实现代码 [PR #9](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | [已通过验收](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) |
| 数据库就绪检查 | 如何区分进程存活与底层数据库的可读写就绪状态？ | Coding Agent 提交实现代码 [PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26) | [已通过验收](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133959987) |
| [发布可靠性](docs/cases/reliability.md) | 如何拦截异常候选版本、自动恢复服务并防止故障复发？ | 基于已交付镜像执行确定性演练，演练期间无外部 CLI 动态修复 | 2 次隔离恢复演练均通过；运维维护审查待后续执行 |
| [变更影响分析](docs/cases/change-impact.md) | 在引入临时代理人时，如何确保原有工单责任人不被覆盖？ | CLI 分步生成影响分析方案与隔离候选代码 | 方案经审查通过后，候选代码通过 15 项测试与 35 项检查 |
| [故障诊断](docs/cases/engineering-judgment.md) | 系统故障究竟源于业务代码、测试套件还是环境配置？ | CLI 独立生成故障归因、推导理由与最小修复代码 | 6 组修复代码均通过验证；2 组环境配置类标签未达关卡要求 |
| [Agent 策略评估](docs/cases/engineering-judgment.md) | 在生成修复前增加独立的诊断步骤，其收益是否值得额外的调用成本？ | 量化对比“直接修复”与“先诊断再修复”两种策略 | 实测 6 组案例共 9 次调用，完整验收通过率为 4/6；不作通用优劣排序 |

前两项代表业务交付的核心主线；其余专题属于工程实践附录，用于展示严谨的评估方法，而非由 Coding Agent 提交的正式生产功能。

## 推进机制

```text
需求意图 (Intent) → 架构决策 → 批准规格 (Spec) → 批准计划 (Plan)
                 → 审查测试套件 → 审查功能实现 → 验证部署镜像
                 → 用户现场验收 → 运行时持续跟进
```

在整个流程中，AI 负责起草文档与代码，GitHub Actions 自动执行合规性检查并归档版本留痕。关键的产品决策与各阶段文档的具体版本，必须由指定的审查者 `huangyingting` 人工授权批准。AI 生成任务执行成功，绝不等于已获得正式批准。

在服务台的初始基线中，尚未包含工单负责人功能；目前该功能已完整交付并通过现场验收。随后的数据库就绪检查功能也已通过验收，当前全部 47 项测试均呈绿灯通过状态。此外，针对有限发布的 2 次可靠性恢复演练，以及故障诊断与 Agent 策略对比实验，均沉淀了真实的执行记录；代理人变更影响实验在经过架构方案审查后也已成功通过验证（其隔离候选代码不修改主干基线）。目前运维维护审查仍处于待完成状态。需要强调的是：就绪探测响应正常并不保证应用具备完整的生产可用性或流量准入条件；而离线实验的实测结果或已审查方案，也不能等同于正式上线的功能交付。

## 本地验证

请使用 Node.js 24。在仓库根目录下运行自动化检查与独立工程实验应用：

```sh
npm test
npm --prefix demos/engineering-lab test
```

验证服务台应用：

```sh
cd demos/it-service-desk
npm ci
npm test
npm run lint
npm run build
```

各应用独立管理自身的依赖和锁定文件，请勿将演示应用的依赖安装至根目录。

## 来源与参考依据

应用代码与工作流自动化均源自
[`huangyingting/ai-native-sdlc` 的固定提交 `b30e6bc3a693f674d48f1a9f76952176214eae9e`](https://github.com/huangyingting/ai-native-sdlc/tree/b30e6bc3a693f674d48f1a9f76952176214eae9e)。
[溯源记录](brownfield-demo-provenance.json)清晰标识了该初始基线，上游基线记录与本次交付过程证据分别独立保存。
上游工具说明与案例仅作背景参考，不代表本仓库的交付成果；当前仓库的真实进度与证据链统一由[案例索引](docs/cases/README.md)查阅。
