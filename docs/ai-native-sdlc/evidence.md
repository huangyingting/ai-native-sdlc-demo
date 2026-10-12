# Evidence and screenshot register / 证据与截图索引

[Guide index / 指南目录](README.md) ·
[English workshop](en/06-workshop.md) · [中文演示路线](zh/06-workshop.md)

## How to use evidence / 如何使用证据

**EN:** Screenshots are teaching aids, not authoritative substitutes for source,
test results or recorded approvals. New captures were taken on **October 12,
2026**, from public pages in an unauthenticated Chrome session. No page content
was rewritten, translated in-place or staged to simulate success. Blank
captures were discarded. Different viewport sizes are recorded below.

**中文：** 截图用于讲解，不能代替源代码、测试结果或批准记录。新截图均在
**2026 年 10 月 12 日** 用未登录 Chrome 访问公开页面时获取，没有改写页面、
在原页面伪装翻译，或布置虚构成功状态。空白截图已丢弃，尺寸见下表。

**EN:** The three application images are reused unchanged from the earlier
September 27 ownership case. They are not images of the later readiness
instance. Old localhost ports were unreachable during this documentation
work; no new runtime acceptance or model experiment was performed.

**中文：** 三张应用图原样复用 9 月 27 日早期 ownership 案例，不是后续 readiness
实例截图。编写期间旧 localhost 端口不可达，没有进行新运行验收或模型实验。

Click an image in a chapter to open its source page or full-resolution asset.
GitHub may require normal sign-in for Actions logs or artifact downloads.
Artifact retention may expire even while a run summary remains visible.
Use durable reports and commit references; mark unavailable raw evidence as
unavailable. Do not reconstruct a fictional successful log.

点击章节图片可以打开来源页面或原尺寸图片。Actions 日志或 artifact 下载可能需要
正常登录；运行摘要仍在时，artifact 也可能已经过期。使用持久报告和提交引用，
原始证据不可用就标注不可用，不要补造“成功日志”。

## Screenshot inventory / 截图清单

| Figure / 图 | Asset / 图片 | Capture / 截图日期 | Pixels / 尺寸 | Source / 来源 |
|---|---|---|---|---|
| A | [Ticket queue / 工单队列](../assets/brownfield-case-study/ticket-queue.png) | 2026-09-27 | 1440 × 1200 | [Earlier ownership case / 早期归属案例](../brownfield-human-gated-delivery-case-study.md#4-the-delivered-application) |
| B | [Discovery Intent](../assets/ai-native-sdlc-handbook/intent-discovery.png) | 2026-10-12 | 1440 × 1080 | [huangyingting/ai-native-sdlc-discovery-demo#1](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1) |
| B1 | [Approved Spec / 已批准规格](../assets/ai-native-sdlc-handbook/approved-spec.png) | 2026-10-12 | 1440 × 1200 | [Immutable Spec](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/blob/073c6fb0831e38d5513e22ac193a7bdaac2918cf/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| B2 | [Approved Plan / 已批准计划](../assets/ai-native-sdlc-handbook/approved-plan.png) | 2026-10-12 | 1440 × 1200 | [Immutable Plan](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/blob/073c6fb0831e38d5513e22ac193a7bdaac2918cf/docs/delivery-runs/brownfield-human-gated-delivery/1/plan.md) |
| C | [Tests PR / 测试 PR](../assets/ai-native-sdlc-handbook/tests-review.png) | 2026-10-12 | 1440 × 1080 | [huangyingting/ai-native-sdlc-discovery-demo#6](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/6) |
| D | [Publish verification / 发布验证](../assets/ai-native-sdlc-handbook/publish-verification.png) | 2026-10-12 | 1440 × 1080 | [Run 36381916918, attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36381916918/attempts/2) |
| E | [Ticket detail / 工单详情](../assets/brownfield-case-study/ticket-detail.png) | 2026-09-27 | 1440 × 1100 | [Earlier ownership case / 早期归属案例](../brownfield-human-gated-delivery-case-study.md#4-the-delivered-application) |
| F | [Combined filters / 组合筛选](../assets/brownfield-case-study/owner-filter.png) | 2026-09-27 | 1440 × 1000 | [Earlier ownership case / 早期归属案例](../brownfield-human-gated-delivery-case-study.md#4-the-delivered-application) |
| G | [Maintenance continuation / 维护延续](../assets/ai-native-sdlc-handbook/maintenance-continuation.png) | 2026-10-12 | 1440 × 1080 | [huangyingting/ai-native-sdlc-discovery-demo#17](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/17) |
| H | [Reliability execution / 可靠性运行](../assets/ai-native-sdlc-handbook/reliability-run.png) | 2026-10-12 | 1440 × 1080 | [Run 36388446065](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36388446065) |
| I | [Engineering results / 工程结果](../assets/ai-native-sdlc-handbook/engineering-results.png) | 2026-10-12 | 1440 × 1080 | [huangyingting/ai-native-sdlc-discovery-demo#27](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/27) |
| J | [Trace detail / 调用详情](../assets/ai-native-sdlc-handbook/trace-detail.png) | 2026-10-12 | 1440 × 1080 | [Trace run 36092002982](https://huangyingting.github.io/ai-native-sdlc/viewer/?run=36092002982) |
| J1 | [Trace collection / 报告集合](../assets/ai-native-sdlc-handbook/trace-site.png) | 2026-10-12 | 1440 × 1080 | [Existing GitHub Pages site](https://huangyingting.github.io/ai-native-sdlc/) |

### What the pictures establish / 图片能证明到哪里

- **A/E/F:** visible synthetic application states, not a new database/persistence
  test. 可见的合成应用状态，不是新的数据库／持久化测试。
- **B/B1/B2:** problem, approved content and planned evidence. A Plan table is
  not executed test evidence. 问题、批准内容和计划证据；Plan 表格不是已执行测试。
- **C:** Tests PR scope and navigation; open actual review/checks for conclusions.
  测试 PR 范围和入口；结论要查看实际审查及检查。
- **D/H:** historical Actions summaries, not ongoing uptime. Artifact archive
  digests are not container digests. 历史 Actions 摘要，不是持续在线证明；artifact
  下载包摘要不是容器摘要。
- **G:** a continuation that retains failed history. 保留失败历史的延续任务。
- **I:** publication of experiment outcomes, not deployment of the proxy candidate.
  发布实验结果，不是部署代理负责人候选。
- **J/J1:** one observed direct-execution trace, not proof of every supported
  agent pattern. Estimated dollars belong to that viewer's pricing model.
  一个真实直接执行 trace，不证明所有支持模式；估算美元来自该 viewer 的价格模型。

## Primary reading / 主要资料

These existing reports remain the detailed historical record. The bilingual
chapters explain them; they do not replace approved lifecycle artifacts.
以下报告继续作为详细历史记录；双语章节用于解释，不替换已批准生命周期产物。

| Subject / 主题 | Canonical source / 权威来源 |
|---|---|
| Original visual ownership story / 早期可视化归属故事 | [Illustrated case study](../brownfield-human-gated-delivery-case-study.md) |
| Discovery and maintenance / 发现与维护主线 | [Actual discovery-to-maintenance report](../brownfield-discovery-maintenance-rehearsal.md) |
| Running a new lifecycle / 新生命周期操作 | [Step-by-step walkthrough](../brownfield-human-gated-delivery-walkthrough.md) and [policy/command reference](../brownfield-human-gated-delivery.md) |
| Reliability commands / 可靠性命令 | [Three-loop guide](../brownfield-reliability-loops.md) |
| Reliability observations / 可靠性观察 | [Actual rehearsal report](../brownfield-reliability-rehearsal.md) |
| Engineering commands / 工程实验命令 | [Engineering judgment guide](../engineering-judgment-demos.md) |
| Engineering measurements / 工程测量 | [Actual experiment report](../engineering-judgment-rehearsal.md) |
| Agent patterns / Agent 编排模式 | [Pattern comparison](../copilot-cli-agent-orchestration-patterns.md) and [Trace Viewer](../../tools/trace-viewer/README.md) |
| Research behind early-stage choices / 早期阶段研究 | [Intent/Spec/Plan research](../ai-native-sdlc-early-stage-research.md) |
| Research behind delivery controls / 交付阶段研究 | [Build/Verify/Deploy/Operate research](../ai-native-sdlc-delivery-operations-research.md) |

## Compact evidence chain / 精简证据链

| Transition / 转换 | Actual reference / 实际引用 | Key reading / 阅读重点 |
|---|---|---|
| Unresolved → blocked / 未决→阻塞 | [Rejected approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862230300) | No Plan or assignment from premature approval / 过早批准不产生 Plan 或分配 |
| Decisions → Spec / 决策→Spec | [Q-1](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862237360), [Q-2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862260763), [Q-3](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862281080), [Q-4](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862300128) | Separate recorded choices / 分开的已记录选择 |
| Spec/Plan → freeze / 文档→冻结 | [Spec v5 approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862323649), [Plan v1 approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862357531) | Exact historical versions, not reusable commands / 历史精确版本，不是可重复批准命令 |
| Tests → reviewed Red / 测试→经审查 Red | [Review](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/6#pullrequestreview-5333532414), [Red](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36372294023/attempts/2) | Stronger assertions and 10 declared failures / 增强断言及十个声明失败 |
| Ownership → accepted artifact / 归属→接受制品 | [Implementation](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/7), [acceptance](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862969905) | 37-test increment and its own image / 37 项测试增量及其独立镜像 |
| Failed maintenance → continuation / 失败维护→延续 | [Failed implementation](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/14), [new Intent](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/17) | Do not rewrite frozen evidence / 不重写冻结证据 |
| Readiness → accepted artifact / 就绪检查→接受制品 | [Implementation](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/23), [acceptance](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/17#issuecomment-5864107648) | 50-test increment, exact ready/unavailable behavior / 50 项测试增量和精确响应 |
| Recovery → preventive closure / 恢复→预防闭环 | [Maintenance task](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/25), [PR](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/26), [repetition](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36388446065) | Restore availability, then prove preventive change / 先恢复，再验证预防工作 |
| Engineering pilot → honest publication / 工程实验→诚实发布 | [Published results](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/27) | 6/6 repairs; 0/6 complete evidence acceptance / 六次修复通过，完整证据全部未通过 |

## Maintaining both languages / 双语维护规则

1. Keep the six chapter filenames, subsection numbers and cross-language links
   paired. 保持六章文件名、分节编号和语言切换链接对应。
2. Update measurements, commands, limitations and evidence links in both
   languages together. 两种语言同步更新数字、命令、限制和证据链接。
3. Keep command syntax, IDs, hashes and quoted machine output exact; translate
   explanations, not protocol tokens. 命令、编号、哈希和机器输出保持原样。
4. Reuse one screenshot asset across languages; translate alt text and captions.
   Keep original page wording visible. 两种语言共用图片，翻译替代文本与图注，不伪造原页面。
5. Date new observations separately from historical runs. Do not silently
   replace a failed result with a later success. 新观察和历史运行分开标日期，不用后来的成功
   偷换之前失败。
6. Verify local links/anchors and image readability before publication.
   No dependency or application change is needed for ordinary text updates.
   发布前检查链接、锚点及图片可读性；普通文档更新不需要修改依赖或应用。
