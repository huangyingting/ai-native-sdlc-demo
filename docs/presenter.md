# 演示路线

[English](presenter.en.md) · [文档首页](README.md) · [图文案例](cases/ownership.zh-CN.md)

## 演示前

先读[演示目的与 Copilot 作用](copilot-roles.md)。
在 [PR #9](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9)或
[PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26)
中指明真实作者 `app/copilot-swe-agent`，再展示代码差异和 Actions 检查。

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
| 19–23 分钟 | [实现 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | 展示 Copilot 的 `app/copilot-swe-agent` 作者身份和代码差异，再展示独立执行的 38 项 Green 测试及不变冻结文件。 |
| 23–27 分钟 | [发布失败](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/2)、[恢复](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3) | 镜像包授权不足，需要操作者处理；构建成功不代表交付成功。 |
| 27–30 分钟 | [重启后数据](cases/assets/ownership/restart-persistence.png)、[验收](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) | 验证实际镜像，再明确验收；发布、验证、验收是不同事件。 |

## 讲解时不要混淆

- 应用检查、阶段批准与最终验收分别作为证据。
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
| 0–5 分钟 | [可靠性观察](cases/reliability.md) | 固定策略脚本，不是 AI 决定回退：两次演练、六个变异被杀死、写入保留。无新增 CLI 诊断或修复调用，不宣称 SLO 或维护批准。 |
| 5–11 分钟 | [实际诊断输出](cases/engineering-judgment.md#copilot-实际说了什么)，再看结果表 | 展示请求、模型准确理由与分类、单行补丁及独立结果。运行配置原因找到了，但标签错误；随后比较九次调用用量。 |
| 11–15 分钟 | [实际代理输出与差异](cases/change-impact.md#copilot-实际生成了什么) | 展示迁移方案、代理优先代码差异，再展示独立 15+35 检查。候选是隔离实验，不是编码 Agent PR 或已部署功能。 |

讲解已有案例不需要新的模型请求、故障注入或批准。
维护审查仍待完成；已验证的代理候选不是已部署功能或生产授权。
