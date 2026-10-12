# Demo documentation / 演示文档

本仓库只记录实际案例：需求是什么，做过哪些决定，怎样验证，最终交付了什么。
方法、配置和工具操作统一引用[指南仓库](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.md)，
不在这里维护副本。

This repository holds case studies, presentation material and delivery evidence.
Reusable methods and operator references live in the
[guide repository](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.md).

## Start here / 从这里开始

1. **Understand the result / 了解交付结果：**
   [工单负责人图文案例](cases/ownership.zh-CN.md) · [English case study](cases/ownership.en.md)。
2. **Present it / 准备讲解：**[Presentation route / 演示路线](presenter.md)。
3. **Check scope and progress / 核对范围与进度：**[Case index / 案例索引](cases/README.md)。
4. **Inspect original records / 查阅原始记录：**
   [Intent](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1) ·
   [Tests PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8) ·
   [Implementation PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) ·
   [Acceptance](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416)。

## Current scope / 当前范围

工单负责人和交接功能已验收：38 项测试通过，镜像已发布，并按确切摘要验证。
数据库就绪检查、发布可靠性、变更影响、故障诊断和 Agent 策略评估尚未在本仓库完成，
不能拿其他仓库的记录代替。

Ticket ownership is accepted, with 38 passing tests and verification of the
published image. Readiness, release reliability, change impact, diagnosis and
Agent strategy evaluation are not completed cases in this repository.

## Files and evidence / 文件与证据

- [cases/](cases/README.md)：案例正文与进度。
- [cases/assets/ownership/](cases/assets/ownership/manifest.json)：14 张原始截图及来源、时间和哈希。
- [delivery-runs/](delivery-runs/brownfield-human-gated-delivery/1/spec.md)：
  工作流管理的规格、计划和审查文件，不随文档整理改写。
- [archive/](archive/README.md)：其他仍可核查的历史演练，仅供扩展阅读。

临时验证实例已清理；截图里的本机地址不是公开演示地址。需要运行应用时，
参照[应用说明](../demos/it-service-desk/README.md)；
需要重新开展完整交付时，参照
[分步指南](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery-walkthrough.md)。
