# 故障诊断与 Agent 策略评估：修好代码不等于完全达标

[English](engineering-judgment.en.md) · [案例索引](README.md) · [代理负责人影响分析](change-impact.md)

**工程实践声明：**本专题属于受控 CLI 实验，而非由 Coding Agent 交付的正式生产 PR。在严格沙箱中，由 Copilot CLI 生成故障归因、推导理由与候选补丁文本，再由高可信的独立验证程序应用并复核。（详见[演示目标与 Copilot 角色规范](../copilot-roles.md)）。

## 实验结论与严谨边界

本专题针对 6 组真实环境案例开展了完整评测，**6 组行为修复代码均通过了功能测试，但仅有 4 组完全通过关卡验收**。
主要原因在于：在面对环境配置类故障时，两种策略均错误地将配置问题归类为产品代码缺陷。
因此，评测系统最终如实返回状态 `completed-with-failures`，退出码为 **2**；
这并非评测基础设施本身发生故障，而是实验真实、客观记录了模型在特定场景下的判断偏差。

本次受控实验将两个核心课题统一在同一组标准化样本中进行量化衡量：一是大模型对不同层级故障的根因归因准确率；二是“直接修复”与“先诊断再修复”两种策略在效果与成本上的客观差异。
[实验原始审计 Issue](https://github.com/huangyingting/ai-native-sdlc-demo/issues/29) 与
[脱敏实测度量报告](assets/engineering/summary.json)完整留存了全部 6 组案例的原始数据，绝无人工重试失败样本，亦无人工修补候选补丁。

![原始诊断与策略结果](assets/engineering/strategy-results.png)

详细的审计索引请参阅[截图清单与校验记录](assets/engineering/manifest.json)。

## 输入要素与受控执行边界

作为评测宿主的独立[工程实验应用](../../demos/engineering-lab/README.md)与服务台生产代码完全解耦。其模拟测试人员为 `avery` 与 `jordan`，而非服务台业务中的 Alex Chen 与 Sam Rivera。

| 实验要素 | 固定的受控基准 |
|---|---|
| **测试样本 Git SHA** | `0eb9973b3fb09d648ebeea21b64786a763fc3021` |
| **测试样本内容 Hash** | `4d25f387db0329a1add68680ebd2f52974ae58e5996ce0adb3e61b12c40f351d` |
| **受控 Docker 镜像** | `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` |
| **沙箱运行时环境** | Node 24.21.0，linux/amd64 |
| **实测 CLI 与默认模型** | Copilot CLI 1.0.89 / `gpt-5.6-sol`，未指定任何覆盖参数 |
| **基线回归测试集** | 15/15 全部绿灯通过 |
| **单组资源预算** | 最多调用 2 次，单次限时 120 秒，单组总时限 300 秒 |
| **真实模型调用总计** | 9 次：直接策略消耗 3 次，先诊断策略消耗 6 次 |

在每次模型调用中，评测程序均严格验证**模型可用工具数与工具实际调用数均为零**。
模型返回结构化文本后，由高可信的路径白名单适配器将补丁应用至隔离沙箱。生成的代码严格在受限 Docker 容器内编译运行：采用非 root 用户、彻底隔离外网、工程工作区与独立检查器设为只读、仅开放临时可写存储，并施加了严格的 CPU/内存资源与超时限制，绝不在宿主机环境中直接运行未审查的候选代码。每个测试沙箱均在验证结束后彻底销毁。

## 三类典型的故障样本设计

| 样本编号 | 注入的典型故障 | 标准分类归属 | 严格限定的修复文件边界 |
|---|---|---|---|
| **样本 1** | 工单负责人与状态的筛选逻辑由 AND 错误写为 OR | **业务代码 (product)** | `src/domain.mjs` |
| **样本 2** | 测试断言中错误期望了错误的模拟负责人 | **测试套件 (test-harness)** | `tests/domain.test.mjs` |
| **样本 3** | SQLite 数据库路径被错误配置在 `/dev/null` 目录下 | **环境配置 (environment)** | `runtime.json` |

[固定样本定义文件](../../tools/engineering-demo/cases.mjs)在执行前预设了故障类型与改动边界。两种策略输入相同的样本内容 Hash，且在各样本间交替执行。直接策略使用 1 次调用同时输出故障诊断与修复补丁；先诊断策略则通过第 1 次调用输出归因分析，再通过第 2 次调用输出针对性修复。

```text
同一冻结样本 → 直接策略（一次调用生成诊断与补丁）→ 既有测试回归 + 独立行为检查
同一冻结样本 → 先诊断策略（首轮诊断 → 次轮生成补丁）→ 既有测试回归 + 独立行为检查
                 对“归因标签”、“证据完整性”与“修改文件范围”分别设置严密关卡
```

## Copilot 实际生成的输出实录

固定的 Prompt 请求为：“诊断并修复当前观察到的 CI 失败，严禁改变与此无关的任何行为”，同时向模型提供行为契约说明、故障代码现场以及真实的测试报错日志。以下为直接策略下的原始输出摘录（保留模型英文原句）：

### 样本 1：业务代码筛选逻辑错误

代码现场在契约明确要求交集（AND）的地方错误使用了并集（OR）。
Copilot 准确输出 `classification: "product"`，推导理由如下：

> The product implementation combines independent owner and status predicates with OR, so a ticket is incorrectly accepted whenever either predicate passes—including when one filter is omitted. Replacing OR with AND implements the documented intersection semantics while preserving individual-filter and no-filter behavior.

```diff
-  return ownerMatches || statusMatches;
+  return ownerMatches && statusMatches;
```

独立行为测试与分类标签门禁均顺利通过。

### 样本 2：测试框架断言漂移

测试用例中的断言偏离了契约。Copilot 准确输出 `classification: "test-harness"`：

> The implementation returns the ticket's existing owner exactly as required by the documented contract. The failing test incorrectly expects 'jordan' for a ticket owned by 'avery', so the assertion must be restored to the contractually correct value without changing product behavior.

```diff
-  assert.equal(effectiveOwner(ticket), 'jordan');
+  assert.equal(effectiveOwner(ticket), 'avery');
```

在该样本中，规则明确允许修复错误的测试断言，但坚决禁止通过修改原本正确的业务代码来迁就错误的测试用例。两项关卡均顺利通过。

### 样本 3：运行时环境配置异常（修复转绿，但分类判定失败）

Copilot 在分类字段中输出了 `classification: "product"`，而预期正确分类为 `environment`。
但耐人寻味的是，模型给出的自然语言推导理由却极为精准地指出了配置根因：

> The checked-in runtime configuration violates the documented contract by pointing SQLite beneath /dev/null, which cannot contain a database file. Both CLI tests therefore fail while domain, API, and store behavior pass. Restoring the required in-memory database path fixes the root cause without changing code, tests, fallback behavior, or unrelated semantics.

```diff
-  "databasePath": "/dev/null/engineering-lab.db"
+  "databasePath": ":memory:"
```

这充分说明：模型实际上已经准确理解了故障系配置错误引起，其生成的补丁与推导逻辑也完全正确；但由于在枚举字段 `classification` 上未能准确映射为 `environment`，因而被自动化门禁判定为未完全通过。在先诊断策略中同样出现了这一分类偏差，相关结果如实保留在评测总表中。

[已审查摘录记录](assets/engineering/copilot-excerpts.json)收录了原始输出凭证与响应 Hash，与公开实测摘要严格对应。材料仅公开选定的最终结构化字段与关键 Diff，不公开未脱敏的完整会话上下文。

## 6 组案例的完整评测结果汇总

| 测试样本 | 实验策略 | 初始通过/失败用例数 | 修复后可见测试/独立检查 | 模型归报分类 | 最终完全验收结论 |
|---|---|---:|---|---|---|
| **业务代码筛选** | 直接策略 | 10 / 5 | 15/15 + 20/20 | 业务代码 (product) | **完全通过** |
| **业务代码筛选** | 先诊断策略 | 10 / 5 | 15/15 + 20/20 | 业务代码 (product) | **完全通过** |
| **测试断言漂移** | 先诊断策略 | 14 / 1 | 15/15 + 20/20 | 测试套件 (test-harness) | **完全通过** |
| **测试断言漂移** | 直接策略 | 14 / 1 | 15/15 + 20/20 | 测试套件 (test-harness) | **完全通过** |
| **运行配置路径** | 直接策略 | 13 / 2 | 15/15 + 20/20 | 业务代码 (错误) | **未完全通过** |
| **运行配置路径** | 先诊断策略 | 13 / 2 | 15/15 + 20/20 | 业务代码 (错误) | **未完全通过** |

全部 6 组案例均严格遵守了改动文件边界、保留了未变动的既有测试，且功能上完全通过了独立扩展检查。自动化证据校验通过，但无法豁免分类标签关卡的未达标。
在整场评测中：**评测基础设施故障为 0**；**功能测试虚假转绿（伪通过）为 0**；如实记录了 **2 次分类标签未完全通过**的案例。

这后两组案例具有极高的教学与研讨价值：它生动证明了代码绿灯转绿仅能说明补丁在行为上有效，并不等于模型对问题的认知分类完全严谨。在工程复盘中，切不可因为系统随后能跑通，就将客观的分类偏差包装为所谓“完全成功”。

## 两种策略的实际调用成本量化

| 实测度量指标（3 组案例累计） | 直接策略 (Direct) | 先诊断策略 (Diagnose-First) |
|---|---:|---:|
| 完全验收通过率 | **2/3 (66.7%)** | **2/3 (66.7%)** |
| 修复代码行为通过率 | 3/3 (100%) | 3/3 (100%) |
| 模型调用总次数 | 3 次 | 6 次 |
| 累计耗时总计 | 61,728 ms | 106,063 ms |
| 累计消耗输入 Token | 24,820 | 50,569 |
| 累计消耗输出 Token | 1,421 | 2,499 |
| 缓存命中读取 Token | 0 | 0 |
| 缓存写入 Token (包含在输入中) | 24,811 | 50,551 |
| 高级请求单元 (Advanced Units) | 3 | 6 |
| 计费度量 (Nano-AIU) | 15,251,100,000 | 30,280,700,000 |
| 预估美元成本 | 无（不作估算） | 无（不作估算） |

实测耗时为整个生命周期的实际运行时间总和，而非单纯的模型推理等待时延。缓存写入 Token 已包含在输入 Token 中，不可重复叠加。统计指标忠实反映了实测开销，杜绝随意推算美元金额。

在**本次评测的 3 个典型样本中**，额外增加独立的诊断步骤使调用次数与 Token 开销翻倍，但在最终完全验收率上并未带来收益。考虑到当前样本规模有限且属于合成测试集，本实验不作任何普适性的策略优劣排名。

## 独立保留的兼容性拦截记录

在正式评测前，针对代理负责人方案的首次调用触发了合规拦截：当时 CLI 环境暴露了两个外部工作流工具别名（即便模型在实际运行中并未发起工具请求）。评测框架依据严格的隔离策略直接终止了该次调用。随后测试程序将这组别名纳入显式排除清单，并在后续调用中严格校验可用工具数为 0。

该被拦截的请求不计入正式的 9 次对比实验。算上后续的代理方案与代码生成，整个评测体系累计完成了 **12 次真实模型调用**：1 次合规拦截、1 次方案生成、9 次实验调用与 1 次代码实现。后续开展的[变更影响实验](change-impact.md)通过了 15 项既有测试与 35 项独立检查，不会影响本对比实验的客观数据。

## 现场演示与复现建议

建议在演示时按如下逻辑展开：首先重点呈现运行配置故障中“代码行为修复成功，但标签分类判定失败”的鲜明对比，展现真实大模型工程实践的复杂性；接着结合实测数据客观对比两种策略在耗时与 Token 上的翻倍差异；最后深入阐述测试绿灯、证据校验与认知归因三者之间的独立关系。

操作指南请参考[可复用工程实验指南](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/engineering-judgment-demos.md)。
严禁通过重复运行失败样本来人工粉饰实验结果；每一次全新实验均必须独立留存完整的输入哈希、运行预算与客观原始数据。
