# 30 分钟演示讲解路线

[English](presenter.en.md) · [文档首页](README.md) · [图文案例实录](cases/ownership.zh-CN.md)

## 演示准备与注意事项

建议在演示前通读[演示目标、Copilot 的角色与验证结论](copilot-roles.md)。
在展示 [PR #9](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) 或
[PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26) 时，
可明确指出 PR 的真实作者为 `app/copilot-swe-agent`，随后展示代码差异与 Actions 自动化检查详情。

演示时直接打开案例正文及下表对应的 GitHub 链接即可进行讲解，无需重新调用 AI 生成、发表 Issue 评论或重复审批操作。
仓库中内置了 14 张高清过程截图，便于在 Markdown 预览模式下直接查阅。
如需现场操作体验服务台应用，请提前在独立环境中启动容器；文档与截图中出现的本机地址（localhost）仅为当时演练留痕，非长期在线服务。

## 30 分钟标准讲解大纲

| 时间分配 | 展示内容 | 讲解重点 |
|---|---|---|
| 0–4 分钟 | [工单交接界面](cases/assets/ownership/owner-handoff.png)、[组合条件筛选](cases/assets/ownership/owner-filter.png) | **以业务结果切入**：清晰呈现业务痛点——工单由谁负责？如何完成交接？一线人员如何快速找到自己的待办工单？ |
| 4–9 分钟 | [需求澄清与架构决策](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117980837) | **AI 识别歧义，人类把关决策**：通过多轮问答明确产品边界，确认初期采用 Alex Chen 与 Sam Rivera 组成的固定成员名单。 |
| 9–13 分钟 | [Spec 批准记录](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118027964)、[Plan 批准记录](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118095114) | **双重门禁机制**：Spec 审批回答“业务行为是否符合预期”，Plan 审批回答“实施方案与改动边界是否安全可行”，二者不可混为一谈。 |
| 13–19 分钟 | [第二轮测试审查反馈](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486915007)、[受控 Red 验证日志](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210170335/attempts/2) | **CI 绿灯不等于测试本身有效**：指出被掩盖的断言缺陷；展示修正后的受控红灯状态（29 项既有测试通过，9 项新增断言精准失败），强调要审视实际断言而非只看绿勾。 |
| 19–23 分钟 | [功能实现 PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | **Coding Agent 独立交付**：展示 `app/copilot-swe-agent` 生成的完整代码差异，以及独立验证通过的 38 项绿灯测试与未被修改的已冻结测试套件。 |
| 23–27 分钟 | [发布权限失败](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/2)、[恢复重试日志](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3) | **真实的运维摩擦**：构建成功不等于交付成功；因镜像包写入权限不足遭遇失败，由人工调整授权后重试成功。 |
| 27–30 分钟 | [重启后数据持久化](cases/assets/ownership/restart-persistence.png)、[最终验收决策](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) | **基于确切镜像的业务验收**：在真实拉取发布的生产镜像并验证业务持久化后，正式签署验收决定；明确“代码合并”、“镜像发布”与“最终验收”是三个独立的生命周期事件。 |

## 讲解避坑指南

- **厘清证据层次**：自动化流程检查、阶段性文档批准与最终镜像验收各自独立留痕，不可互相替代。
- **说明质量边界**：本次交付属于业务功能验收，而非全方位生产安全认证；历史基线中存在的 8 项依赖告警属于已知待办，尚未在本次范围中处理。
- **避免过度引申**：就绪检查、故障恢复演练与工程实验在[案例索引](cases/README.md)中如实记录了各自进展，切勿将探索性实验宣传为已上线的业务功能。
- **证据优先于截图**：截图仅反映记录时的界面状态；如需核查严肃证据，请核对 Git Commit SHA、Actions 工作流编号、运行轮次（attempt）以及镜像摘要（digest）。

若听众希望深入了解交付方法论细节，可引导其阅读
[AI 原生软件交付系统指南](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/ai-native-sdlc/README.md)；
在演示过程中无需临时修改已批准的规格或重新触发验收命令。

## 选讲：15 分钟工程深度扩展

若完成核心的“工单负责人”主线讲解后，听众对运维可靠性与工程决策方法表现出浓厚兴趣，可展开以下专题进行延伸讲解。所有材料均为现成的只读留痕：

| 时间分配 | 展示内容 | 讲解重点 |
|---|---|---|
| 0–5 分钟 | [发布可靠性演练](cases/reliability.md) | **确定性策略回滚，而非 AI 自主决断**：展示 2 次恢复演练、6 处注入故障被成功识别并消除、业务写入数据完整留存。全程无外部 CLI 介入修复，且不随意引申声明生产 SLO 达标。 |
| 5–11 分钟 | [真实故障诊断实录](cases/engineering-judgment.md#copilot-实际说了什么)与结果对比表 | **客观展现大模型工程能力边界**：展示真实提示词、模型推导理由、单行补丁及独立验证结果。指出模型虽然精准定位了配置异常根因，但枚举标签分类出现偏差；随后对比 9 次模型调用的 Token 开销与成本。 |
| 11–15 分钟 | [代理人影响方案与代码差异](cases/change-impact.md#copilot-实际生成了什么) | **架构演进中的契约保护**：展示数据迁移方案与“代理人优先”的补丁代码，随后演示 15 项既有测试与 35 项独立行为检查的通过情况。强调候选代码属于隔离实验，未合并进主干生产环境。 |

讲解已有留痕案例无需发起新的模型请求、故障注入或在线审批。
当前运维维护审查仍待后续完成；隔离验证通过的代理人候选代码不代表已部署至生产系统。
