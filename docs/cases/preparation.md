# 基线准备

[English](preparation.en.md) · [案例索引](README.md)

**日期：2026-10-12**

## 起点

- 源仓库：`huangyingting/ai-native-sdlc`
- 源提交：`b30e6bc3a693f674d48f1a9f76952176214eae9e`
- 目标仓库：`huangyingting/ai-native-sdlc-demo`
- 仓库身份：`1415043318`，创建于 `2026-10-12T04:14:53Z`
- 初始基线提交：`b8128949afaf3f078b70c057d8eea5ead0ecdcf1`
- 审查者：`huangyingting`，确认产品决定和批准
- 工作流配置：`decisions-v1`，单人审查策略
- 应用：已有服务台，尚无工单负责人或就绪检查功能
- 工程实验应用：已有负责人模型，尚无代理负责人

## 本地应用验证

服务台通过 **26 项测试**、lint 和生产构建；工程实验应用通过 **15 项测试**。
运行环境为 Node.js **24.18.1**。这些结果仅验证初始应用，
不代表工单负责人或代理负责人功能已经实现。

仓库自动化通过 **456 项测试**。初始基线的
[仓库 CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38203017609)
和[服务台 CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38203017613)
也已通过。应用 CI 包含容器验证，但这不代表应用已上线或已通过用户验收。

## 安装问题与处理

准备共用基线时，`npm ci` 因 `EALLOWREMOTE` 失败：
锁文件中的 456 个压缩包下载地址指向镜像站，而非配置中的 npm 源。
调整 npm 的源地址替换选项并未改动锁文件，因此将下载地址前缀统一到
`https://registry.npmjs.org/`，并逐项确认版本、依赖关系和完整性校验值没有变化。
随后 `npm ci` 安装成功。

安装时 npm 报告 **8 项依赖风险：7 项高危、1 项严重**。这些项目尚未处理，
也尚未验证在本应用中的可利用性，不构成安全批准。
本次没有自动升级依赖或执行 `npm audit fix --force`；进入生产前需要单独评估。

本仓库使用已修正下载地址的锁文件。全新安装已通过，npm 仍报告上述 8 项未处理风险。

## 自动化凭据

**2026-10-12 状态：**仓库 Secret 已于 `04:27:13Z`（北京时间 12:27:13）配置。
自动化配置检查确认了 Secret 存在，但首次分配测试任务时仍出现令牌访问错误。
操作者调整权限后，[重试成功](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38206744511)，
无需重复批准文档。测试任务和后续的
[实现任务](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210668893)
均已成功分配，全程未读取令牌值。这些结果只验证已执行的操作，不保证所有后续权限都可用。

进入代码任务前，需要配置 `COPILOT_ASSIGN_TOKEN`。
文档生成使用工作流自带的 GitHub 令牌，不需要把个人令牌放入提示词或 Issue。

1. 在 GitHub 中打开 **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens**。
2. 创建细粒度令牌，资源所有者选择 `huangyingting`，设置适当的有效期，
   仅允许访问当前 `ai-native-sdlc-demo` 仓库。
3. 为 **Actions、Contents、Issues、Pull requests** 授予读写权限；
   **Metadata** 保持只读。
4. 打开仓库的 **Settings → Secrets and variables → Actions → New repository secret**。
5. 将令牌保存为 **`COPILOT_ASSIGN_TOKEN`**，不要写入 Issue、提交、截图或聊天。

若沿用已有细粒度令牌，必须重新确认它选择的是当前仓库：
同名重建的仓库不是原来的资源。

## 交付时的镜像包权限

首次实际执行发布时，合并版本的镜像构建成功，但上传被 GHCR 拒绝：
`permission_denied: write_package`。任务日志确认 `GITHUB_TOKEN` 已有
`Packages: write`，但这并不意味着现有镜像包已授权给当前仓库。

操作者在包的 **Package settings → Manage Actions access** 中，
为当前仓库配置 **Write** 后，
[第 3 次发布](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3)
成功；没有修改应用代码或更换令牌。

仓库同名重建后，除了检查 Secret，还应单独检查镜像包对当前仓库的授权。
不要为了排除权限问题而删除包、改成公开包，或把令牌发到聊天里。

## 审查与验收

[工单负责人需求](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1)
保存当前文档版本和产品决策。基线验证不能代替文档批准、生产就绪评估或应用验收。
