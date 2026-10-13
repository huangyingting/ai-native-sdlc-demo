# 演示文档导航

[English](README.en.md)

本仓库专注沉淀真实交付案例：原始需求是什么、经历了哪些架构与产品决策、如何进行多重独立验证，以及最终验收交付了何种软件产物。
交付方法论、环境配置与通用工具操作均统一引用[方法指南仓库](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.md)，避免维护重复副本。中文与英文文档独立成篇，可通过页面顶部的语言切换链接跳转。各类操作命令、代码片段、原始截图以及已冻结归档的交付证据均保留原始文本与格式，确保记录真实可核验。

## 从这里开始

建议首先阅读[演示目的、Copilot 的作用与验证结果](copilot-roles.md)。
交付主线重点展示由 Coding Agent 创建的“工单负责人”与“就绪检查”PR；CLI 实验与确定性可靠性演练则作为工程附录呈现。

1. **了解业务交付结果**：阅读[工单负责人图文案例实录](cases/ownership.zh-CN.md)；后续的运维维护交付可参阅[数据库就绪检查图文案例](cases/readiness.md)。
2. **准备现场讲解**：查阅[30 分钟标准演示路线](presenter.md)。
3. **核对交付范围与进度**：查阅[案例与进度总览](cases/README.md)；进阶工程专题包括[发布可靠性演练](cases/reliability.md)、[故障诊断与策略评估](cases/engineering-judgment.md)以及[已验证的变更影响实验](cases/change-impact.md)。
4. **追溯原始证据链**：
   [原始需求 Issue](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1) ·
   [测试套件 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8) ·
   [功能实现 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) ·
   [最终镜像验收记录](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416)。

## 当前交付范围与状态

- **工单负责人与交接流转**：已正式验收。全部 38 项测试绿灯通过，生产镜像已构建发布，并基于指定镜像摘要（digest）完成了端到端验证。
- **数据库就绪健康检查**：已正式验收。当前全部 47 项测试通过，基于指定发布摘要完成了隔离故障注入、服务恢复以及真实业务操作的完整验证。
- **发布可靠性演练**：已在隔离环境中成功执行 2 次恢复演练；运维维护审查待后续开展。
- **故障诊断与策略评估**：已完成 6 组真实环境实验。其中 6 组修复代码均通过验证，4 组完全通过关卡验收，如实保留了 2 组环境配置标签分类偏差的原始记录。
- **变更影响分析实验**：代理人方案经架构审查通过后，候选代码成功通过 15 项既有回归测试和 35 项独立行为检查。仓库基线特意保持未修改状态，以便后续对比。
- **说明边界**：上述工程实验不构成生产安全认证，亦不会自动将实验代码合并为正式功能。

## 目录结构与证据索引

- [cases/](cases/README.md)：各交付案例的正文、实操记录与进度。
- [cases/assets/ownership/](cases/assets/ownership/manifest.json)：14 张原始截图清单，记录了完整来源、生成时间与文件哈希。
- [cases/assets/readiness/](cases/assets/readiness/manifest.json)：21 张就绪检查过程截图，清晰区分基线镜像与新发布镜像的对比证据。
- [cases/assets/reliability/](cases/assets/reliability/manifest.json)：可靠性演练的原始输出截图、准入验证摘要与 2 次独立演练记录。
- [cases/assets/engineering/](cases/assets/engineering/manifest.json)：工程实验原始记录、脱敏度量数据以及[经审查的模型准确输出与差异摘录](cases/assets/engineering/copilot-excerpts.json)（不含私有提示词与未公开原始上下文）。
- [delivery-runs/](delivery-runs/brownfield-human-gated-delivery/1/spec.md)：由工作流自动归档的规格、实施计划与审查凭据，保留原始冻结格式。

临时测试容器已在演练结束后销毁；截图中的本地地址仅用于当时环境验证，不作为长期运行的公开服务。如需在本地运行体验应用，请参阅[服务台运行说明](../demos/it-service-desk/README.md)；如需从零复现完整的端到端交付，请参考[分步演练指南](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery-walkthrough.md)。
