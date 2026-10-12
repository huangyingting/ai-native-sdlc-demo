# Baseline preparation / 基线准备

[Case index / 案例索引](README.md)

**Date / 日期:** 2026-10-12

## Starting point / 起点

- Source: `huangyingting/ai-native-sdlc`
- Source commit: `b30e6bc3a693f674d48f1a9f76952176214eae9e`
- Target: `huangyingting/ai-native-sdlc-demo`
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

## Installation correction / 安装问题与处理

The first `npm ci` failed with `EALLOWREMOTE`: 456 lockfile tarball URLs
referenced a package mirror rather than the configured npm registry.
Changing npm's registry-host replacement option did not alter the lockfile.
The download prefix was then normalized to `https://registry.npmjs.org/`.
A structural comparison confirmed that all versions, dependency relationships
and integrity hashes remained unchanged. `npm ci` then succeeded.

首次安装因锁文件中的 456 个下载地址指向镜像站而失败。
npm 的地址替换选项未改动锁文件，因此将这些下载地址统一到 npm 官方源，
并逐项确认版本、依赖关系和完整性校验值没有变化。随后安装成功。

The npm installation audit reported **8 advisories: 7 high and 1 critical**.
These are unresolved dependency findings, not verified exploitability or a
security approval. No automatic dependency upgrade or `npm audit fix --force`
was performed. Assess them before any production use.

安装时 npm 报告 **8 项依赖风险：7 项高危、1 项严重**。这些项目尚未处理，
也尚未验证在本应用中的可利用性。本次没有自动升级依赖或执行强制修复；
进入生产前需要单独评估。

## Remaining prerequisites / 后续准备

Publishing workflows, configuring the automation credential, applying branch
protection, checking Copilot access and passing remote checks remain separate
steps. Human document review and application acceptance have not yet occurred.

发布工作流、配置自动化凭据和分支保护、确认 Copilot 权限，以及通过远程检查，
仍需分别完成。此记录不代表文档已经批准或应用已经验收。
