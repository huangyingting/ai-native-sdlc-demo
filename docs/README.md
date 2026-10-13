# 演示文档

[English](README.en.md)

本仓库只记录实际案例：需求是什么，做过哪些决定，怎样验证，最终交付了什么。
方法、配置和工具操作统一引用[指南仓库](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.md)，
不在这里维护副本。中文和英文分别成篇，通过页首入口切换。
命令、代码、原始截图和已冻结的交付证据保留原文，不随翻译修改。

## 从这里开始

1. **了解交付结果：**[工单负责人图文案例](cases/ownership.zh-CN.md)。
   后续维护交付见[数据库就绪检查图文案例](cases/readiness.md)。
2. **准备讲解：**[演示路线](presenter.md)。
3. **核对范围与进度：**[案例索引](cases/README.md)。
   新专题见[发布可靠性](cases/reliability.md)、[诊断与策略](cases/engineering-judgment.md)
   和[已验证的变更影响实验](cases/change-impact.md)。
4. **查阅原始记录：**
   [需求](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1) ·
   [测试 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8) ·
   [实现 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) ·
   [验收](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416)。

## 当前范围

工单负责人和交接功能已验收：38 项测试通过，镜像已发布，并按指定摘要验证。
数据库就绪检查也已验收：当前 47 项测试通过，指定发布摘要完成隔离故障、恢复与真实业务操作验证。
发布可靠性已有两次通过的隔离演练，维护审查仍待完成。
诊断与策略评估完成六组真实实验：六组修复验证通过、四组完整验收通过，
保留了两组错误的环境分类。变更影响候选经委托本地操作者审查后，
通过十五项不变测试和三十五项独立检查。仓库基线保持不变，以便重复比较。
这些实验不是生产认证，也不会自动验收功能。

## 文件与证据

- [cases/](cases/README.md)：案例正文与进度。
- [cases/assets/ownership/](cases/assets/ownership/manifest.json)：14 张原始截图及来源、时间和哈希。
- [cases/assets/readiness/](cases/assets/readiness/manifest.json)：21 张就绪检查截图，区分基线与新发布镜像的来源。
- [cases/assets/reliability/](cases/assets/reliability/manifest.json)：原始结果截图、资格验证摘要和两次独立运行演练。
- [cases/assets/engineering/](cases/assets/engineering/manifest.json)：原始策略、方案与结果记录、脱敏六组测量及已验证影响摘要，不包含原始提示词或生成的候选源码。
- [delivery-runs/](delivery-runs/brownfield-human-gated-delivery/1/spec.md)：
  工作流管理的规格、计划和审查文件，不随文档整理或翻译改写。

临时验证实例已清理；截图里的本机地址不是公开演示地址。需要运行应用时，
参照[应用说明](../demos/it-service-desk/README.md)；
需要重新开展完整交付时，参照
[分步指南](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery-walkthrough.md)。
