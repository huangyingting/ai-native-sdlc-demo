# Baseline preparation / 基线准备

[Case index / 案例索引](README.md)

**Date / 日期:** 2026-10-12

## Starting point / 起点

- Source: `huangyingting/ai-native-sdlc`
- Source commit: `b30e6bc3a693f674d48f1a9f76952176214eae9e`
- Target: `huangyingting/ai-native-sdlc-demo`
- Repository identity: `1415043318`, created `2026-10-12T04:14:53Z`
- Initial baseline commit: `b8128949afaf3f078b70c057d8eea5ead0ecdcf1`
- Reviewer: `huangyingting`, authorizing product decisions and approvals
- Workflow profile: `decisions-v1`, single-owner review policy
- Application: existing service desk, without ticket ownership or readiness
- Engineering fixture: existing owner model, without proxy ownership

## Local application validation / 本地应用验证

The service desk passed **26 tests**, lint and a production build with
Node.js **24.18.1**. The engineering fixture passed **15 tests**.
These results validate the starting applications; they do not establish that
the requested ownership or proxy features have been implemented.

服务台通过 **26 项测试**、lint 和生产构建；工程实验应用通过 **15 项测试**。
运行环境为 Node.js **24.18.1**。这些结果仅验证初始应用，
不代表工单归属或代理负责人功能已经实现。

Repository automation passed **456 tests**. Hosted
[Repository CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38203017609)
and [IT Service Desk CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38203017613)
also passed for the initial baseline. Application CI includes a container
verification job; it is not an online deployment or user acceptance.

仓库自动化通过 **456 项测试**，初始基线的两项 GitHub CI 也已通过。
应用 CI 包含容器验证，但这不代表应用已上线或已通过用户验收。

## Installation correction / 安装问题与处理

During preparation of the shared baseline, `npm ci` failed with `EALLOWREMOTE`: 456 lockfile tarball URLs
referenced a package mirror rather than the configured npm registry.
Changing npm's registry-host replacement option did not alter the lockfile.
The download prefix was then normalized to `https://registry.npmjs.org/`.
A structural comparison confirmed that all versions, dependency relationships
and integrity hashes remained unchanged. `npm ci` then succeeded.

准备共用基线时，安装因锁文件中的 456 个下载地址指向镜像站而失败。
npm 的地址替换选项未改动锁文件，因此将这些下载地址统一到 npm 官方源，
并逐项确认版本、依赖关系和完整性校验值没有变化。随后安装成功。

The npm installation audit reported **8 advisories: 7 high and 1 critical**.
These are unresolved dependency findings, not verified exploitability or a
security approval. No automatic dependency upgrade or `npm audit fix --force`
was performed. Assess them before any production use.

安装时 npm 报告 **8 项依赖风险：7 项高危、1 项严重**。这些项目尚未处理，
也尚未验证在本应用中的可利用性。本次没有自动升级依赖或执行强制修复；
进入生产前需要单独评估。

This repository starts with the corrected lockfile. A fresh `npm ci` succeeded
and reported the same eight unresolved advisories.

本仓库使用已修正下载地址的锁文件。全新安装已通过，npm 仍报告上述 8 项未处理的依赖风险。

## Automation credential / 自动化凭据

`COPILOT_ASSIGN_TOKEN` must be configured before assigning the reviewed coding
tasks. Document generation uses the workflow's own GitHub token and does not
require copying a personal token into a prompt or Issue.

1. Open GitHub **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens**.
2. Create a token with resource owner `huangyingting`, a suitable expiration,
   and access only to the current `ai-native-sdlc-demo` repository.
3. Grant **Actions**, **Contents**, **Issues** and **Pull requests** read/write
   access; **Metadata** remains read-only.
4. Open this repository's **Settings → Secrets and variables → Actions →
   New repository secret**.
5. Save the value as **`COPILOT_ASSIGN_TOKEN`**. Do not put it in an Issue,
   commit, screenshot or chat message.

If reusing a fine-grained token, verify its selected repository: a newly created
repository is a different resource even when its name matches a deleted one.

进入代码任务前，需要配置 `COPILOT_ASSIGN_TOKEN`。按上述步骤创建只允许访问当前仓库的
细粒度令牌，并直接保存到仓库的 Actions Secret 中，不要发到聊天、Issue 或截图里。
若沿用已有令牌，必须重新确认它选择的是当前仓库：同名重建的仓库不是原来的资源。
文档生成使用工作流自带的 GitHub 令牌，不需要把个人令牌交给模型。

## Review and acceptance / 审查与验收

The [ownership requirement](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1)
records the current document version and decisions. Baseline checks do not
approve that document, grant production readiness or replace application
acceptance.

[工单归属需求](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1)
保存当前文档版本和产品决策。基线验证不能代替文档批准、生产就绪评估或应用验收。
