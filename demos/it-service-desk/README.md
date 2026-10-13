<a id="northstar-it-service-desk"></a>
# Northstar IT 服务台

[English](README.en.md)

这是一个精简、贴近企业实际业务场景的 IT 服务台应用，用于完整演示 GitHub Copilot 从 Issue 需求澄清到 PR 代码落地的全流程 AI 原生交付模式。

<a id="included-workflow"></a>
## 核心业务功能与流程

- **工单管理**：查看并筛选 IT 事件（Incident）与服务请求（Service Request）；支持新建工单并由服务端校验参数完整性。
- **工单详情与流转**：查看工单详情；支持将工单状态按序流转至待处理（Open）、处理中（In Progress）、已解决（Resolved）及已关闭（Closed）。
- **负责人管理与交接**：在工单详情页，支持从内置名单（Alex Chen 与 Sam Rivera）中分配、转交或清空负责人；工单允许保持未分配状态。
- **多维组合筛选**：支持同时结合关键词搜索、状态、优先级以及负责人（包含特定成员或“未分配”）条件，对工单队列进行高效检索。
- **本地持久化存储**：底层基于 Node.js 原生内置的 SQLite 模块实现数据持久化。

工单检索支持对标题、申请人姓名及类似 `INC-0001` 的工单编号进行大小写不敏感的前缀与模糊匹配；同时支持直接输入纯数字（如 `1`、`0001`）或简写编号（如 `inc-1`），系统会自动去除首尾空白字符。搜索结果依然受状态、优先级及负责人条件的组合约束。新创建的工单默认处于“未分配”状态；数据库表结构升级时完整保留历史存量数据与时间戳。

前端自定义下拉选择器具备良好的无障碍支持（A11y），键盘焦点会始终锚定在带标签的组合框上。支持使用 Enter、Space 或方向键展开下拉；使用方向键、Home/End 或键入拼音/字母快速定位选项；Enter/Space 确认选中；Escape 撤销未确认的焦点移动；Tab/Shift+Tab 确认当前选中项并自然流转焦点；点击外部遮罩亦会自动确认并关闭下拉浮层。即使在工单列表极短或处于空态占位时，下拉菜单亦能自适应浮于上层，杜绝页面裁切。

应用特意维持在实用的 MVP（最小可行产品）边界内。更复杂的流转历史、SLA 告警策略、工单评论、细粒度权限控制、外部通知及统计报表，非常适合作为后续的实战 Issue，用于现场开展 Copilot 结对或交付演练。

<a id="run-locally"></a>
## 本地开发与运行

本应用采用 Node.js 原生的 `node:sqlite` 模块，因此要求运行环境为 **Node.js 24 或更高版本**。

```powershell
npm install
npm run dev
```

在浏览器中访问 <http://localhost:3000> 即可体验。

应用初次启动时，会自动在 `data/service-desk.db` 路径下创建数据库文件并初始化种子数据。该文件仅可在随用随弃的本地开发环境中删除以重置测试数据；切勿为了演示效果而随意清空共享环境中的数据文件，建议采用下文说明的隔离测试目录。

<a id="liveness-and-database-readiness"></a>
## 进程存活与数据库就绪探测机制

- **存活探测 (Liveness)**：`GET /api/health` 不触碰底层数据库，成功时直接返回 200 与 `{"status":"ok"}`。
- **就绪探测 (Readiness)**：`GET /api/ready` 在每次请求时，均基于当前配置的持久化存储对真实 `tickets` 表执行最小代价的只读查询：正常时返回 200 `{"status":"ready"}`；异常时返回 503 `{"status":"unavailable"}`，两者均携带 JSON 响应头与 `Cache-Control: no-store` 禁用缓存。
- **请求方法约束**：HEAD 方法执行与 GET 相同的底层依赖探测但省去响应正文；POST、PUT、PATCH、DELETE 与 OPTIONS 方法直接拦截并返回 405 Method Not Allowed 及 `Allow: GET, HEAD` 头，且绝不误触发底层数据库初始化。请求正文及 Query 参数无法篡改配置或拼接动态 SQL。

首次健康探测可触发延迟初始化与新库种子数据填充；已有工单记录、历史时间戳以及正常的空表结构均会妥善保留。探测失败时仅在日志中输出结构化、脱敏的通用诊断事件，杜绝泄露未经处理的原生异常信息。该信号仅代表底层数据库可读，不代表写入保障、不代表延迟时效承诺，亦不构成生产准入认证。（详见[数据库就绪检查案例实录](../../docs/cases/readiness.md)）。

<a id="validate"></a>
## 自动化测试与质量门禁

```powershell
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

单元测试采用内存数据库（`:memory:`），并在 jsdom 模拟环境中严格验证下拉组件与仪表盘界面的回归情况，绝不会修改本地的 `data/service-desk.db` 文件。容器冒烟测试精准以稳定的前端测试标记 `data-testid="service-desk-dashboard"` 作为断言目标，杜绝因展示文案变动引发脆弱的测试断裂。

Pull Request CI 会覆盖所有变更路径（包含纯文档变更），以确保必须的 `validate` 校验与 `container-smoke` 容器冒烟检查无一遗漏。针对新需求发起（Intent）的规格/实施计划审查，会由主 Issue 下的 **Brownfield Delivery · Documents** 工作流承载：该任务仅验证文档的格式规范与范围边界，不会多余运行耗时的前端构建或容器打包任务。
既有分支上历史遗留的旧版 Spec/Plan PR 仍保持跳过应用级检查的既有行为。
受控 Red 状态的测试 PR 拥有专属的独立 TDD 校验门禁，而非简单的一般性全绿检查。凡是以默认主分支为目标的 PR，无论其正文有何说明，均严格执行全量 Green 门禁检查。安装依赖后，CI 亦会针对 Vitest 前后置钩子异常与受控 Red/Green 场景进行严格的生命周期校验。

<a id="suggested-brownfield-delivery-intent"></a>
## 推荐的既有系统交付需求（Intent）范例

在仓库的 **Issues > New issue** 页面中选择 **Brownfield human-gated delivery: Submit an intent** 模板。
标题与各字段已预置了本次标准演示的目标：明确工单责任归属，便于一线工程师与运维主管协同跟进与交接。
Intent 必须由人类业务人员审阅并提交；AI 的职责是据此起草规格说明（Spec），而非代人类发起需求。模板中涵盖了业务痛点、预期产出、影响范围、技术约束以及待明确的探索问题：

- 工单是否允许保持未分配状态？
- 负责人名单应从预先设定的本地名单中选取，还是支持自由文本输入？
- 仅在页面上清晰展示责任人即可，还是需要支持按负责人维度进行检索与组合筛选？

在完成环境准备后，操作人员可直接提交默认内容以启动 Spec 探索阶段，亦可按需修改为其他定制功能。上述问题将通过后续的人机交互与 Spec 审查逐步明确。
在全新的交付流程中，用户始终留在主 Issue 讨论区，直接查阅完整渲染的 Spec/Plan 修订评论、开展交互讨论，并通过明确的指令进行反馈与审批：

```text
/sdlc revise spec
Tickets may remain unassigned. Clarify how existing ticket data is preserved.
```

使用 `/sdlc revise plan` 并附加反馈意见可触发对实施计划的修订；使用 `/sdlc approve spec v2` 或 `/sdlc approve plan v1` 明确批准最新版本。这些指令属于仓库自定义的 GitHub Actions 命令，而非 `@copilot` 内置命令。普通的日常讨论不会触发 AI 生成，亦不会误触发任何审批动作。
`/sdlc retry` 仅用于在网络抖动时恢复文档生成或阶段交接，绝不会随意重跑工程 CI 或发布部署流水线。

在工作流中，只读权限的 Copilot CLI 负责生成文档文本，而可信的系统任务负责发布修订内容并将人类批准的快照归档至 `brownfield-documents/<intent>` Git 分支。在交接进入开发阶段前，一旦修改 Spec，原有的审批凭据与关联的 Plan 即刻自动失效。当 Plan 完成所有必需审批后，系统自动冻结文档并基于已批准的提交拉出工程分支，随后仅将测试编写任务（TDD Tests）单独派发给 Coding Agent。测试与实现阶段继续采用严格的人工 PR 审查、受控 Red/Green 门禁以及镜像端到端验证，严禁在工程阶段擅自篡改已冻结的规格文档。

在所有基于主 Issue 驱动的交付运行（`issue-v1`）中，即便自动化冒烟测试全部通过，该需求 Issue 依然保持开启，等待**最终的人工现场验收**。
业务人员基于拉取的指定版本镜像，逐一执行已获批的验收场景，随后在主 Issue 中发表未经编辑的验收指令：

```text
/sdlc accept sha256:<64hex>
<在此详细记录实际测试的业务场景与核验结果>
```

请将占位符替换为当前实际发布的不可变镜像摘要。系统在处理验收时，会校验提交者的合法权限与法定审批人数，并严格将验收结果与镜像摘要、合并 Commit SHA、Actions 运行 ID 与轮次紧密绑定。一旦触发新的构建验证，先前的验收记录即刻失效。如需驳回，请使用 `/sdlc reject sha256:<64hex>` 并附上实测异常说明；驳回后必须修复并重新通过验证方可再次发起验收。
通过验收并关闭的运行属于终态；后续如需进一步演进，必须发起全新的 Intent。代码合并后若需调整逻辑或扩展范围，应当建立关联的新 Issue，严禁直接篡改已归档封存的旧文档。只有通过人工签署验收，系统才会正式终结交付流转并安全清理工程分支，文档分支与运行审计记录将永久保留。

历史存量的文档 PR 模式将保持其**旧版 Spec/Plan PR 模式**不变，系统不作强制迁移亦不改变其历史行为。通过 Issue 交接创建了工程分支并不代表该次交付退化为旧版模式。

<a id="repeatable-presentation"></a>
## 可重复的高保真现场演示指南

在仓库根目录执行 `npm run demo:brownfield -- help`，可查阅[演示工具包](../../tools/brownfield-demo/README.md)的完整命令体系。
演示专用的[场景清单](.github/brownfield-human-gated-delivery/scenarios)详细定义了黄金标准流程、Spec 变更引发 Plan 失效以及故障恢复演练的操作规程。
在演练前，请将固定的源提交导出至独立的空目录中，严禁复制敏感凭证或本地临时数据库，亦切勿污染主干工作目录。创建远程 GitHub 仓库与发布镜像必须由操作者显式授权执行。

在消耗宝贵的模型配额与时间前，请务必先运行一次只读的本地预检。
展示交付镜像时，使用已验证的摘要值，而不是可变标签或先前启动的开发服务器；
只清理工具包管理的容器。Environment 的冒烟检查不会创建持续提供服务的托管站点。
只读 HTML 回放使用真正的运行证据生成，并对内容进行转义处理，
不是模拟的批准或测试结果。
请依照[演示者操作手册](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery-walkthrough.md#presenter-runbook-and-readiness)：
前置条件已配置好，不代表已达到 Demo Ready；
目前也尚未建立三次已完成的隔离运行证据。

完整的 Intent、Spec、Plan、TDD、实现与交付闭环，请参阅
[既有系统人工关卡交付演示](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery.md)。
