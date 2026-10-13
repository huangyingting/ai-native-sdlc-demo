# 故障诊断与 Agent 策略：修好并不是全部结果

[English](engineering-judgment.en.md) · [案例索引](README.md) · [代理负责人方案](change-impact.md)

**这是受控 CLI 实验，不是编码 Agent 交付。** CLI 生成诊断和候选文本，
可信程序应用并验证。Issue 评论是助手通过授权操作者账号发布的摘要。
角色与评论来源见[参与者说明](../copilot-roles.md)。

## 结果与边界

真实六组实验完成，**六组行为修复通过，但只有四组完整验收通过**。
两种策略都把运行配置故障错误归类为产品缺陷。
因此实验返回 `completed-with-failures`，退出码 **2**；
这不是基础设施故障，也不是全部成功的比较。

两个演示共用一个受控样本：识别故障类别，以及比较直接修复和先诊断再修复。
[原始结果](https://github.com/huangyingting/ai-native-sdlc-demo/issues/29)和
[脱敏测量报告](assets/engineering/summary.json)保留所有组的结果。
没有重试失败组，也没有人工修改生成的补丁。

![原始诊断与策略结果](assets/engineering/strategy-results.png)

[截图来源记录](assets/engineering/manifest.json)保留页面来源、拍摄时间和未修改的图片哈希。

## 输入与执行控制

小型[工程实验应用](../../demos/engineering-lab/README.md)独立于服务台。
其模拟负责人是 `avery` 和 `jordan`，不是 Alex Chen / Sam Rivera。

| 输入 | 固定观察 |
|---|---|
| 样本来源 | `0eb9973b3fb09d648ebeea21b64786a763fc3021` |
| 样本哈希 | `4d25f387db0329a1add68680ebd2f52974ae58e5996ce0adb3e61b12c40f351d` |
| 沙箱镜像 | `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` |
| 实测沙箱运行时 | Node 24.21.0，linux/amd64 |
| 实测 CLI／模型 | Copilot 1.0.89 / `gpt-5.6-sol`，未指定模型覆盖 |
| 可见对照测试 | 15/15 通过 |
| 每组预算 | 最多两次调用，每次 120 秒，每组 300 秒 |
| 真实实验请求 | 九次：直接策略三次，先诊断策略六次 |

每次调用都验证**可用工具数和工具请求数均为零**。
模型返回候选文本，由路径白名单适配器应用修改。
生成代码只在受限 Docker 内运行：非 root、无网络、工作区和独立检查器只读、
临时可写存储，以及资源和时间限制。不在宿主机执行候选源码。
每个测试与独立检查沙箱都已清理。

## 三类故障

| 样本 | 人为故障 | 正确类别 | 允许的修复范围 |
|---|---|---|---|
| 1 | 负责人和状态条件由 AND 变为 OR | 产品 | `src/domain.mjs` |
| 2 | 测试预期了错误的模拟负责人 | 测试框架 | `tests/domain.test.mjs` |
| 3 | 数据库路径位于 `/dev/null` 下 | 环境 | `runtime.json` |

[固定样本定义](../../tools/engineering-demo/cases.mjs)在执行前规定故障和范围。
两种策略获得相同的样本输入哈希，各样本交替执行顺序。
直接策略用一次调用完成诊断和补丁；先诊断策略先调用一次诊断，再调用一次修复。

```text
同一冻结样本 → 直接诊断与补丁 → 可见测试与独立检查
同一冻结样本 → 诊断 → 有限补丁 → 可见测试与独立检查
                 分类、证据与修改范围分别设关卡
```

## Copilot 实际说了什么

固定请求为“诊断并修正观察到的 CI 失败，不改变无关行为”，同时提供行为约定、
故障源码和实测失败测试。下列是直接策略的实际输出摘录，不是重跑或改写的成功解释。
模型原句保留英文。

### 产品筛选

输入在约定要求 AND 的地方使用 OR。
Copilot 返回 `classification: "product"`，理由为：

> The product implementation combines independent owner and status predicates with OR, so a ticket is incorrectly accepted whenever either predicate passes—including when one filter is omitted. Replacing OR with AND implements the documented intersection semantics while preserving individual-filter and no-filter behavior.

```diff
-  return ownerMatches || statusMatches;
+  return ownerMatches && statusMatches;
```

独立行为检查和分类关卡均通过。

### 测试框架漂移

Copilot 返回 `classification: "test-harness"`：

> The implementation returns the ticket's existing owner exactly as required by the documented contract. The failing test incorrectly expects 'jordan' for a ticket owned by 'avery', so the assertion must be restored to the contractually correct value without changing product behavior.

```diff
-  assert.equal(effectiveOwner(ticket), 'jordan');
+  assert.equal(effectiveOwner(ticket), 'avery');
```

此样本特意允许修复错误的测试框架断言，不允许修改产品行为迎合错误测试。
两项关卡均通过。

### 运行配置：修复通过，标签失败

Copilot 返回 `classification: "product"`，但预期类别为 `environment`。
实际理由正确描述了配置问题：

> The checked-in runtime configuration violates the documented contract by pointing SQLite beneath /dev/null, which cannot contain a database file. Both CLI tests therefore fail while domain, API, and store behavior pass. Restoring the required in-memory database path fixes the root cause without changing code, tests, fallback behavior, or unrelated semantics.

```diff
-  "databasePath": "/dev/null/engineering-lab.db"
+  "databasePath": ":memory:"
```

这不表示模型没有找到配置原因。修复和说明都指出了原因，
但**分类字段错误**，所以完整验收失败。先诊断策略也返回了错误类别，
其结果保留在六组报告中。

[准确摘录记录](assets/engineering/copilot-excerpts.json)包含源码证据和响应哈希，
与公开实测摘要匹配。这些是选定最终回答字段和单行差异，
不是完整原始会话或完整候选文件。

## 六组完整结果

| 样本 | 策略 | 初始通过／失败测试 | 最终可见测试／独立检查 | 报告类别 | 完整验收 |
|---|---|---:|---|---|---|
| 产品筛选 | 直接 | 10 / 5 | 15/15 + 20/20 | 产品 | 通过 |
| 产品筛选 | 先诊断 | 10 / 5 | 15/15 + 20/20 | 产品 | 通过 |
| 测试预期漂移 | 先诊断 | 14 / 1 | 15/15 + 20/20 | 测试框架 | 通过 |
| 测试预期漂移 | 直接 | 14 / 1 | 15/15 + 20/20 | 测试框架 | 通过 |
| 运行路径 | 直接 | 13 / 2 | 15/15 + 20/20 | 产品，错误 | 失败 |
| 运行路径 | 先诊断 | 13 / 2 | 15/15 + 20/20 | 产品，错误 | 失败 |

六组都遵守修改范围、保留要求不变的测试，并通过独立行为检查。
证据校验通过，但不覆盖分类关卡。
**基础设施失败为零**，**行为上虚假的完成声明为零**，
另有**两次未获完整验收的完成声明**，原因是运行路径分类错误。

最后两组很适合讲解：绿灯证明有限修复有效，不证明解释正确。
不要因为应用随后可用，就把它们改写成成功诊断或隐藏失败。

## 实际策略成本

| 指标，三组合计 | 直接 | 先诊断 |
|---|---:|---:|
| 完整验收通过组数 | 2/3 | 2/3 |
| 已验证修复 | 3/3 | 3/3 |
| 调用次数 | 3 | 6 |
| 组耗时合计 | 61,728 毫秒 | 106,063 毫秒 |
| 输入 token | 24,820 | 50,569 |
| 输出 token | 1,421 | 2,499 |
| 缓存读取 token | 0 | 0 |
| 缓存写入 token，属于输入子集 | 24,811 | 50,551 |
| 高级请求单位 | 3 | 6 |
| Nano-AIU | 15,251,100,000 | 30,280,700,000 |
| 推算美元费用 | 无 | 无 |

耗时是实测各组持续时间之和，不只是 API 时间。
缓存写入 token 已包含在输入 token 中，不可重复相加。
CLI 请求单位和 nano-AIU 是实测用量，不是美元账单。

在**这三个样本中**，增加步骤带来了额外成本，没有提高完整验收率。
每组仅一次试验、任务集小且为模拟样本、只观察一个模型，
不能据此宣称某种策略普遍更优或具有统计显著性。

## 单独保留的隔离失败

实验前，第一次代理负责人方案调用被安全拒绝：
CLI 暴露了两个工作流工具别名，虽然没有发出工具请求。
工具代码将这些实际观察到的别名加入明确排除列表，保留不符合隔离条件就拒绝的检查，
并在新的调用中验证工具数为零。

被拒绝的请求不属于九次对比实验调用。
加上后来的代理方案与实现，当前共计**十二次真实调用**：
一次兼容性拒绝、一次方案、九次实验请求和一次有限实现。
[代理实验](change-impact.md)经委托本地操作者审查后，通过十五项不变测试和
三十五项独立检查；不会改变上述六组对比实验的结果。

## 怎样讲解或重复

先展示运行路径一行：行为通过，分类失败。
然后比较两种策略的实际用量，不使用假设价格。
最后说明证据校验、解释与行为分别意味着什么。

有限执行步骤统一参照
[可复用工程实验指南](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/engineering-judgment-demos.md)。
不要重试失败组来替换现有结果；新实验必须独立保留输入、预算和完整结果。
