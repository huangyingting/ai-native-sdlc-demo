# 交付环境与基线准备实录

[English](preparation.en.md) · [案例索引](README.md)

**基线确立日期：2026-10-12**

## 演示起点与环境上下文

- **上游源仓库：** `huangyingting/ai-native-sdlc`
- **源基线提交：** `b30e6bc3a693f674d48f1a9f76952176214eae9e`
- **演示目标仓库：** `huangyingting/ai-native-sdlc-demo`
- **GitHub 仓库 ID：** `1415043318`，创建于 `2026-10-12T04:14:53Z`
- **初始基线提交：** `b8128949afaf3f078b70c057d8eea5ead0ecdcf1`
- **指定审批人：** `huangyingting`，负责把关架构决策并签署各阶段审批
- **工作流策略：** `decisions-v1`，采用单人主审策略
- **被测业务应用：** IT 服务台初始版本（尚未实现工单负责人与就绪健康检查功能）
- **工程实验应用：** 独立实验工程（包含基础责任人模型，尚未实现代理负责人功能）

## 本地应用基线验证

在初始基线下，IT 服务台通过了 **26 项单元测试**、ESLint 检查及生产构建；工程实验应用通过了 **15 项基线测试**。
执行环境统一为 Node.js **24.18.1**。上述检查仅证明初始工程代码完好，绝不代表待交付的“工单负责人”或“代理人”功能已被提前实现。

仓库自动化套件通过了 **456 项测试**。初始基线的
[仓库级 CI 流水线](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38203017609)
与[服务台应用 CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38203017613)
均顺利跑通。应用 CI 虽包含容器构建与简单连通性验证，但这仅属于流水线健康检查，不代表应用已正式上线或通过了用户业务验收。

## 依赖安装排错与安全审计

在准备共用基线依赖时，执行 `npm ci` 曾因 `EALLOWREMOTE` 报错中断：排查发现锁文件中的 456 个依赖包下载地址均硬编码指向了特定镜像站，与当前配置的 npm 官方源冲突。由于调整 npm 源替换参数无法直接修正已冻结的 package-lock.json，工程团队统一将下载地址前缀标准化为 `https://registry.npmjs.org/`，并逐一核验了包版本、依赖树结构与 `integrity` 完整性哈希，确保无任何外部改动。随后 `npm ci` 顺利完成。

安装完成后，npm audit 报告了 **8 项既有依赖安全风险：7 项高危、1 项严重**。这些风险属于上游历史依赖残留，尚未针对当前业务场景验证其可利用性，亦未获得安全豁免。在本次演示中，团队坚持不盲目执行 `npm audit fix --force` 升级主版本破坏基线稳定性；在实际投产前必须组织专属的安全评估。

本演示仓库采用了规范化下载地址后的锁文件。全新环境安装已验证跑通，上述 8 项历史风险如实记录归档。

## 自动化流水线凭据配置

**2026-10-12 配置记录：** 仓库 Actions Secret 已于 `04:27:13Z`（北京时间 12:27:13）配置完成。
虽然前置配置检查已确认 Secret 变量存在，但在首次尝试下发测试任务时，仍偶发了细粒度令牌访问鉴权异常。经操作人员调整授权范围后，[重试操作顺利通过](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38206744511)，无需重复走文档审批流程。测试任务及随后的[实现任务](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210668893)均成功下发给自动化 Agent，全程严格防范令牌明文泄漏。

在流转至代码开发阶段前，必须在仓库中预置 `COPILOT_ASSIGN_TOKEN`。而前期的需求规格文档生成完全依赖 GitHub Actions 内置的系统令牌，严禁将个人访问令牌（PAT）硬编码至提示词或 Issue 中。

1. 在 GitHub 个人中心打开 **Settings → Developer settings → Personal access tokens → Fine-grained tokens**。
2. 创建细粒度令牌，资源所有者（Resource owner）选择 `huangyingting`，设定合理的有效期，且权限严格限制在当前 `ai-native-sdlc-demo` 仓库。
3. 为 **Actions、Contents、Issues、Pull requests** 4 项权限授予读写权限（Read and Write）；**Metadata** 权限保持为只读（Read-only）。
4. 在仓库主页打开 **Settings → Secrets and variables → Actions → New repository secret**。
5. 将生成的令牌保存为 **`COPILOT_ASSIGN_TOKEN`**，严禁提交至 Issue、代码提交、截图或聊天窗口中。

如果沿用历史创建的细粒度令牌，必须重新核对其关联的代码仓库：同名销毁重建的仓库在 GitHub 底层属于全新资源，历史令牌不会自动继承生效。

## 容器镜像发布权限配置

在首次触发正式发布时，合并后的 Docker 镜像虽然构建成功，但在推送至 GitHub Container Registry（GHCR）时被直接拦截拒绝：`permission_denied: write_package`。流水线日志虽然显示工作流上下文具有 `Packages: write`，但这并不代表 GitHub Packages 现存的包资源已向当前仓库下发了写入权限。

操作人员在对应镜像包的 **Package settings → Manage Actions access** 中，将当前演示仓库显式加入并赋予 **Write** 权限后，[第 3 次发布重试顺利跑通](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3)；此过程无需修改业务代码，亦无需更换访问令牌。

若演示仓库经历同名重建，除了核验 Secret 变量外，还必须单独核对 GHCR 镜像包的授权链路。切勿为了规避权限问题而随意将镜像包公开或在沟通群中发送敏感凭证。

## 持续审计与业务验收

[工单负责人需求 Issue #1](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1)
完整归档了各阶段的文档版本与架构决策留痕。前置基线验证仅能证明开发环境准备就绪，绝不可替代后续各阶段的文档审查审批、生产安全评估或最终的用户业务验收。
