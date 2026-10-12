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
| Preparation / 准备 | [Baseline and checks / 基线与检查](preparation.md) | Baseline and automated setup checks passed / 基线验证与自动化配置检查已通过 |
| Intent / 需求 | [Ticket ownership and handoffs / 工单归属与交接](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1) | Submitted / 已提交 |
| Spec / 规格 | Product decisions and observable acceptance criteria / 产品决策与可验证的验收条件 | [Spec v5 approved / Spec v5 已批准](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118027964) |
| Plan / 计划 | [Six implementation tasks / 六项实施任务](https://github.com/huangyingting/ai-native-sdlc-demo/blob/6b7a4ddf96f43c6f1980c2e1ed4b568ec429d427/docs/delivery-runs/brownfield-human-gated-delivery/1/plan.md) | [Latest review and handoff status / 最新审查与交接状态](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1) |
| Tests / 测试 | Reviewed assertions and expected failures / 已审查断言与预期失败 | Pending / 待开始 |
| Implementation / 实现 | Code review, regressions and application checks / 代码审查、回归与应用检查 | Pending / 待开始 |
| Delivery / 交付 | Source revision, image digest and user acceptance / 源代码版本、镜像摘要与用户验收 | Pending / 待开始 |
| Operation / 运行 | Observations and follow-up requirements / 运行观察与后续需求 | Pending / 待开始 |

### Product decisions / 产品决策

| Decision / 决策 | Confirmed behavior / 已确认规则 | Resulting version / 对应版本 |
|---|---|---|
| [Q-1: optional ownership / 负责人可为空](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117772868) | Existing and new tickets may remain unassigned; owners may be cleared. Do not infer historical owners. / 已有和新建工单均可未分配，允许清空负责人，不替历史工单推定负责人。 | [Spec v2](https://github.com/huangyingting/ai-native-sdlc-demo/blob/f63ee57010f1c83de3b0ae4d6d270c87c62441cf/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-2: local roster / 本地负责人名单](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117828551) | Select Alex Chen or Sam Rivera from a fixed list; no free-text owners, roster management or external identity integration. / 从固定名单中选择 Alex Chen 或 Sam Rivera，不支持自由输入，本次不增加名单管理或外部账号集成。 | [Spec v3](https://github.com/huangyingting/ai-native-sdlc-demo/blob/de5fdb100963c65f19a8f5295602ecf381bf1235/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-3: owner filtering / 按负责人筛选](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117947008) | Filter by either roster member or Unassigned, together with existing search and filters; All owners removes only the ownership restriction. / 可按两位负责人或未分配筛选，并与已有条件同时生效；选择全部负责人时，只取消负责人条件。 | [Spec v4](https://github.com/huangyingting/ai-native-sdlc-demo/blob/dd32ba04871f10017963917471cdef5ee6164f52/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-4: detail-only handoffs / 仅在详情页交接](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117980837) | Change ownership on details in every existing status; creation stays unchanged, and status and ownership saves remain independent. / 各种状态下均可在详情页分配、转交或清空负责人；建单流程不变，状态与负责人独立保存。 | [Spec v5](https://github.com/huangyingting/ai-native-sdlc-demo/blob/9e183465d985bfa081f239a68eda400340320195/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |

All four decisions are recorded. Spec v5 was separately approved after review.
Plan review, Tests PR review, implementation review, and application acceptance
remain distinct gates; follow the Intent for their latest status.

四项产品决定均已记录，Spec v5 随后经过审查并获得单独批准。
Plan、测试 PR、实现 PR 和应用验收仍分别设置审核节点，最新状态以需求 Issue 为准。

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

Capture every decision and every resulting document version, not just the final
version. Include the command receipt when available, and visually check that the
intended content is visible. Never capture credential-entry pages.

在需求提交、文档发布、审查决定、测试、发布、应用操作和实验完成等每个关键节点截图。
每项决策和由此产生的每版文档都单独保存，不只保留最终版本。
决策截图尽量包含命令处理回执，并逐张确认内容清楚可见。凭据填写页面不截图。
每张图记录页面地址、拍摄时间、对应提交或工作流编号与执行次数，以及文件校验值。
测试和审批结论同时保留原始记录，截图用于讲解，不替代这些记录。

Public evidence is reviewed before publication. Credentials, private prompts,
unreviewed CLI events, local databases and sensitive logs stay outside Git.
Failed attempts remain part of the case; a later success does not overwrite them.

资料公开前先检查内容。凭据、私有提示词、未经审查的原始事件、本地数据库和敏感日志
不提交到 Git。失败尝试单独保留，后续成功不覆盖此前结果。
