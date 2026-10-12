# AI 原生软件交付：从需求到可用软件

[English](README.en.md)

本仓库围绕一个 IT 服务台，展示如何把业务需求变成可用的软件：
明确问题、作出产品决策、审查方案、开发验证、部署验收，再根据运行反馈持续改进。
每个案例关联本仓库中实际产生的 Issue、PR、测试和运行记录。

## 从这里开始

- **[演示文档](docs/README.md)**：本仓库的案例、演示路线和证据入口。
- **[演示路线](docs/presenter.md)**：用 30 分钟讲解已经完成的负责人交接案例。
- **[工单负责人完整案例](docs/cases/ownership.zh-CN.md)**：从需求到验收的图文记录。
- **[运行服务台](demos/it-service-desk/README.md)**：本地安装和应用命令。
- **[交付命令参考](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery.md)**：
  文档审查、PR 检查和镜像验收。

通用方法和操作说明统一在[指南仓库](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.md)维护，
本仓库只保存演示案例、截图和交付记录，不保留重复副本。

## 案例

| 案例 | 要解决的问题 | 状态 |
|---|---|---|
| 工单负责人 | 谁负责，怎样交接？ | [已验收](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) |
| 数据库就绪检查 | 进程存活时，应用是否真的可用？ | 未开始 |
| 发布可靠性 | 怎样拒绝异常实例、恢复服务并避免问题复发？ | 未开始 |
| 变更影响 | 增加代理负责人时，怎样保持原有责任关系？ | 未开始 |
| 故障诊断 | 问题出在产品代码、测试还是配置？ | 未开始 |
| Agent 策略评估 | 单独增加诊断步骤，是否值得额外投入？ | 未开始 |

## 如何推进

```text
需求意图 → 产品决定 → 已批准规格 → 已批准计划
         → 经审查的测试 → 经审查的实现 → 已验证镜像
         → 用户验收 → 运行跟进
```

AI 起草文档和代码，GitHub Actions 执行检查并保存版本记录。
产品决策和对应版本的批准需要审查者 `huangyingting` 确认。
生成任务成功，不代表文档已经批准或应用已经验收。

服务台的初始基线不支持工单负责人；目前该功能已完成交付并通过验收。
工程实验应用的代理负责人功能仍未开始。截图和测量结果随实际进度补充，
未完成的案例会明确保留其当前状态。

## 验证

使用 Node.js 24，在根目录验证仓库自动化和独立工程实验应用：

```sh
npm test
npm --prefix demos/engineering-lab test
```

验证服务台：

```sh
cd demos/it-service-desk
npm ci
npm test
npm run lint
npm run build
```

各应用独立管理依赖和锁文件，不要将演示应用的依赖安装到仓库根目录。

## 来源与参考资料

应用和工作流来自
[`huangyingting/ai-native-sdlc` 的固定提交 `b30e6bc3a693f674d48f1a9f76952176214eae9e`](https://github.com/huangyingting/ai-native-sdlc/tree/b30e6bc3a693f674d48f1a9f76952176214eae9e)。
[导出记录](brownfield-demo-provenance.json)标识该基线，来源记录与本次交付记录分别保存。
工具说明和源仓库案例仅作参考，不是本仓库的交付结果；
当前进度与证据统一从[案例索引](docs/cases/README.md)进入。
