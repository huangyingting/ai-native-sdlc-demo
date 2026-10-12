# 3. 构建与验证：让可执行契约本身可信

[指南目录](../README.md) · [English](../en/03-build-verify.md) ·
[上一章](02-intent-spec-plan.md) · [下一章：部署与运行](04-deploy-operate.md)

## 3.1 构建从明确边界开始

Plan 完整批准后，仓库从已批准文档提交创建工程分支，只先分配 Tests，
不分配实现。Tests PR 指向生命周期分支；后续 Implementation PR 指向
`main`，携带完整增量。

[![历史 Tests PR，展示测试阶段契约和生命周期目标分支](../../assets/ai-native-sdlc-handbook/tests-review.png)](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/6)

**图 C。** 2026 年 10 月 12 日查看的
[huangyingting/ai-native-sdlc-discovery-demo#6](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/6)。
先认清目标分支、阶段元数据和范围，再打开 **Files changed**、**Checks** 和
[要求修改的审查](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/6#pullrequestreview-5333532414)。
截图只是入口，不是完整审查或测试结果。

| Tests 阶段可以做 | Tests 阶段不能做 |
|---|---|
| 增加有意义的验收断言 | 实现生产功能 |
| 记录实际观察到的预期失败 | 未运行就编造失败列表 |
| 批准前修正薄弱测试 | 为方便测试而修改已批准 Spec／Plan |
| 保留原有回归行为 | 把导入错误、跳过测试、损坏 hook 当成有效 Red |

## 3.2 测试是红的，验证任务却可以是绿的

受控 Red 表示：

1. 未修改的基线通过。
2. 新功能测试确实执行。
3. 因指定缺失行为失败，且与声明的测试名称及失败范围一致。
4. 编译、lint、build 正常，没有混入无关失败。

`tdd-red` 校验的正是这个契约。因此 **功能测试预期失败，但
`stage-validation` 应该通过**。因为“本来就期待 Red”而批准失败的校验任务，
混淆了测试结果和阶段门禁结果。

归属案例的 [Red attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36372294023/attempts/2)
确认恰好 **10 个声明的断言级失败**。批准绑定 Tests head：
`108699b7b12673596b04e14074fd84556c81073d`。

## 3.3 审查断言究竟证明了什么

首次生成的测试没有立即被接受。合理的测试外观和真正有用的断言之间有差别：

| 不充分的替代指标 | 更有力的实际观察 |
|---|---|
| 下拉选项里有负责人名字 | 正确队列行、详情元数据中真正显示负责人 |
| 时间戳没有变 | 独立 SQLite `PRAGMA data_version` 观察连接确认无写入 |
| 更新接口返回成功 | 分配、重分配、清空分别在关闭重开后保留 |
| 某处能返回所有记录 | 组合筛选的精确集合与空集都正确 |
| HTML 中有 selected 选项 | 挂载控件在真实导航后正确同步 |
| 某字段可以更新 | 只有允许字段改变，无关行／字段不变 |

反复问：**错误实现有没有可能仍然通过这个断言？**
如果有，就增强测试或写清限制。不要仅增加测试数量，而不增加识别错误的能力。

## 3.4 实现必须接受已批准测试的检验

Tests 审查并合并后，AI 才提出实现。审查者检查：

- Spec 要求的迁移、校验和行为。
- UI／数据是否真正接通，而不是只增加一个从未调用的 helper。
- 已批准测试、文档和失败清单是否逐字节保持不变。
- 必要的补充回归是否放在新文件里。
- 当前 head 的检查和审查，而不是之前某个 head 的通过状态。

真实 [归属实现](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/7)
通过 Stage Green 和应用 CI：**37 项测试、lint、build、容器 smoke**。
这是该次历史增量的数量，不要和后来 readiness 应用的 50 项混在一起。

| 必查位置 | 看什么 |
|---|---|
| `stage-validation` | 已批准文件不变，原预期失败场景全部转绿 |
| `validate` | 应用测试、lint 和 build |
| `container-smoke` | 真正生产容器的启动和 smoke |
| Delivery policy | 有资格的当前版本批准、必需检查和分支规则 |

新提交需要适用的重新审查。协调工作流执行成功，不能代替它所协调的应用检查。

## 3.5 最重要的反例：冻结测试工具本身有缺陷

后来的 readiness 工作说明了为什么 Red 不够：

```text
readiness 路由不存在
  → 带保护条件的测试按预期失败
  → Tests 被批准并冻结
  → 实现使更深层断言开始执行
  → 测试工具缺陷暴露
  → Green 失败，实现不合并
```

第一次维护实现
[huangyingting/ai-native-sdlc-discovery-demo#14](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/14)
产生 **44 项通过、4 项失败**。两个问题此前被“路由缺失”保护条件挡住了：

1. 简写的 `beforeEach` 返回了 mock 函数，Vitest 将它当作清理函数调用。
2. 长期存在的 SQLite 观察连接，在另一个连接变更 schema 后仍保留旧列元数据。

此前的 Tests 审查漏掉了这些缺陷。没有因此加入迎合测试的生产代码，也没有
悄悄修改冻结测试。操作者取消
[huangyingting/ai-native-sdlc-discovery-demo#8](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/8)，
创建明确的 [延续任务](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/17)。

冻结延续任务的新测试之前，单独的 **隔离 harness 实验** 把新测试与此前未合并
路由候选组合，48 项全部通过，从而实际触达更深断言。这不是阶段 Green，
也没有把生产代码放进 Tests 分支。

之后的实现审查还发现：通过修改异常属性来“清理错误信息”，遇到冻结异常对象
会再次抛错。两个新的补充测试复现了缺陷；删除这类修改后，**50 项全部通过**，
同时保留所有已批准的原测试。

这是有纪律的反馈循环，不是“无人干预的完美实现”。

## 3.6 验证“验证器”自身

可靠性后续工作继续追问：最终 readiness 测试是否能识别具体错误实现？

| 人为变异 | 为什么必须发现 |
|---|---|
| 省略数据库读取 | 看似健康的端点可能根本没检查依赖 |
| 数据库失败仍返回 200 | 准入会接受不可用实例 |
| 成功或失败时省略 `no-store` | 缓存结果可能掩盖当前状态 |
| 记录原始异常 | 诊断信息可能暴露敏感细节 |
| 修改捕获到的冻结异常 | 错误处理反而产生新错误 |

实际结果是：**13 项原测试通过 → 六个指定变异全部被检测 →
恢复后 13 项再次通过**。测试文件没有改变。冻结异常变异有明确允许的、
出现在指定测试体中的应用 TypeError，不会被误称为纯断言失败；导入、hook
和超时错误不能算有效检测。

这是狭窄契约的六个指定检查，**不是整个项目的 mutation score**。
推广结论前先看 [真实资格验证证据](../../brownfield-reliability-rehearsal.md#2-trustworthy-verification)。

## 3.7 失败分类与下一步

| 观察 | 正确处理 |
|---|---|
| 到功能断言之前依赖／导入就失败 | 修环境或测试工具，不记录为有效 Red |
| 代码违反已批准行为 | 在同一契约内修代码，重新检查 |
| 批准前发现测试薄弱 | 修 Tests，重新运行真实 Red |
| 冻结契约或测试工具有错 | 明确新任务／延续，保留失败证据 |
| Green 通过却缺少重要失败覆盖 | 增加独立／补充资格验证，不削弱原测试 |
| 只有模型总结说“修好了” | 先真正验证，再接受 |

### 阶段退出检查

- [ ] 基线、真实 Red、真实 Green 分别可追溯。
- [ ] 已批准断言真正到达关键行为。
- [ ] 没有为获得 Green 而弱化测试或文档。
- [ ] 失败有分类和保留的证据。
- [ ] 当前 head 的代码审查与必需检查满足。
- [ ] 未验证行为明确写出。

[下一章：验证镜像、验收行为并闭合运行反馈](04-deploy-operate.md)。
