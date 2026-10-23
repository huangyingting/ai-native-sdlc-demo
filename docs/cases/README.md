# 案例与交付进度总览

[English](README.en.md) · [仓库首页](../../README.md)

建议首先阅读[演示目标、Copilot 的角色与验证结论](../copilot-roles.md)。
下述两项核心业务交付均由 Coding Agent 自动创建实现 PR，并通过了独立验证与人工现场验收。
工程实践附录则展示了在受限环境下由 CLI 生成分析方案与补丁候选，并通过独立测试套件客观评估的实测数据。

**已验收的工单负责人案例**：[图文实录](ownership.zh-CN.md) ·
[截图清单与校验记录](assets/ownership/manifest.json)

**已验收的数据库就绪检查案例**：[图文实录](readiness.md) ·
[截图清单与校验记录](assets/readiness/manifest.json)

<a id="交付主线"></a>
## 交付主线一：工单负责人功能

服务台原本支持创建、查询与更新工单，但缺少明确的工单责任人机制。本期的首要业务需求是使工单负责人清晰可见并支持交接流转，同时确保既有工单流程完全向下兼容。所有产品规则均在需求澄清阶段讨论确定，杜绝从已有代码中反向猜测或盲目套用预设逻辑。

| 交付阶段 | 查验入口 | 状态与结论 |
|---|---|---|
| 环境准备 | [基线验证与前置检查](preparation.md) | 基线测试与自动化工作流配置检查均已顺利通过 |
| 需求意图 | [工单负责人与交接需求 Issue](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1) | 经现场验收后已正式关闭 |
| 规格说明 | 架构决策与可验证的验收场景 | [Spec v5 正式获批](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118027964) |
| 实施计划 | [拆解的 6 项具体实施任务](https://github.com/huangyingting/ai-native-sdlc-demo/blob/6b7a4ddf96f43c6f1980c2e1ed4b568ec429d427/docs/delivery-runs/brownfield-human-gated-delivery/1/plan.md) | [Plan v1 正式获批](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118095114) |
| 测试套件 | [测试套件 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8) | [历经两轮修改后获批](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486995544)，合并至交付分支 |
| 功能实现 | [功能实现 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | 经人工审查后获批合并，38 项测试全部绿灯通过 |
| 交付部署 | [确切镜像摘要的验收记录](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) | 生产镜像成功构建发布，经端到端操作完成验收 |
| 运行演练 | [数据库就绪维护交付](readiness.md) · [发布可靠性演练](reliability.md) | 就绪检查已验收；2 次故障恢复演练通过；运维审查待后续完成 |

### 核心产品决策

| 决策项 | 确认的业务规则 | 对应生效版本 |
|---|---|---|
| [Q-1：负责人字段是否必填](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117772868) | 允许为空。历史存量工单与新建工单均默认未分配；支持清空负责人；严禁为历史工单臆造推定负责人。 | [Spec v2](https://github.com/huangyingting/ai-native-sdlc-demo/blob/f63ee57010f1c83de3b0ae4d6d270c87c62441cf/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-2：成员名单来源](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117828551) | 采用固定成员名单（Alex Chen 与 Sam Rivera），不支持自由文本输入；本期不引入账号管理或外部身份系统。 | [Spec v3](https://github.com/huangyingting/ai-native-sdlc-demo/blob/de5fdb100963c65f19a8f5295602ecf381bf1235/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-3：工单筛选规则](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117947008) | 支持按两位负责人或“未分配”进行筛选，与其他过滤条件按 AND 取交集；选择“全部负责人”时仅重置该维度的筛选条件。 | [Spec v4](https://github.com/huangyingting/ai-native-sdlc-demo/blob/dd32ba04871f10017963917471cdef5ee6164f52/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-4：交接操作入口与状态限制](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117980837) | 仅允许在工单详情页进行分配、转交或清空；在所有工单状态下均可操作；新建工单流程不变，状态与责任人分别独立持久化。 | [Spec v5](https://github.com/huangyingting/ai-native-sdlc-demo/blob/9e183465d985bfa081f239a68eda400340320195/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |

上述 4 项产品决策均完整沉淀在 Issue 讨论链中。Spec v5、Plan v1、测试套件与功能实现均实行独立的审批门禁，不可相互替代。随后针对正式构建发布的指定镜像进行了完整业务验证并签署最终验收决定。该需求 Issue 于北京时间 2026 年 10 月 12 日 15:22:08（`2026-10-12T07:22:08Z`）正式关闭。

### 测试门禁：CI 绿灯不等于审查通过

1. [首次 CI 运行](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38207729425/attempts/2)
   因预期失败用例名称与 Vitest 输出的 JSON 报告不一致而被自动化门禁直接拦截。
   审查者在[第一轮评审意见](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486811408)中明确指出：必须补充真实的历史数据库迁移样本，并强化业务验收断言的覆盖深度。
2. [受控 Red 状态修订](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38208788465/attempts/2)
   尽管该轮测试在 CI 门禁中被判定通过，但审查者在[第二轮人工评审](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486915007)中敏锐发现：筛选断言与时间戳预期存在逻辑矛盾，DOM 查找范围存在越界风险，且重复保存测试未推进模拟时钟导致断言形同虚设。由于更早的预期失败掩盖了后续断言，这些缺陷才未在 CI 中暴露；所有问题均在测试套件正式获批前予以修正。
3. [最终测试套件 CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210170335/attempts/2)
   测试套件完全达到受控要求：26 项原有回归测试全部通过；新增的 38 项测试中，29 项正常通过，9 项为精确匹配的预期失败（Red），未夹杂任何跳过用例或基础设施异常。静态检查、TypeScript 类型检查与构建均顺利通过。
4. 获批提交 `104be0889c54652bec8f9bc317ffa5f0cf33166f`
   合并为 `65939138ada498dca30b572d3baec25cddb5178d`，
   随后的[交接工作流](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210668893)
   正式向 Coding Agent 下发实现任务。获批的测试用例与文档就此冻结，实现代码必须使所有断言转绿，严禁通过删改断言来掩盖未实现的功能。

这 9 项失败是用例在功能尚未实现时的正常业务断言红灯，而非系统报错。测试套件获批不代表功能已经交付，更不能替代最终的业务验收。

### 交付部署与最终验收

功能实现经审查通过（[评审记录](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9#pullrequestreview-5487362172)对应提交 `4ee8225`），严格遵循分支保护规则合并至交付分支 `1a1e14d`。
在镜像发布阶段，第 2 次执行由于镜像包写入权限不足而中断；在人工修复包的 GitHub Actions 写入权限后，
[第 3 次发布重试顺利通过](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3)。
随后的端到端验证直接基于拉取的指定镜像运行，坚决不用本地热更新预览代码代替真实的容器验证。完整过程与验收边界详见[图文实录](ownership.zh-CN.md)。

已验收生产镜像摘要（Digest）：
`sha256:90836abf909410db91b0d3c791812683e5424c5cab7d7a84df1af6772a66ce76`。
本次业务功能验收不代表[基线中的历史依赖告警](preparation.md)已彻底消除，亦不代表已获得生产级安全认证。

## 维护交付：数据库就绪检查

[需求 #18](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18)
已验收并关闭，当前 47 项测试全部通过。

| 关卡 | 原始记录 | 结果 |
| 交付门禁 | 原始审计记录 | 执行结论 |
| --- | --- | --- |
| 架构决策 | [6 项批量确认决策](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124226071) | 通过单条批量指令完成所有探索答复并直接生成新版规格 |
| 规格与计划 | [Spec v3 获批记录](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124496828) · [Plan v2 获批记录](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124971454) | 独立进行门禁审批，绑定精确版本哈希 |
| 测试套件 | [测试 PR #25](https://github.com/huangyingting/ai-native-sdlc-demo/pull/25) | 38 项既有基线测试通过；47 项候选测试中 39 项通过、8 项精准断言 Red；经一轮评审修改后获批 |
| 功能实现 | [实现 PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26) | 47 项测试全部绿灯转通过，7 个已冻结增量文件保持未修改，按保护规则合并为 `06e9fe3` |
| 镜像发布 | [指定摘要验证日志](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38311999223/attempts/2) | OCI 镜像溯源信息与合并提交完全一致 |
| 业务验收 | [用户最终验收决策](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133959987) · [回执](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133963982) | 在隔离实例上验证 503 拦截、配置修复恢复及正常工单操作后正式确认验收并关闭需求 |

完整的验收场景与图文证据详见[就绪检查案例实录](readiness.md)。
需要指出的是：数据库可读就绪信号仅代表只读探测正常，不代表数据写入能力、系统延迟保证或生产级流量准入标准；可靠性发布演练待后续开展。

<a id="专题案例"></a>
<a id="后续专题"></a>
## 工程实践附录（非生产交付）

可靠性演练基于预设脚本运行，未发起任何外部 CLI 诊断或修复调用；影响分析与故障诊断实验则在严格隔离（零外部工具）的环境下生成候选补丁，不创建生产 PR。相关模型输出详见[变更影响输出分析](change-impact.md#copilot-实际生成了什么)与[故障诊断输出分析](engineering-judgment.md#copilot-实际说了什么)。

| 专题研究 | 客观实验结果 | 严谨边界说明 |
|---|---|---|
| [发布可靠性](reliability.md) | 通过 23 项资格断言并成功消除 6 处变异故障；2 次全新数据卷下的准入拦截、回退与恢复演练全部通过 | 属于运行观察性质，后续[维护审查 #28](https://github.com/huangyingting/ai-native-sdlc-demo/issues/28)待安排 |
| [变更影响分析](change-impact.md) | 生成的影响分析方案经审查批准，单次生成的隔离候选代码通过 15 项既有回归测试和 35 项独立行为检查 | [审计记录 #30](https://github.com/huangyingting/ai-native-sdlc-demo/issues/30)完整保留了方案与验证数据；主干基线保持未修改 |
| [故障诊断](engineering-judgment.md) | 6 组行为修复均通过功能测试；2 组环境配置类的分类标签出现判定偏差 | 真实保留分类未达标的记录，绝不使用测试绿灯掩饰偏差 |
| [Agent 策略评估](engineering-judgment.md) | 覆盖 6 组案例共 9 次实际模型调用，完全验收通过率为 4/6；量化统计了 Token 用量与耗时 | 样本量有限，不作为两种策略的通用统计学优劣排序 |

[工程实验总记录 #29](https://github.com/huangyingting/ai-native-sdlc-demo/issues/29)
归档了全部实测数据。在真实模型调用中均严格校验了工具调用权限；
较早前因隔离兼容性检查未通过而被拒绝的方案同样作为负样本独立保留；
不公开原始私有提示词、完整会话历史或完整候选源文件；仅公开选定且[经人工审查的准确输出与差异摘录](assets/engineering/copilot-excerpts.json)。

各专题独立记录了完整的输入、修改范围、客观实测指标与未验证项边界。

## 截图归档与证据保留规范

在需求发起、文档发布、审批决策、测试执行、镜像发布、业务操作与实验结项等核心节点均进行了规范截图。
每一项架构决策及其衍生出的各版本文档均独立归档，绝不仅保留最终版本。
决策截图尽可能完整包含自动化指令的处理回执，确保所有字迹与时间戳清晰可读。严禁对包含私密凭据的界面进行截图。
每张截图均详细登记了页面地址、拍摄时间戳、关联的 Commit SHA 或 Actions 运行编号与轮次，以及图像文件哈希值。截图仅作为演示讲解的辅助凭据，不可替代仓库中真实的执行日志与代码证据。

所有资料在公开归档前均经过严格的安全审查。账号凭据、私有提示词、未脱敏事件流、本地临时数据库与敏感日志严禁提交至 Git。演练中的失败尝试均作为真实交付摩擦独立记录，后续的重试成功绝不覆盖或删除早期的失败记录。
