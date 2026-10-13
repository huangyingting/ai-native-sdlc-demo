# 演示路线

[English](presenter.en.md) · [文档首页](README.md) · [图文案例](cases/ownership.zh-CN.md)

## 演示前

打开案例正文和下表中的 GitHub 页面即可讲解，不需要重新运行 AI、发表评论或提交批准。
14 张截图直接保存在仓库中，便于在 Markdown 预览中阅读。
如果需要现场操作应用，请提前准备独立实例；截图里的本机地址不是在线服务。

## 30 分钟讲解

| 时间 | 展示 | 讲解重点 |
|---|---|---|
| 0–4 分钟 | [交接界面](cases/assets/ownership/owner-handoff.png)、[组合筛选](cases/assets/ownership/owner-filter.png) | 从业务结果出发：谁负责，怎样交接，怎样找到自己的工单。 |
| 4–9 分钟 | [需求与决策](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117980837) | AI 提问，人决定；固定名单是 Alex Chen 和 Sam Rivera。 |
| 9–13 分钟 | [Spec 批准](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118027964)、[Plan 批准](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118095114) | 两次批准分别回答行为是否正确、方案是否可行。 |
| 13–19 分钟 | [第二轮测试审查](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486915007)、[最终 Red](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210170335/attempts/2) | CI 通过不等于测试无误；修正后 29 项通过、9 项预期失败，要看具体断言，而不只是绿勾。 |
| 19–23 分钟 | [实现 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | 同一份测试变为 38 项全部通过，冻结文件没有修改；产品代码满足了已审查的约定。 |
| 23–27 分钟 | [发布失败](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/2)、[恢复](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3) | 镜像包授权不足，需要操作者处理；构建成功不代表交付成功。 |
| 27–30 分钟 | [重启后数据](cases/assets/ownership/restart-persistence.png)、[验收](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) | 验证实际镜像，再明确验收；发布、验证、验收是不同事件。 |

## 讲解时不要混淆

- 浏览器核验由助手执行；产品决定、阶段批准和验收由用户确认。
- 这是功能验收，不是生产认证；8 项基线依赖告警尚未处理。
- 就绪检查、故障恢复和工程实验在[案例索引](cases/README.md)中保留实际进度；
  历史实验不代表本仓库的计划案例已经完成。
- 截图显示拍摄时的状态；查看原始记录时，请核对提交、工作流编号、执行次数和镜像摘要。
  截图不能替代绑定版本的证据。

需要深入讲方法时，转到
[AI 原生软件交付指南](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/ai-native-sdlc/README.md)；
不要在演示期间临时修改已批准的规格或重新提交验收命令。

## 可选工程扩展：15 分钟

保持原负责人讲解路线不变；听众希望了解运行和工程判断时，再补充下列专题。
所有页面都是可只读讲解的记录。

| 时间 | 展示 | 讲解重点 |
|---|---|---|
| 0–5 分钟 | [可靠性观察](cases/reliability.md) | 两次全新数据卷演练、六个变异被杀死、每个事件一次回退，并保留候选实例写入。恢复不是维护批准或 SLO。 |
| 5–11 分钟 | [诊断与策略表](cases/engineering-judgment.md) | 六组修复、四组完整通过，两种策略都错误分类配置故障。比较九次真实调用及实测用量，不作普遍排名。 |
| 11–15 分钟 | [准确哈希代理方案](cases/change-impact.md) | 责任负责人和有效负责人的区别影响领域、存储、API 与约定。在待明确批准的关卡停下，不暗示已经实现。 |

讲解已有案例不需要新的模型请求、故障注入或批准。
维护审查和代理负责人实现仍然是独立关卡。
