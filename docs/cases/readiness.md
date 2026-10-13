# 从进程存活到数据库就绪：一次已验收的系统维护交付实录

[English](readiness.en.md) · [案例索引](README.md) ·
[截图清单与校验记录](assets/readiness/manifest.json)

**最终交付验收结果：**IT 服务台现已具备精准区分进程存活状态（Liveness）与底层数据库读写就绪状态（Readiness）的能力，同时完全保证了前期已交付的工单业务功能不受任何影响。
[需求 Issue #18](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18)
在人工完成确切镜像的端到端验收后正式关闭，时间为**北京时间 2026 年 10 月 13 日 06:38:35**（`2026-10-12T22:38:35Z`）。

这是在演示仓库中真实完成的全流程交付，绝非虚构的历史数据，亦非全方位的生产安全认证。随后的[发布可靠性演练](reliability.md)已记录了 2 次通过的恢复测试，运维维护审查待后续开展。

**交付主线关键标识：**实现代码 [PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26)
由 Coding Agent（`app/copilot-swe-agent`）自主提交。Copilot 生成的代码、Actions 自动化检查与人类最终的明确验收均独立建档留痕，严格区别于受限 CLI 附录中的离线实验（参见[演示目标与 Copilot 角色规范](../copilot-roles.md)）。

## 1. 真实故障现场观察，避免预设先入为主

在先前的工单负责人功能交付验收后，运维团队通过拉起运行同一已发布镜像的两个隔离实例，直观复现了一个典型架构隐患：**单纯依赖进程存活探测，根本无法感知底层数据库是否已经瘫痪。**

| 请求路径 | 正常配置实例 | 注入无效数据库路径的故障实例 |
| --- | --- | --- |
| `GET /api/health` (存活检查) | 200，`{"status":"ok"}` | 200，`{"status":"ok"}` |
| 工单列表页面 | 200，渲染完整工单列表 | 500，服务端报错且无法渲染列表 |
| `GET /api/ready` (就绪检查) | 404 (接口尚未实现) | 404 (接口尚未实现) |

故障对照实例故意将数据库路径配置为无法写入的路径（指向 `/dev/null`），且不挂载持久化数据卷。这属于在临时隔离资源上的受控主动故障注入，用于验证探测能力边界，并非生产事故，亦不推翻此前针对工单负责人功能的验收结论。演练未设置关于客户影响面或平均恢复时间（MTTR）的统计基线。

![注入数据库故障后，存活检查仍正常](assets/readiness/baseline-live-despite-db-failure.png)

![已验收基线中尚不存在就绪接口](assets/readiness/baseline-readiness-missing.png)

在[运维维护需求 Issue](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18)中，团队保留了充分的产品讨论空间，杜绝直接将大模型最初随手给出的 API 接口约定当作已获批准的既定事实。

## 2. 批量记录架构决策，不等于越俎代庖一次性审批所有阶段

为了提高需求澄清效率，系统在 [PR #23](https://github.com/huangyingting/ai-native-sdlc-demo/pull/23) 中引入了原生的批量决策机制。该机制允许评审者使用单条指令原子化记录针对探索问题的多项答复，同时完好保留了后续各交付阶段严格独立的审批门禁。

审查人员通过[发表一条批量决策评论](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124226071)，
集中答复了围绕 Spec v2 提出的 6 个核心技术问题，并直接驱动系统生成了**一份全新的 Spec v3**；此前单独记录的 Q-1 决策历史被规范归档留存。

| 核心决策点 | 确立的技术与架构边界 |
| --- | --- |
| **探测深度** | 每次健康探测请求均基于已配置的持久化存储，对真实的 `tickets` 表执行最小代价的只读查询；已完成初始化但尚无记录的空数据库同样视为健康。 |
| **初始化机制** | 兼容现有的延迟初始化机制及新库种子数据填充，但严禁重置或篡改既有数据记录、历史时间戳与正常的空表。 |
| **HTTP 协议规范** | 就绪返回 200 `ready`，异常返回 503 `unavailable`；响应必须包含 JSON 格式且声明 `Cache-Control: no-store`；支持 HEAD 方法实时探测（无正文）；其余非法 HTTP 方法直接返回 405 Method Not Allowed 且不触发底层探测。 |
| **诊断日志与时延** | 每次探测失败必须记录结构化、脱敏的异常事件；不盲目向外承诺毫秒级 SLA 或锁等待超时阈值，相关优化留作后续待办。 |
| **故障恢复** | 修正配置后重建实例；挂载已有数据卷进行独立对照验证，确保真实的 HTTP 路由与核心业务读写均恢复正常。 |
| **探测信号语义** | 该信号仅证明底层数据库当前处于可读状态，不代表可写性保证、不代表完整应用链路无异常，更不能单凭此信号直接放行生产环境流量。 |

探测失败时返回的状态值 `unavailable` 与行业现行的健康探测工具规范高度一致。虽然在前期冻结的探索中曾出现过 `unready` 的建议，但最终生效且作为唯一验收依据的是正式批准的决策与验收场景。

![同一已发布版本上的六项批量决定](assets/readiness/batch-decisions.png)

### 故障自愈工作流，真实保留失败审计记录

在批量决策成功留痕后，由于自动化命令正文被每个回答重复携带，导致下游文档生成请求超过了既有的 110 KB 限制。
[PR #24](https://github.com/huangyingting/ai-native-sdlc-demo/pull/24)
迅速通过对重复上下文进行去重修复了这一缺陷，既未丢弃任何已确认的架构决策，亦未盲目调大请求体积上限。修复后的实际请求体积收敛至 **82,177 字节**。流水线随后通过常规的自动重试机制生成了待审文档，无需人类重新录入整批决策。

![单独保留的原始请求过大失败](assets/readiness/batch-request-size-failure.png)

演练中偶发的 GitHub API 速率限制亦通过标准重试策略平稳恢复。对于一度丢失的评审分支，团队在核实了 GitHub Actions 机器人提交的合规校验摘要后才安全恢复，杜绝在未查明真实原因前臆造技术结论。

## 3. 分别审批精确版本的规格说明与实施计划

演进后的 [Spec v3](https://github.com/huangyingting/ai-native-sdlc-demo/blob/06e9fe31d5c00bb75a2438e49af00ea4fac8b134/docs/delivery-runs/brownfield-human-gated-delivery/18/spec.md)
详细定义了 9 项验收场景。
[审批记录](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124496828)
严格绑定内容哈希 `15c4d4948968d6e1d96375dbe54c95452528368ab08096440e44b025655a0a3a` 及全部决策上下文。

![六项决定已经纳入 Spec v3](assets/readiness/spec-v3.png)

[Plan v2](https://github.com/huangyingting/ai-native-sdlc-demo/blob/06e9fe31d5c00bb75a2438e49af00ea4fac8b134/docs/delivery-runs/brownfield-human-gated-delivery/18/plan.md)
将上述 9 项验收场景系统化映射为 6 项具体工程任务。
审查环节补充了精确匹配的预期失败清单、测试用例独立收集验证机制，以及持久化数据卷在任务交接中的排他性挂载约定。
冻结规格中关于候选版本的文字描述，不影响已留存的可信审批记录。
[实施计划批准](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124971454)
与先前的规格审批、后续的代码审查均作为独立的门禁步骤分别记录。

![包含安全存储角色与受控 Red 的已审查计划](assets/readiness/plan-v2.png)

## 4. 严格审查受控 Red 测试的有效性

[测试套件 PR #25](https://github.com/huangyingting/ai-native-sdlc-demo/pull/25)
被严格限制为仅修改 3 个测试文件及预期失败清单，严禁偷跑业务代码。
虽然初始提交在自动化门禁中达成了形式上的受控 Red，但人工深度审查依然识别出多处逻辑漏洞：

- 热存储下的 GET 探测测试未先发出成功的就绪请求，极易漏测路由层的成功结果缓存污染。
- 简单的断言把日志对象转为 JSON 比对，会因原生 `Error` 被序列化为 `{}` 而放过异常泄漏风险。
- 除校验 Query 参数外，还必须断言防范 GET 请求正文读取方法被错误调用。

在收到审查意见后，测试用例补充了“先成功、再失败、后恢复”的全流程断言、针对初始化异常与 GET/HEAD 失败的脱敏日志断言，以及针对请求正文读取的防护检查。获批测试用例的完整名称与预期失败清单保持严格一致。

![绑定准确提交的修改请求](assets/readiness/tests-request-changes.png)

| Node.js 24 环境校验维度 | 实际检查结果 |
| --- | --- |
| 既有应用回归测试基线 | 全部 38 项测试绿灯通过 |
| 审查通过的测试提交 `369c476` | 共 47 项：39 项通过，8 项为精准匹配的预期业务断言失败（Red） |
| 测试钩子（hook）、测试套件、未捕获异常 | 0 |
| 测试用例收集、ESLint 检查、生产构建 | 全部通过 |

![受控 Red 通过，需求失败没有被当成基础设施错误](assets/readiness/tests-red.png)

在获得[显式测试批准](https://github.com/huangyingting/ai-native-sdlc-demo/pull/25#pullrequestreview-5491931657)后，
分支按保护规则压缩合并生成提交 `98178b7`，随后自动下发实现任务。仓库内的 Copilot 运行通过维护者触发的标准重跑机制启动 CI 门禁；这属于合规的构建触发，并非绕过安全门禁。

## 5. 编码实现：使已冻结的契约全量转绿

由 Coding Agent 提交的[功能实现 PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26)
精准聚焦于两处生产代码改造：在 `TicketStore.checkReadiness()` 中增加只读探测逻辑，并提供按请求动态探测的 Node.js 就绪路由。固定执行的 `SELECT id FROM tickets LIMIT 1` 查询仅用于验证数据库可读，绝不写入业务数据，亦不拼接任何未经校验的动态 SQL。

**全量 47 项测试实现 100% 绿灯转绿**，包含之前处于受控 Red 的 8 项核心测试。
本次交付所涉及的 7 个已获批文档与测试文件保持逐字节一致。针对生产独立运行构建，流水线还执行了额外的 37 项 HTTP 行为观察，所有指标均作为候选实现证据完整留痕。

![冻结产物及 Green CI](assets/readiness/implementation-green.png)

在本地 Docker 构建验证期间，曾因网络问题偶发 npm TLS 握手异常；团队坚持不关闭安全校验，Docker CI 顺利跑通，本地 HTTP 验收检查亦基于相同源码在 Node.js 24 独立生产构建中严谨复核。

PR 最终变基指向 `main` 主干。严格的最新基线保护规则要求同步此前已批准的两项批量工作流提交。
全部 9 个生产文件的 Hash 严格保持一致。GitHub 为该次仅同步基线的提交 `64406b5` 自动保留了已有的[实现批准状态](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26#pullrequestreview-5496196451)，无需重复提交批准。CI 绿灯通过后，PR 遵循保护规则压缩合并为主干提交 `06e9fe3`。

![实现通过保护流程合并，不使用管理员绕过](assets/readiness/implementation-merged.png)

## 6. 验证不可变发布摘要与真实故障恢复

[发布流水线（Run 38311999223，Attempt 2）](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38311999223/attempts/2)
顺利构建并发布了不可变生产镜像：

```text
ghcr.io/huangyingting/ai-native-sdlc-demo-it-service-desk@sha256:84bff5d0817cafec6569b394b99eb92cc8b60e98b450bea9484992bcf11bc0d4
```

经拉取验证，该镜像的 OCI 构建元数据严格关联至合并提交 `06e9fe31d5c00bb75a2438e49af00ea4fac8b134`，上游代码仓指向明确。[主干合并 CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38311998601)
亦通过了全量 47 项测试。杜绝以随时间变化的分支名或工作流别名替代确切的镜像身份。

![发布及指定摘要验证成功](assets/readiness/publication.png)

演练团队基于该镜像摘要同时启动了 3 个隔离实例：使用独立卷的健康对照组、挂载已填充数据卷的持久化实例，以及未挂载卷的无效路径故障实例。健康对照组在整个恢复与交接演练期间持续保持就绪。在将保留卷重新挂载至修复实例前，先停止并销毁先前的故障容器，防止多实例并发访问导致 SQLite 文件损坏。

| 故障与恢复场景 | 实测观察结论 |
| --- | --- |
| **无效数据库配置** | 存活检查正常返回 200；就绪检查精确拦截并返回 503，响应正文严格为 `{"status":"unavailable"}` |
| **修复配置后重建** | 就绪检查恢复返回 200；工单列表与详情页数据完全恢复可读 |
| **持久化存储数据保留** | 原有的 4 条存量工单数据及创建/更新时间戳完全保持未变 |
| **空数据库冷启动** | 初始化的空数据库无需预置种子数据即可标记为就绪，重启后数据结构完好 |
| **运行时动态故障注入** | 在同一运行进程中，精准复现了由“就绪”变为“不可用”、再恢复为“就绪”的完整生命周期；GET、HEAD 与脱敏日志均通过检验 |
| **非法输入与非标请求** | HTTP GET 请求正文与多余 Query 参数均被安全忽略；其余非标 HTTP 方法绝不误触发底层数据库初始化 |

![不可用的就绪状态与进程存活不同](assets/readiness/fault-readiness.png)

![同一个故障进程仍保持存活](assets/readiness/fault-liveness.png)

![修复配置后恢复就绪](assets/readiness/repaired-readiness.png)

![空数据库重启后仍然就绪](assets/readiness/empty-table.png)

### 结合真实业务操作端到端核验，绝不仅靠接口探测

在完成接口探测验证后，测试人员通过浏览器在修复后的应用上发起新建工单请求，并在 4 种工单状态下分别对“指派 Alex Chen”、“转交 Sam Rivera”与“清空分配”共 **12 项流转组合**进行了全面复核。状态更新、非法输入容错、空操作时间戳保持不变，以及 **7 项多维组合筛选**全部通过验证。面对非法状态输入，系统保持既有的 500 容错表现，底层数据库未发生非法写入。

历史的 4 条初始工单始终未受任何修改；演练中的状态变动仅作用于本次新建的演示工单。密集的 GET 与 HEAD 健康检查探测未对存量工单的数据与时间戳产生任何副作用。

![新建工单仍从未分配状态开始](assets/readiness/created-unassigned.png)

![已关闭工单仍能清空负责人](assets/readiness/cleared-closed.png)

![搜索、负责人、状态和优先级同时生效](assets/readiness/filters.png)

本次演练中涉及的全部 7 个任务容器与 3 个临时数据卷均在复核结束后安全销毁。
私有工单数据与调试原始日志未对外公开。21 张高清过程截图的时间戳、来源标识、分辨率与 Hash 值均收录在[校验清单](assets/readiness/manifest.json)中。

## 7. 终审验收交付物，绝不以代码审批替代产物验收

在[全量证据审计汇总](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133700328)
由业务负责人人工复核无误后，正式签署[最终验收指令](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133959987)。
工作流回执与[已验收状态归档](https://github.com/huangyingting/ai-native-sdlc-demo/blob/b65448cded63331bfab37e5c9c35e8fcd461294b/docs/delivery-runs/brownfield-human-gated-delivery/18/run-state.json)将本次交付精确绑定至发布流水线 `38311999223`（第 2 次运行）。业务需求 Issue 只有在通过该终审关卡后才宣告关闭，坚决杜绝因单测绿灯、代码合并或冒烟脚本通过而盲目提前关闭 Issue。

![显式验收及记录的关闭结果](assets/readiness/accepted-receipt.png)

**严谨的技术边界：**就绪探测正常仅证明当前底层数据库可读，并不代表数据库具备写入能力、不代表复杂业务全链路绝对健康、不代表生产级延迟 SLA 保障，更不等于已完成全面的生产环境准入审计。存量基线中的依赖隐患、高并发数据库锁竞争评测与后续预防性维护仍待开展。本演练不作任何关于改善生产故障率或投资回报率（ROI）的主观宣称。
