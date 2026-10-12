# Presentation route / 演示路线

[Documentation / 文档首页](README.md) ·
[中文案例](cases/ownership.zh-CN.md) · [English case](cases/ownership.en.md)

## Prepare / 演示前

打开案例正文和下表中的 GitHub 页面即可讲解，不需要重新运行 AI、发表评论或提交批准。
14 张截图直接保存在仓库中，便于在 Markdown 预览中阅读。
如果需要现场操作应用，请提前准备独立实例；截图里的本机地址不是在线服务。

Open the case study and the pages below. This is a read-only presentation:
no new model calls, approvals or workflow runs are required. For a live
application session, prepare an isolated instance in advance; recorded
localhost addresses are not public deployments.

## A 30-minute walkthrough / 30 分钟讲解

| Time / 时间 | Show / 展示 | Explain / 讲解重点 |
|---|---|---|
| 0–4 min | [交接界面 / Handoff](cases/assets/ownership/owner-handoff.png)、[组合筛选 / Filtering](cases/assets/ownership/owner-filter.png) | 从业务结果出发：谁负责，怎样交接，怎样找到自己的工单。Start with the user outcome. |
| 4–9 min | [需求与决策 / Intent and decisions](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117980837) | AI 提问，人决定；固定名单是 Alex Chen 和 Sam Rivera。AI identifies ambiguity; the user decides. |
| 9–13 min | [Spec 批准](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118027964)、[Plan 批准](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118095114) | 两次批准分别回答行为是否正确、方案是否可行。Separate behavior from implementation planning. |
| 13–19 min | [第二轮测试审查 / Second test review](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486915007)、[最终 Red / Final Red](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210170335/attempts/2) | CI 通过不等于测试无误；修正后 29 项通过、9 项预期失败。Review assertions, not just a green check. |
| 19–23 min | [实现 PR / Implementation](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | 同一份测试变为 38 项全部通过，冻结文件没有修改。Implementation satisfies the reviewed contract. |
| 23–27 min | [发布失败 / Failed publication](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/2)、[恢复 / Recovery](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3) | 镜像包授权不足，需要操作者处理；构建成功不代表交付成功。Package access required operator intervention. |
| 27–30 min | [重启后数据 / Persistence](cases/assets/ownership/restart-persistence.png)、[验收 / Acceptance](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) | 验证实际镜像，再明确验收；发布、验证、验收是不同事件。Accept the exact verified artifact. |

## Keep the boundaries clear / 讲解时不要混淆

- 浏览器核验由助手执行；产品决定、阶段批准和验收由用户确认。
  Assistant-run checks are distinct from user-confirmed decisions.
- 这是功能验收，不是生产认证；8 项基线依赖告警尚未处理。
  Functional acceptance does not resolve the eight baseline dependency advisories.
- 就绪检查、故障恢复和工程实验在[案例索引](cases/README.md)中保留实际进度。
  Historical exercises do not establish completion of this repository's planned cases.
- 截图显示拍摄时的状态；查看原始记录时，请核对提交、run、attempt 和镜像摘要。
  A screenshot is not a substitute for version-bound evidence.

需要深入讲方法时，转到
[中英文指南](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/ai-native-sdlc/README.md)；
不要在演示期间临时修改已批准的规格或重新提交验收命令。
