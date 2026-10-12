<a id="northstar-it-service-desk"></a>
# Northstar IT 服务台

[English](README.en.md)

这是一个精简、贴近企业实际场景的 IT 应用，用来演示
GitHub Copilot 从 Issue 到 PR 的工作流程。

<a id="included-workflow"></a>
## 已有功能与流程

- 查看与筛选 IT 事件及服务请求。
- 创建工单，并由服务端校验输入。
- 查看工单详情。
- 在工单详情页，从 Alex Chen 与 Sam Rivera 名单中分配、改派或清除负责人；
  工单可以没有负责人。
- 同时使用搜索、状态、优先级，以及负责人或未分配条件来筛选队列。
- 将工单依次移转至待处理、处理中、已解决及已关闭状态。
- 将数据持久化存储于本地 SQLite 数据库。

搜索会匹配标题、申请人姓名及 `INC-0001` 等工单编号，不区分大小写。
也支持 `1`、`0001` 与 `inc-1` 等数字 ID 或简写，并忽略前后空白。
搜索结果仍会应用状态、优先级及负责人筛选条件。
新工单默认为未分配；既有数据库升级时不会改动工单数据或时间戳。

自定义下拉菜单会将键盘焦点保留在带标签的组合框上。
按 Enter、Space 或方向键打开；使用方向键、Home/End 或输入文字快速定位来浏览。
Enter/Space 确认选择，Escape 取消尚未确认的移动，
Tab/Shift+Tab 则确认选择并正常移动焦点。
点击菜单外部或将焦点移开，也会确认选择并关闭弹出菜单。
即使工单队列很短或没有数据，菜单仍会显示在上层，不会被裁切。

应用刻意维持在实用的第一版范围。
分配历史、SLA 策略、评论、访问控制、通知及报表，
都适合作为后续 GitHub Issues，用于现场 Copilot 演示。

<a id="run-locally"></a>
## 在本地运行

此演示使用内置的 `node:sqlite` 模块，因此需要 Node.js 24 或更新版本。

```powershell
npm install
npm run dev
```

打开 <http://localhost:3000>。

系统会自动在 `data/service-desk.db` 创建数据库并填入初始数据。
只有在可随时丢弃的本地开发环境中，才可删除该文件来重置演示数据。
不要为了演示重置共享的工作副本；请使用下文说明的隔离预备副本。

<a id="liveness-and-database-readiness"></a>
## 进程存活与数据库就绪

`GET /api/health` 不依赖数据库，返回 200 和 `{"status":"ok"}`。
`GET /api/ready` 每次请求都对已配置的工单数据库执行最新的最小只读查询：
返回 200 `{"status":"ready"}` 或 503 `{"status":"unavailable"}`，
两者均使用 JSON 内容类型及 `Cache-Control: no-store`。
HEAD 检查同一当前依赖，但不返回正文；
POST、PUT、PATCH、DELETE 和 OPTIONS 返回 405 及 `Allow: GET, HEAD`，不初始化数据库。
查询参数及 GET 正文不能覆盖配置或 SQL。

首次探测可以触发现有延迟初始化和新数据库的种子数据。
已有记录、时间戳及有意保持为空的表会保留。
每次失败只记录一个固定的通用诊断事件，不记录原始异常。
这是数据库读取就绪信号，不是可写保证、响应期限或生产认证。
指定产物和验证边界见[已验收的就绪检查案例](../../docs/cases/readiness.md)。

<a id="validate"></a>
## 验证

```powershell
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

单元测试使用内存数据库，并以 jsdom 环境测试下拉菜单与仪表盘的回归情况，
不会修改 `data/service-desk.db`。容器冒烟检查以稳定的仪表盘 HTML 标记
`data-testid="service-desk-dashboard"` 为目标，而不是可见的标题文字。

Pull request CI 会针对所有变更路径运行，包括文档，确保必需的
`validate` 与 `container-smoke` 检查不会缺失。
这个小型演示优先确保必需检查可靠运行，而不是优化 PR 路径筛选；
push CI 仍按路径限定范围。新 Intent 的 Spec/Plan 审查会在父 Issue 上，
通过 **Brownfield Delivery · Documents** 运行：只验证文档结构与范围，
不运行应用测试、构建或容器冒烟任务。
既有生命周期分支上的旧版 Spec/Plan PR 仍会跳过应用检查。
受控 Red 的 Tests PR 保留独立的 TDD 验证，而非一般 Green 检查。
凡以默认分支为目标的 PR，一律运行 Green 检查，不受 PR 正文中的阶段文字影响。
安装演示依赖后，CI 也会以真正的 Vitest setup/teardown 失败场景，
以及有效的 Red/Green 测试，验证生命周期报告器。

<a id="suggested-brownfield-delivery-intent"></a>
## 建议的既有系统交付意图

在 **Issues > New issue** 中选择
**Brownfield human-gated delivery: Submit an intent**。
标题与五个字段已预填以下目标：明确工单责任归属，
让服务人员与团队主管了解责任并协调交接。
由人审阅并提交 Intent；AI 编写的是 Spec，而不是 Intent。
表单涵盖问题、预期成果、受影响的用户与系统、限制，以及待明确的问题：

- 工单是否可以保持未分配？
- 负责人应从预先定义的本地名单中选择，还是可以自由输入？
- 只显示责任归属是否足够，还是需要按负责人筛选？

完成仓库设置后，可直接提交默认内容启动 Spec 阶段，或改写为其他功能。
这些问题应通过 Spec 审查逐一解决。
新 Intent 请留在父 Issue，阅读完整呈现的 Spec/Plan 修订评论、
讨论待明确的问题，并提交明确命令：

```text
/sdlc revise spec
Tickets may remain unassigned. Clarify how existing ticket data is preserved.
```

使用 `/sdlc revise plan` 并附上反馈以修订 Plan；只批准最新版本，
例如使用 `/sdlc approve spec v2` 或 `/sdlc approve plan v1`。
这些是仓库自定义的 Actions 命令，不是内置的 `@copilot` 命令。
一般讨论不会调用 AI，也不会批准任何阶段。
`/sdlc retry` 只用于恢复文档生成／交接，不会重跑工程 CI、Advance 或 Publish。

只读的 Copilot CLI 在 Actions 中生成文档；另外的可信任务负责发布修订，
并将人工批准快照记录在 Git 的 `brownfield-documents/<intent>` 分支。
交接前若修订 Spec，其批准与 Plan 都会失效。
Plan 完成所需批准后，系统会冻结文档，以已批准的文档提交创建工程分支，
接着只将 TDD Tests 分配给 Coding Agent。
Tests 与 Implementation 仍使用人工审查的 PR、受控 Red/Green 检查，
以及经验证的镜像交付；它们不能修改已批准文档或批准状态。

任何基于 Issue 的运行（`issue-v1`），包括在验收机制升级前启动的运行，
即使冒烟检查成功，Intent 仍会保持打开，等待**人工验收**。
请使用该次验证的确切镜像，逐一执行已批准的验收场景，
再于父 Issue 新增一条未经编辑的评论：

```text
/sdlc accept sha256:<64hex>
<Describe the scenarios actually exercised and observed results.>
```

将占位符替换为当前已发布的摘要值。
验收会使用配置好的 Implementation 审查者身份与法定人数，
并绑定本次验证的摘要值、合并 SHA、Actions 运行 ID 与尝试次数。
新的验证会使先前验收失效。若要拒绝，请使用
`/sdlc reject sha256:<64hex>` 并附上实际观察结果；
拒绝后必须再次验证，才能进行验收。
已完成且已验收的运行是终止状态；下一次交付必须创建新的 Intent。
合并后若需修正代码或范围，应创建有关联的新 Intent，而非修改已封存文档。
只有人工验收才能完成 Issue 型运行并删除工程分支；
文档分支与运行记录分支会保留。

既有采用文档 PR 的 Intent 仍维持**旧版 Spec/Plan PR 模式**，
不会自动迁移，也不改变原有的完成行为。
通过 Issue 交接创建了工程分支，并不表示该运行属于旧版模式。

<a id="repeatable-presentation"></a>
## 可重复的现场演示

在仓库根目录运行 `npm run demo:brownfield -- help`，
可查看[演示工具包](../../tools/brownfield-demo/README.md)的命令参考。
演示专用的[场景清单](.github/brownfield-human-gated-delivery/scenarios)
说明正常流程、Spec 变更／Plan 失效，以及恢复演练。
请将固定的源提交导出至独立且尚不存在的目标目录；
不要复制机密、本地 SQLite 数据，也不要重置源工作副本。
创建远程仓库与发布仍须由操作者明确执行。

在消耗模型时间前，先执行只读预检。
展示交付镜像时，使用已验证的摘要值，而不是可变标签或先前启动的开发服务器；
只清理工具包管理的容器。Environment 的冒烟检查不会创建持续提供服务的托管站点。
只读 HTML 回放使用真正的运行证据生成，并对内容进行转义处理，
不是模拟的批准或测试结果。
请依照[演示者操作手册](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery-walkthrough.md#presenter-runbook-and-readiness)：
前置条件已配置好，不代表已达到 Demo Ready；
目前也尚未建立三次已完成的隔离运行证据。

完整的 Intent、Spec、Plan、TDD、实现与交付闭环，请参阅
[既有系统人工关卡交付演示](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery.md)。
