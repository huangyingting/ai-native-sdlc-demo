<a id="repeatable-brownfield-demo-toolkit"></a>
# 可重复的存量项目演示工具包

[English](README.en.md)

这是一个无依赖的 **Node.js 24+** CLI，服务于 IT 服务台的固定负责人工能。
它准备隔离源码树、执行只读就绪检查、在本地运行精确交付镜像，
并导出真实 GitHub 证据。
它绝不创建远程仓库、触发工作流、修改 GitHub、批准工作、重置源码或提交/推送。

**第一次运行演示？**请按
[演练指南的准备顺序](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery-walkthrough.md#1-prepare-the-repository)，
依次完成导出、检查、Git 初始化、远程发布、设置和预检。
本 README 用作命令参考。

架构、截图及已完成开发测试运行的真实证据，见
[图解交付案例](../../docs/cases/ownership.zh-CN.md)。
本 README 仍是命令与安全参考。

**构建/验证/部署/运维后续工作：**
`qualify`、`verify-image` 和 `rehearse` 的使用方法见
[三个可靠性闭环演练指南](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-reliability-loops.md)。
这些新增命令在临时导出中验证就绪测试资格，
并演练真实不可变容器、只读本地流量、隔离故障，以及有明确负责人的维护草案。
它们不会改变不含负责人功能的基线、发布 GitHub 决策或证明生产就绪。
临时运行资源会清理；证据保留在仓库之外。

资格验证识别已提交的旧版 `readiness-v1` 配置（13 项精确断言），
以及当前 `ticket-schema-readiness-v1` 配置
（存储、GET/HEAD 和存活套件中的 23 项精确断言）。
两者都要求捕获六项变异且不修改测试；
当前配置还通过先成功再注入故障的热存储转换，拒绝缓存成功结果。
受控写入使用与资格配置绑定的负责人，不会套用其他演示的名单。
镜像与源码的应用 Git 树必须精确一致。

这是可复用工具，不是 npm workspace 或应用依赖。
在仓库根目录运行：

```sh
node tools/brownfield-demo/cli.mjs --help
node tools/brownfield-demo/cli.mjs scenario list
node tools/brownfield-demo/cli.mjs scenario show ownership-standard
node --test tools/brownfield-demo/tests/*.test.mjs
```

工具包单元测试注入合成基线文件和匹配的测试专用清单，
因此导出的演示实现负责人工能后，它们仍可运行。
生产指纹保持不变：合成或修改后的应用文件仍无法通过真实基线检查。
单元测试通过，不是当前应用仍为无负责人工能基线的证据。

<a id="1-choose-one-fixed-scenario"></a>
## 1. 选择一个固定场景

数据、人工 Intent 模板和未填写的验收清单位于
[`demos/it-service-desk/.github/brownfield-human-gated-delivery/scenarios/`](../../demos/it-service-desk/.github/brownfield-human-gated-delivery/scenarios)。

| ID | 差别在流程，而非功能 |
| --- | --- |
| `ownership-standard` | 正常的版本化人工评审、Red/Green、合并、镜像验证与人工验收 |
| `ownership-spec-revision` | 真实 Spec 反馈与修订；在相同交付前，只批准修订版本 |
| `ownership-failure-recovery` | 真实失败、原因诊断、操作员修复及真正重试，不绕过门禁 |

所有变体都使用恰好两位本地负责人（Avery Stone 和 Jordan Lee）、
默认未分配的工单、详情页分配/重新分配/清除，
以及与现有过滤条件取交集的负责人过滤器。
AC-1 到 AC-5 规定记录、引用集合、非法输入、迁移保留与持久化。
不隐式包含认证、SLA、通知、外部身份或其他功能。
数据清单**不是** Spec、实现、批准、已填充数据库或完成运行声明。

<a id="spec-readiness-profiles"></a>
### Spec 就绪配置

可选交付配置字段 `specReadiness` 只接受 `structural` 或 `decisions-v1`；
省略时表示 `structural`。
当前源仓库为**新**运行选择 `decisions-v1`。
准备过程替换评审人时，会保留已选配置。
未知配置会显式失败。
已有 version-1 文档状态仍采用结构模式；
改变配置不会迁移它们，也不会追溯增加发现要求。

新的 version-2 文档状态把 Spec/Plan 记录与批准绑定到 `contextHash`，
其覆盖发现问题及完整决策历史。
每个问题都会阻止批准，直到已配置的 Spec 评审人在 Intent 下记录回答或显式延期，例如：

```text
/sdlc decide spec v1 Q-1
Outcome: Use the fixed local owner list.
Rationale: External identity is outside this change.
```

对于有意留待以后处理的问题：

```text
/sdlc defer spec v2 Q-2
Rationale: Notifications require separate discovery.
Owner: YOUR_GITHUB_LOGIN
Follow-up: Open a separate Intent after this delivery.
Risk: Owners must inspect the queue until then.
```

要一次回答多个问题，请提交一条以 `/sdlc decide spec vN batch` 开头的新评论，
随后附上带 `json` 围栏的数组：

````text
/sdlc decide spec v1 batch
```json
[
  {
    "action": "decide",
    "questionId": "Q-1",
    "fields": {
      "Outcome": "Use the fixed local owner list.",
      "Rationale": "External identity is outside this change."
    }
  },
  {
    "action": "defer",
    "questionId": "Q-2",
    "fields": {
      "Rationale": "Notifications require separate discovery.",
      "Owner": "YOUR-GITHUB-LOGIN",
      "Follow-up": "Open a separate Intent after this delivery.",
      "Risk": "Owners must inspect the queue until then."
    }
  }
]
```
````

请使用实际已发布版本与问题 ID，而不是这些示例值。
每批允许 1 至 20 个不重复的已登记问题，评论最多 60 KB；
每个 `decide` 或 `defer` 回答必须提供完整字段。
记录前会验证全部回答；任一回答无效时，整批拒绝，不会部分记录。
无论一条被接受的评论包含一个回答还是全部回答，都只请求一次新的 Spec 修订，
不会直接批准尚未审阅的修订。再次发出命令或批准前，先阅读该修订。
每个问题的最新回执具有权威性，早期回执仍保留为证据。
延期是显式且有负责人承担的风险，不是问题已解决的证明。
工具包绝不会发布这些命令或代替评审人作决定。
仅有决策驱动修订**不能**满足 `ownership-spec-revision` 变体：
它仍需要真实的 `/sdlc revise spec` 反馈和已记录修订。

<a id="2-prepare-from-a-full-immutable-source-commit"></a>
## 2. 从完整不可变源提交准备

选择经过评审、包含工具包**和**当前编排，但尚未实现负责人工能的提交。
不要使用已经实现该功能的提交。
粘贴完整的小写 40 字符 Git 提交：

```sh
node tools/brownfield-demo/cli.mjs prepare \
  --source /absolute/path/to/ai-native-sdlc \
  --source-ref FULL_40_HEX_COMMIT \
  --dest /absolute/path/to/new-isolated-demo \
  --reviewer YOUR_GITHUB_LOGIN \
  --scenario ownership-standard
```

上面的 `FULL_40_HEX_COMMIT`、路径和登录名都是占位符。
分支、`HEAD`、短 SHA、修订表达式、标签或不存在的提交都会被拒绝。
目标父目录必须已存在。目标本身必须不存在，并且位于源仓库之外，
包括通过符号链接别名访问的情况。
已有文件、目录和悬空符号链接绝不会被覆盖。

准备过程：

1. 禁用 Git replacement objects，精确解析提供的提交。
2. 检查已跟踪树，并在内存中读取 `git archive`。
   不执行检出、源码重置、远程抓取，也不复制本地工作树。
3. 拒绝链接、子模块、路径遍历、Git 内部文件、特殊 tar 条目和路径冲突。
   支持 Git 普通 tar 与路径 PAX 头。
   归档上限为 128 MiB；不支持的归档在创建目标之前即安全拒绝。
4. 排除常见秘密/配置和本地数据路径，
   包括 `.env`（`.env.example`/`.sample`/`.template` 除外）、
   凭据、私钥扩展名、`.npmrc`、SQLite 文件、日志、依赖和构建输出。
   未跟踪文件不会进入归档。Git `export-ignore` 排除项会记录下来。
5. 检查六个已知无负责人工能应用涉及面的精确 SHA-256 指纹、
   Docker 端口/数据库契约、全部八个编排/CI 工作流文件（包括 Issue 文档评审）、
   设置工具，以及 `run-core.mjs`、`runs.mjs`、`state-store.mjs`。
   缺少新编排的历史提交，即使应用正确，也**未就绪**。
6. 只修改已知交付配置中的
   `stages.{spec,plan,tests,implementation}.reviewers.users/teams`。
   单评审人替换会拒绝需要多次批准的策略。
   它绝不替换自由文本、夹具负责人、代码或文档。
7. 创建 `brownfield-demo-provenance.json`，
   记录源路径/提交、评审人、场景、显式单人模式选择、排除项与导出时间。

**默认不是单人模式。**
只有明确进行单人演练时才添加 `--single-owner`。
它记录这个选择，但不会削弱本地或远程策略。
后续设置/预检必须选择相同模式。
单人模式不是独立的双人评审。

工具不会初始化 Git 仓库。
检查导出结果后，通过日常经过评审的流程，
在**全新隔离仓库**中另行初始化、提交和发布。
不要覆盖源仓库发布。
来源记录包含本地源路径；发布前应审阅。
排除规则不是秘密扫描器：
无法可靠发现那些已经以无害文件名提交的敏感文本。
提交前检查准备好的树。
未经检查，绝不发布包含私有数据的回放证据。

<a id="3-read-only-preflight-on-the-isolated-github-repository"></a>
## 3. 对隔离 GitHub 仓库进行只读预检

```sh
node tools/brownfield-demo/cli.mjs preflight --repo OWNER/REPO
# Only if prepare also explicitly selected solo mode:
node tools/brownfield-demo/cli.mjs preflight --repo OWNER/REPO --single-owner
```

必须提供 GitHub.com 的 `OWNER/REPO`；
不接受隐式 `gh` 仓库选择或任意主机/URL。
`gh` 必须已完成认证。

预检检查 Node/Git/gh/Docker CLI 是否可用，
固定 main 用于基线与来源检查，
检查人工配置和活跃工作流，
并导入仓库的**本地可信**设置预览。
该受支持预览检查规则集状态检查上下文/GitHub Actions 身份、
设置、秘密的**名称**（绝不读取值）、评审人权限和 Copilot 可分配性。
注入的 GitHub 适配器只允许 GET 与只查询 GraphQL；
即使设置实现意外尝试写入，写方法也会被拒绝。
这个 CLI 不提供 `--apply` 或 `--set-token`。

建议的设置变更、预览异常、访问被拒或缺失检查，都表示未完成，而不是成功。
修复时，请在本工具之外人工审阅并运行独立设置工作流/工具，再重复预检。

JSON 输出区分：

- `automatedReady`：受支持的自动检查已通过。
- `readyForLiveRun: false`：这里不能静默认证人工检查。
- `manualChecks`：凭据到期/权限范围/使用资格、计费、继承保护、
  团队访问、Environment 门禁、GHCR 访问及其他操作员检查。
  存在 CLI 不证明可访问 Docker 守护进程。

镜像存在后，可选 `--image ghcr.io/owner/image@sha256:...`
只验证不可变引用语法，不证明发布成功，也不假装产物存在。
预检针对**全新**准备好的基线；
负责人工能落地后，指纹检查会按设计失败。
请用回放检查已完成或进行中的运行，而不要把它们称为全新基线。

验收和回放会把记录的合并 SHA 与 PR 实际 `merged` 时间线事件核对。
固定的 GitHub REST API 版本 `2026-03-10` 不在 PR 响应中返回 `merge_commit_sha`；
PR 最后一个源提交或当前 main 头都不能替代真实合并提交。
对于 `pull_request` 发布运行，关闭后 GitHub 可能返回空 `pull_requests` 数组。
此时回放还会匹配精确 PR 头 SHA、源分支和源仓库。
关联字段缺失、PR 关联矛盾、来源不匹配或运行时账本不可信，都不能证明验收。

第一个 Intent 之前，请从 Actions 页签在 `main` 上使用 **Run workflow**
运行 **IT Service Desk CI**。
这会执行测试、lint、构建和容器冒烟检查，不需要伪造代码变更。
新仓库首次推送相对于导入历史可能只修改来源记录/配置，
因此按路径限定的应用推送触发器，不能证明应用 CI 已运行。

退出码：**0** 表示命令/自动检查成功（人工检查仍未完成）；
**2** 表示预检/就绪未完成；
**1** 表示输入无效、冲突或执行错误。
JSON 输出可以重定向到**操作员新选择的文件**，组成证据包；
普通 shell 重定向有自己的覆盖语义。

<a id="4-run-and-inspect-a-real-delivered-digest-locally"></a>
## 4. 在本地运行并检查真实交付摘要

使用运行发布/验证证据中的真实摘要，而不是可变标签：

```sh
node tools/brownfield-demo/cli.mjs run \
  --repo OWNER/REPO --intent 42 \
  --image ghcr.io/owner/repo-it-service-desk@sha256:FULL_64_HEX_DIGEST \
  --port 3100
```

Docker 执行之前会验证小写引用。
端口必须为 1024–65535 的整数。
CLI 只拉取精确 GHCR 摘要，为仓库/Intent 启动唯一名称容器，
绑定 **127.0.0.1**，在 `/app/data` 挂载隔离命名数据卷，
并设置 `SERVICE_DESK_DB_PATH=/app/data/service-desk.db`。
这与真实应用 Dockerfile 一致（容器端口 3000，非 root 用户）。

`/api/health`（`status: ok`）和 `/`
（稳定标记 `data-testid="service-desk-dashboard"`）
都必须在有限启动重试内通过。
会检查容器身份、标签、数据挂载、运行状态、镜像与端口。
首次看板请求会在全新隔离数据库上调用应用现有的 `TicketStore.seed()`：
**这就是数据初始化步骤**，而不只是提出一个数据集。
返回成功前，CLI 会在精确托管容器 ID 内执行固定的**只读** `node:sqlite` 探针，
将全部四条记录的 ID、标题、描述、类别、优先级、状态、请求人字段和时间戳，
与场景清单逐一比较。
数据集不匹配或缺失时直接失败，不会重置它。
只有实际数据行匹配后，才输出 `dataset.verified: true`。

原始夹具时间戳是**固定值**，不是运行时日期；
清单记录其精确 ISO 值。
只有后续创建的工单和变更使用当前运行时时钟。
不依赖数据库结构的探针不会假定未来负责人的列名，
因此返回 `ownershipVerified: false`。
默认未分配、分配、过滤和迁移需要另行检查。

冒烟运行成功仍返回 `accepted: false`。
它不会修改 GitHub，也不能证明负责人工能验收、旧结构迁移或功能持久化行为。

名称由仓库/Intent 派生；
标签绑定托管版本、仓库、Intent 和镜像。
已有资源会引发显式冲突，即使之前也是托管资源。
不会自动覆盖或重置。

```sh
# Stop the exact managed container, retaining container and data:
node tools/brownfield-demo/cli.mjs stop --repo OWNER/REPO --intent 42

# Explicitly remove only that matching managed container and data volume:
node tools/brownfield-demo/cli.mjs stop --repo OWNER/REPO --intent 42 --cleanup
```

观察持久化时，先检查返回的精确容器 ID，再用 Docker 重启它，保留数据卷。
两次持久化观察之间不要清理。
显式清理后再执行新的 `run`，会自动填充应用最初的四张确定性工单；
工具包绝不直接修改应用数据。
对于 AC-5，使用另一个隔离仓库/Intent 实例，
或先记录 AC-3，再显式仅清空托管测试数据集。
旧结构迁移仍需要真实实现测试，不能靠空数据卷冒烟测试证明。

启动失败时，资源会保留用于诊断，CLI 输出限定范围的清理命令。
Stop 在操作前验证**全部**匹配标签和挂载，
按不可变 ID 寻址容器，拒绝不匹配资源。
它绝不执行 `docker prune`、通配符删除、宿主机挂载、
特权容器或全仓库清理。
Docker 本身也会拒绝删除仍在使用的数据卷。
私有 GHCR 登录仍由操作员负责；本工具绝不索取或输出凭据。

如果希望进行安全本地冒烟测试，不影响宿主机上既有的端口 3000 服务和数据库，
请把 `REPO`、`INTENT`、`IMAGE` 设置为真实隔离仓库、Intent 编号及精确已发布摘要，再运行：

```sh
node tools/brownfield-demo/cli.mjs run \
  --repo "$REPO" --intent "$INTENT" --image "$IMAGE" --port 43127
# After inspecting the returned smoke/data verification result:
node tools/brownfield-demo/cli.mjs stop \
  --repo "$REPO" --intent "$INTENT" --cleanup
```

此示例中工具包只联系 `127.0.0.1:43127`。
它不会停止占用端口的服务；
Docker 端口冲突会导致失败，只留下自己带标签的资源，等待显式清理。
除非本地命令确实执行且数据库探针通过，否则不能宣称种子数据填充成功。

执行验收清单后，由已配置人员提交一条全新、未编辑的 Intent 评论：

```text
/sdlc accept sha256:ACTUAL_64_HEX_DIGEST
Actual tested digest, AC-1 through AC-5 observations, and any limitations.
```

失败时使用 `/sdlc reject sha256:...` 并附具体观测。
不要把示例当成实际证据直接粘贴。
标准运行控制（`/sdlc status`、`help`、`pause`、`resume`、`cancel`）
属于仓库自动化，而不是这个本地 CLI。
使用阶段支持的重试/恢复路径之前，先修复真实失败作业。

<a id="5-replay-actual-evidence-without-changing-github"></a>
## 5. 不修改 GitHub，回放真实证据

明确授权的脚本化开发演练，应在初始 Intent 正文中加入精确的一行：
`Delivery Execution: development-test`。
可信运行记录会永久保留该执行模式。
所有常规评审、范围和 CI 门禁仍适用，
但即使所有阶段完成，回放/就绪也不会把脚本批准算成真正人工验收。
没有账号所有者明确授权，不要使用个人账号执行脚本批准。
正常人工主导 Intent 省略此标记。

```sh
node tools/brownfield-demo/cli.mjs replay \
  --repo OWNER/REPO --intent 42 --dest ./ownership-replay-42
```

目标必须不存在。输出：

- `index.html`：经过转义、无脚本、使用严格 CSP 的静态快照。
- `evidence.json`：真实 Issue/子 Issue 评论、关联 PR 评审/检查、
  相关工作流运行、运行时记录、可用时的不可变文档状态/文本快照，以及摘要。
- `summary.json`：最小机器可读佐证结果与限制。

回放不会下载原始 Actions 日志或报告产物。
请按 [CI 报告与日志保留步骤](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery.md#ci-report-archives)，
在 Git 之外另行归档可用的每次尝试证据。
从未上传的报告无法通过 `replay` 恢复。
使用当前 Stage CI 工作流的执行会将每次尝试独立的 Red/Green 报告产物保留 14 天；
见 [CI 报告归档](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery.md#ci-report-archives)。

每页都标明 **read-only replay — NOT LIVE**（只读回放——非实时）。
不会执行任何来自 GitHub 的 Markdown/HTML。
链接针对显式仓库构建；
已有 Spec/Plan 文档链接到不可变提交，而不是可变分支 URL。
证据默认私有（文件模式 0600），不启动 Web 服务器。
采集跨越多个 GitHub 请求，因此是带时间戳的观测，而不是原子快照。
访问错误、树截断或分页限制会导致失败，
不会把静默缺失的内容包装成完整报告。

工具包读取 `brownfield-runs/<intent>` /
`docs/delivery-runs/brownfield-human-gated-delivery/<intent>/run-state.json`
中的 version-1 运行时记录，将引用固定到精确提交。
信任该记录之前，会验证 GitHub Actions 审计账本的作者/编辑者，
以及提交/状态哈希回执。
它支持数值或字符串运行 ID，以及与尝试绑定的验收元数据。

回放还会在同一个固定文档提交读取可用的 `document-review.json`、Spec 和 Plan，
并检查独立的文档审计账本。
`documentReview` 摘要报告启用配置、计数器、待定/封存状态，
以及经佐证的批准、修订和决策评论 ID。
对于 `decisions-v1`，它展示每个问题的最新决策与完整保留的决策历史，
包括延期负责人/跟进/风险。
`discovery.recordedReady` 是共享状态验证器的就绪结果，
**不是**可信人工决策的证明；
`decisionEvidenceVerified` 另行要求文档证明与实际决策评论匹配。
`documentReview.verified` 还要求封存交接、运行/基线匹配、
真实文档契约和已配置人员批准。
交付被接受，不会静默让不完整文档证据变得有效。

Version-2 验证复用编排的状态与交接验证器，
包括当前 Spec 的决策到验收映射，以及 Spec/Plan 上下文绑定。
每项保留决策都必须匹配真实、未编辑的人工评论、
已配置个人的 Spec 权限/当前策略、精确命令、记录时间戳和成功命令回执。
被取代的决策不会被忽略。
同一批回答共享评论和来源版本，且必须与该评论中的完整命令一致。
`decisionCommentIds` 对每条经验证的命令只列出一次；
修订计数按批次计算，不按批内回答数量计算。
格式错误的配置或状态会使采集显式失败；
不可信账本、缺失评论和不完整交接报告为未验证。
没有评审记录的旧版文档链接，仍然只是链接。

采集不会获取每个历史 Spec 文本，也不会重建历史团队成员关系。
决策回执中的历史文档哈希依赖带证明的状态，
而不是独立下载的历史版本。
评审人策略改变后，旧决策可能无法按当前策略验证。
JSON 验证和已批准映射都不能证明决策明智、
生成的验收条件在语义上实现了决策，或延期工作后来已经完成。

完成要求：可信记录已接受、未被拒绝且已验证，
真实匹配的实现合并、实际成功的发布工作流，
以及已配置人工评审人提交的、匹配且未编辑的特定摘要评论。
如果记录中有当前人工策略哈希，它仍必须匹配。
记录缺失/被篡改、机器人、普通讨论、过期尝试、Issue 关闭，
或单纯代码合并，都不能构成完成。
仅凭团队权限的情况保守地保留为未验证。
没有真实证据的记录仍未完成；
没有摘要的失败交付仍可回放。

回放验证记录中的发布关联，而不是镜像仓库签名或负责人工能行为。
人工很早验收时，真实发布/验证工作流可能仍在结束过程中；
请等它完成，并审阅所有佐证警告。
一次回放不能宣称三个现场变体都已完成。
每次独立真实运行都应分别采集和评审。

<a id="6-three-run-evidence-readiness-gate"></a>
## 6. 三次运行的证据就绪门禁

真实人工验收后，查询三个显式 Intent：

```sh
node tools/brownfield-demo/cli.mjs readiness --repo OWNER/REPO --intents 11,22,33
```

推荐使用独立隔离仓库时，将每个仓库与对应 Intent 编号对齐
（不同仓库可以使用相同编号）：

```sh
node tools/brownfield-demo/cli.mjs readiness \
  --repos OWNER/NORMAL,OWNER/REVISION,OWNER/RECOVERY --intents 1,1,1
```

只使用 `--repo` 或 `--repos` 之一，不能同时使用。
两种模式都限定为三个显式仓库/Intent 配对；
不会全局搜索仓库、Issue 或 Actions。
命令不写文件或远程状态；其 JSON 可另行保存。
由上层接入后，同一入口是 `npm run demo:brownfield -- readiness ...`。

这是**全部满足才通过的证据门禁**：
在三个不同且已验收的运行全部满足门禁之前，
`progress` 和 `completedScenarios` 始终为 **`0/3` 和 `0`**；
之后才变成 `3/3` 和 `3`。
部分发现显示在 `observedAcceptedRuns` 及每次运行的原因中，
不算已完成场景。
退出码 2 表示未完成，包括证据不可读或权限缺失。

门禁不接受场景名称或用户提供的成功布尔值：

- 每次运行都需要带证明的运行时记录、真实匹配且成功的发布尝试和合并，
  以及真实、未编辑、来自已配置人员的特定摘要验收。
  当前 `runId`/`runAttempt`、`policyHash`、`commentBody`、
  摘要和失败状态元数据必须一致。
- Spec/Plan 记录必须已封存、与运行共用基线，
  并匹配其**单独验证的文档审计账本**。
  真实不可变文档内容哈希、当前评审人策略、批准版本和人工批准评论必须一致。
  对于 `decisions-v1`，全部发现问题都需要回答/延期、
  当前上下文绑定和实际经佐证的决策回执；
  真实 Spec/Plan 必须通过共享交接验证器。
  未经签证的计数器不能计数。
- **正常：**Plan 计数器为 1，没有显式 Spec 修订请求或已记录失败。
  结构模式的 Spec 计数器为 1；
  `decisions-v1` 的 Spec 可以为每条经佐证决策命令额外恰好有一次已发布修订；
  一条批量命令中的多个回答只计为一次修订。
- **修订：**Spec 计数器大于 1，真实未编辑的人工 `/sdlc revise spec` 请求，
  在当前批准之前具有成功的可信回执。
  单独计数器、自动决策修订或被拒请求都不算。
- **恢复：**可信失败事件标明该仓库里真实完成且失败的 Actions 运行/尝试，
  随后有可信恢复事件和经过验证、已接受的交付。
  若重跑覆盖了当前结果，会显式获取较早尝试。
  暂停/恢复、取消、成功结果或单独事件名称都不是失败证据。
  每个引用运行最多检查十次失败和二十次尝试；
  更长历史会标为未完成，而不是静默截断。
- 三次运行需要不同的仓库/Intent 配对、实现 PR、发布运行和合并记录。
  一次运行不能充当多个变体；重试不能增加计数。
  恢复与修订都发生时，分类优先归为恢复。
- 每次运行自身的不可变起始基线，仍必须通过已知无负责人工能指纹和必需编排检查，
  包括 `run-core.mjs`、`runs.mjs`、`state-store.mjs`。
  三次运行的准备来源记录必须指向**同一个完整原始源提交**。
  各独立仓库单独发布后可以有不同的初始 Git 提交；
  它们不会与原始源提交混淆。
  已实现负责人工能的后期基线不合格。

这个门禁佐证的是流程证据，不是每项人工观测的语义正确性。
它绝不代你运行场景、从一次回放证明三次运行，
也不靠合成数据认证应用验收。
请保留实际清单观测和真实现场运行记录。

<a id="validation-and-parent-wiring"></a>
## 验证与上层接入

测试使用 Node 内置运行器，以及 Docker/GitHub 模拟。
测试产物只创建在本工具目录下，每次测试后删除。
一个测试读取当前提交的真实 `git archive`，但不解包。
另一个测试在该产物目录创建已知结构的测试专用 SQLite 夹具，
执行真实只读种子数据探针，并验证之后数据库字节未变；
它绝不打开应用本地数据库。
测试绝不启动守护进程/容器、认证、初始化 Git、提交、推送或远程写入。

```sh
node --test tools/brownfield-demo/tests/*.test.mjs
```

本工具包不会修改根清单、工作流、共享脚本或应用依赖。
建议由**上层负责**接入：

- 根脚本 `demo:brownfield`：`node tools/brownfield-demo/cli.mjs`
- 根测试调用：在现有 `node --test` 命令中包含
  `tools/brownfield-demo/tests/*.test.mjs`。
- CI 路径：本工具及上面的场景目录。

上层必须将当前运行时编排与不含负责人功能的应用一起提交，
完整 `--source-ref` 才能通过准备检查。
不要静默回退到工作树或旧编排。
基线应用有意改变时，先确认仍不含负责人工能，
更新六个已批准指纹和确定性夹具，再重新运行测试。
