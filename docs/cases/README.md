# Cases and delivery progress / 案例与交付进度

[Repository home / 仓库首页](../../README.md)

## Main delivery / 交付主线

The service desk already supports creating, searching and updating tickets.
The first request is to make ticket responsibility visible and support
handoffs without disrupting those workflows. Product choices are resolved
before implementation rather than inferred from a finished example.

服务台已经支持创建、查询和更新工单。第一项需求是让负责人清晰可见，
并支持工单交接，同时保持已有流程可用。具体产品规则先讨论决定，
不从已经完成的案例中反推或照搬答案。

| Step / 步骤 | What to inspect / 查看内容 | State / 状态 |
|---|---|---|
| Preparation / 准备 | [Baseline and local checks / 基线与本地检查](preparation.md) | In progress / 进行中 |
| Intent / 需求 | Problem, desired outcome and open questions / 问题、目标和待决事项 | Pending / 待开始 |
| Spec / 规格 | Product decisions and observable acceptance criteria / 产品决策与可验证的验收条件 | Pending / 待开始 |
| Plan / 计划 | Tasks, dependencies and verification methods / 任务、依赖与验证方法 | Pending / 待开始 |
| Tests / 测试 | Reviewed assertions and expected failures / 已审查断言与预期失败 | Pending / 待开始 |
| Implementation / 实现 | Code review, regressions and application checks / 代码审查、回归与应用检查 | Pending / 待开始 |
| Delivery / 交付 | Source revision, image digest and user acceptance / 源代码版本、镜像摘要与用户验收 | Pending / 待开始 |
| Operation / 运行 | Observations and follow-up requirements / 运行观察与后续需求 | Pending / 待开始 |

## Focused cases / 专题案例

After the required prerequisites are available:

- **Readiness and reliability:** observe dependency failures, review a readiness
  requirement, qualify tests, verify traffic admission and recovery, and follow
  up on prevention.
- **Change impact:** review a proxy-owner proposal before implementing it in
  the isolated engineering application.
- **Diagnosis and strategy evaluation:** use fixed faults, independent checks
  and measured usage to compare repairs and evidence quality.
- **Agent execution traces:** inspect actual model/tool calls and explain their
  relationship to the verified result.

具备前置条件后，将依次补充就绪检查、发布可靠性、代理负责人变更、
故障诊断与策略评估，并用调用追踪解释 Agent 的执行过程。
各专题独立记录输入、修改范围、实际结果和未验证项。

## Screenshots and records / 截图与记录

Capture the page when a meaningful step is reached: the submitted requirement,
published Spec/Plan, a review decision, Red/Green results, publication, application
operation or a measured experiment. Keep the source URL, capture time, relevant
commit or workflow run/attempt, and file checksum with each image.

在需求提交、文档发布、审查决定、测试、发布、应用操作和实验完成等关键节点截图。
每张图记录页面地址、拍摄时间、对应提交或工作流编号与执行次数，以及文件校验值。
测试和审批结论同时保留原始记录，截图用于讲解，不替代这些记录。

Public evidence is reviewed before publication. Credentials, private prompts,
unreviewed CLI events, local databases and sensitive logs stay outside Git.
Failed attempts remain part of the case; a later success does not overwrite them.

资料公开前先检查内容。凭据、私有提示词、未经审查的原始事件、本地数据库和敏感日志
不提交到 Git。失败尝试单独保留，后续成功不覆盖此前结果。
