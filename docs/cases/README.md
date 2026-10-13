# 案例与交付进度

[English](README.en.md) · [仓库首页](../../README.md)

先读[Copilot 的角色与作者身份](../copilot-roles.md)。
下方两项已验收交付都有编码 Agent 创建的实现 PR。
工程附录则展示 CLI 输出和独立检查，或确定性运行观察。

**已完成的工单负责人案例：**[图文讲解](ownership.zh-CN.md) ·
[截图来源与校验记录](assets/ownership/manifest.json)

**已完成的数据库就绪检查案例：**[图文讲解](readiness.md) ·
[截图来源与校验记录](assets/readiness/manifest.json)

<a id="交付主线"></a>
## 首项交付：工单负责人

服务台已经支持创建、查询和更新工单。第一项需求是让负责人清晰可见，
并支持工单交接，同时保持已有流程可用。具体产品规则先讨论决定，
不从已经完成的案例中反推或照搬答案。

| 步骤 | 查看内容 | 状态 |
|---|---|---|
| 准备 | [基线与检查](preparation.md) | 基线验证与自动化配置检查已通过 |
| 需求 | [工单负责人及交接](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1) | 验收后已关闭 |
| 规格 | 产品决策与可验证的验收条件 | [Spec v5 已批准](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118027964) |
| 计划 | [六项实施任务](https://github.com/huangyingting/ai-native-sdlc-demo/blob/6b7a4ddf96f43c6f1980c2e1ed4b568ec429d427/docs/delivery-runs/brownfield-human-gated-delivery/1/plan.md) | [Plan v1 已批准](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118095114) |
| 测试 | [测试 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8) | [经两轮修改后批准](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486995544)，已合并到交付分支 |
| 实现 | [实现 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | 已批准并合并，38 项测试全部通过 |
| 交付 | [指定镜像的验收记录](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) | 已发布、运行并验收 |
| 运行 | [数据库就绪维护交付](readiness.md) · [可靠性演练](reliability.md) | 就绪检查已验收，两次恢复演练通过，维护审查待完成 |

### 产品决策

| 决策 | 已确认规则 | 对应版本 |
|---|---|---|
| [Q-1：负责人可为空](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117772868) | 已有和新建工单均可未分配，允许清空负责人，不替历史工单推定负责人。 | [Spec v2](https://github.com/huangyingting/ai-native-sdlc-demo/blob/f63ee57010f1c83de3b0ae4d6d270c87c62441cf/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-2：本地负责人名单](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117828551) | 从固定名单中选择 Alex Chen 或 Sam Rivera，不支持自由输入，本次不增加名单管理或外部账号集成。 | [Spec v3](https://github.com/huangyingting/ai-native-sdlc-demo/blob/de5fdb100963c65f19a8f5295602ecf381bf1235/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-3：按负责人筛选](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117947008) | 可按两位负责人或未分配筛选，并与已有条件同时生效；选择全部负责人时，只取消负责人条件。 | [Spec v4](https://github.com/huangyingting/ai-native-sdlc-demo/blob/dd32ba04871f10017963917471cdef5ee6164f52/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-4：仅在详情页交接](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117980837) | 各种状态下均可在详情页分配、转交或清空负责人；建单流程不变，状态与负责人独立保存。 | [Spec v5](https://github.com/huangyingting/ai-native-sdlc-demo/blob/9e183465d985bfa081f239a68eda400340320195/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |

四项产品决定均已记录。Spec v5、Plan v1、测试和实现分别获得批准，不相互替代。
随后对已发布的指定镜像进行了验证，并单独确认验收。
需求 Issue 于北京时间 2026 年 10 月 12 日 15:22:08（`2026-10-12T07:22:08Z`）关闭。

### 测试：CI 通过不等于审查通过

1. [首次 CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38207729425/attempts/2)
   因预期失败名称与 Vitest JSON 报告不一致而失败。
   [第一轮审查](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486811408)
   还要求使用真实的历史数据库样本，并加强验收场景覆盖。
2. [修订后的受控 Red](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38208788465/attempts/2)
   虽然通过，[第二轮审查](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486915007)
   仍发现筛选结果和时间戳断言矛盾、从错误的 DOM 范围查找元素，以及没有推进时间的无效重复保存检查。
   这些断言被更早的预期失败遮住，尚未执行到；问题均在测试获批前修正。
3. [最终测试 CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210170335/attempts/2)
   通过：26 项基线测试通过；测试提交中 29 项通过、9 项精确匹配的预期断言失败，
   没有跳过或基础设施错误。lint、TypeScript 检查和构建也通过。
4. 获批提交 `104be0889c54652bec8f9bc317ffa5f0cf33166f`
   合并为 `65939138ada498dca30b572d3baec25cddb5178d`，
   随后的[交接工作流](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210668893)
   才分配实现任务。获批测试和文档冻结，实现必须让测试通过，不能通过削弱断言获得绿灯。

九项失败是功能尚未实现造成的预期结果，不是需要掩盖的错误。
测试获批不代表功能已交付，更不代表用户已经验收。

### 交付与验收

[实现批准](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9#pullrequestreview-5487362172)
对应提交 `4ee8225`，按分支保护规则合并为 `1a1e14d`。
发布时第 2 次执行因镜像包写入权限不足而失败；操作者修正包的 Actions 访问权限后，
[第 3 次执行通过](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3)。
最终验证拉取并运行已发布的指定镜像，不以本地源码预览代替，之后才单独验收。
完整经过和功能验收边界见[图文案例](ownership.zh-CN.md)。

已验收镜像摘要：
`sha256:90836abf909410db91b0d3c791812683e5424c5cab7d7a84df1af6772a66ce76`。
本次功能验收不代表[基线依赖风险](preparation.md)已经解决，也不代表已获准用于生产。

## 维护交付：数据库就绪检查

[需求 #18](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18)
已验收并关闭，当前 47 项测试全部通过。

| 关卡 | 原始记录 | 结果 |
| --- | --- | --- |
| 产品决定 | [六项批量决定](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124226071) | 一条命令产生一版新规格，不直接批准 |
| 规格与计划 | [Spec v3 批准](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124496828) · [Plan v2 批准](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124971454) | 分别记录，绑定准确版本 |
| 测试 | [PR #25](https://github.com/huangyingting/ai-native-sdlc-demo/pull/25) | 38 项基线通过；47 项候选测试中 39 项通过、8 项精确断言 Red，一轮审查修改后批准 |
| 实现 | [PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26) | 47 项全部 Green，七个获批增量文件保持不变，保护流程合并为 `06e9fe3` |
| 发布 | [指定摘要验证](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38311999223/attempts/2) | OCI 来源与合并提交一致 |
| 验收 | [用户验收](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133959987) · [回执](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133963982) | 真实故障、恢复、数据保留和业务操作通过，需求关闭 |

完整边界及图文证据见[就绪检查案例](readiness.md)。
数据库可读信号不代表写入保证、响应期限或生产认证，发布可靠性演练仍待开展。

<a id="专题案例"></a>
<a id="后续专题"></a>
## 工程附录，不是新的产品交付

可靠性演练没有新增 CLI 诊断或修复调用。
影响与诊断实验在零工具条件下生成候选文本，不创建 GitHub 实现 PR。
用户账号下的评论是助手发布的摘要。
参照已审查的[影响输出](change-impact.md#copilot-实际生成了什么)和
[诊断输出](engineering-judgment.md#copilot-实际说了什么)。

| 专题 | 实际结果 | 尚存边界 |
|---|---|---|
| [发布可靠性](reliability.md) | 23 项精确资格断言、六个变异被杀死；两次全新数据卷准入、回退与恢复演练通过 | 仅为运行观察，[维护审查 #28](https://github.com/huangyingting/ai-native-sdlc-demo/issues/28)待完成 |
| [变更影响](change-impact.md) | 准确哈希方案已审查，一次隔离实现通过十五项不变测试和三十五项独立检查 | [记录 #30](https://github.com/huangyingting/ai-native-sdlc-demo/issues/30)保留委托本地审查，不是独立人类验收；仓库基线不变 |
| [故障诊断](engineering-judgment.md) | 六组行为修复通过，两组环境分类错误 | 保留分类失败，不以测试绿灯覆盖 |
| [Agent 策略评估](engineering-judgment.md) | 六组九次真实调用，4/6 完整验收通过，比较用量与耗时 | 每组一次试验，不作普遍统计排名 |

[工程结果记录 #29](https://github.com/huangyingting/ai-native-sdlc-demo/issues/29)
保留所有结果。每次真实模型调用都验证工具数为零。
更早被隔离检查拒绝的方案调用仍单独保留为兼容性失败；
不公开原始私有提示词、完整回复和完整候选源码；
只增加选定的[已审查输出与差异摘录](assets/engineering/copilot-excerpts.json)。

各专题独立记录输入、修改范围、实际结果和未验证项。

## 截图与记录

在需求提交、文档发布、审查决定、测试、发布、应用操作和实验完成等关键节点截图。
每项决策和由此产生的每版文档都单独保存，不只保留最终版本。
决策截图尽量包含命令处理回执，并逐张确认内容清楚可见。凭据填写页面不截图。
每张图记录页面地址、拍摄时间、对应提交或工作流编号与执行次数，以及文件校验值。
测试和审批结论同时保留原始记录，截图用于讲解，不替代这些记录。

资料公开前先检查内容。凭据、私有提示词、未经审查的原始事件、本地数据库和敏感日志
不提交到 Git。失败尝试单独保留，后续成功不覆盖此前结果。
