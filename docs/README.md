# 演示文档

[English](README.en.md)

本仓库只记录实际案例：需求是什么，做过哪些决定，怎样验证，最终交付了什么。
方法、配置和工具操作统一引用[指南仓库](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.md)，
不在这里维护副本。中文和英文分别成篇，通过页首入口切换。
命令、代码、原始截图和已冻结的交付证据保留原文，不随翻译修改。

## 从这里开始

1. **了解交付结果：**[工单负责人图文案例](cases/ownership.zh-CN.md)。
2. **准备讲解：**[演示路线](presenter.md)。
3. **核对范围与进度：**[案例索引](cases/README.md)。
4. **查阅原始记录：**
   [需求](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1) ·
   [测试 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8) ·
   [实现 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) ·
   [验收](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416)。

## 当前范围

工单负责人和交接功能已验收：38 项测试通过，镜像已发布，并按指定摘要验证。
数据库就绪检查、发布可靠性、变更影响、故障诊断和 Agent 策略评估尚未在本仓库完成，
不能拿其他仓库的记录代替。

## 文件与证据

- [cases/](cases/README.md)：案例正文与进度。
- [cases/assets/ownership/](cases/assets/ownership/manifest.json)：14 张原始截图及来源、时间和哈希。
- [delivery-runs/](delivery-runs/brownfield-human-gated-delivery/1/spec.md)：
  工作流管理的规格、计划和审查文件，不随文档整理或翻译改写。

临时验证实例已清理；截图里的本机地址不是公开演示地址。需要运行应用时，
参照[应用说明](../demos/it-service-desk/README.md)；
需要重新开展完整交付时，参照
[分步指南](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery-walkthrough.md)。
