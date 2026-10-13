# 变更影响：从审查方案到兼容实现

[English](change-impact.en.md) · [案例索引](README.md) · [诊断与策略](engineering-judgment.md)

**这是工程附录，不是编码 Agent 的产品 PR。** Copilot CLI 生成方案和候选文本，
可信验证程序执行检查。参照[演示目的与 Copilot 作用](../copilot-roles.md)。

<a id="当前关卡"></a>
## 结果与审查边界

一次真实 Copilot 调用生成了完整影响方案，其引用和语义已审查，
隔离基线 **15/15** 通过。
经审查的方案、样本、行为约定和不可变镜像保持相同哈希，再进行一次受限实现调用。
实现通过 **15/15 不变测试和 35/35 独立检查**。

[方案审查](https://github.com/huangyingting/ai-native-sdlc-demo/issues/30)和
[完成结果](https://github.com/huangyingting/ai-native-sdlc-demo/issues/30#issuecomment-6136318336)
保留方案与执行结果。

基线[工程实验应用](../../demos/engineering-lab/README.md)仍无代理负责人功能，
为可重复比较而特意保持不变。代理实现存在于隔离候选代码中，
不是已部署的服务台功能或已验收的生产交付。

![原始准确哈希方案审查](assets/engineering/impact-review.png)

来源见[截图记录](assets/engineering/manifest.json)及
[脱敏实现摘要](assets/engineering/impact-summary.json)。

## Copilot 实际生成了什么

固定输入以这段准确请求摘录开始：

> Add temporary proxy assignment to the ticket application, preserving all existing behavior and approved tests.

CLI 获得已提交的模拟源码和固定行为约定，没有获得独立验收检查器。
方案中的一项实际决定是：

> Create new tables with nullable proxy_owner TEXT and, after opening, inspect the existing tickets schema and issue ALTER TABLE tickets ADD COLUMN proxy_owner TEXT only when the column is absent.

实现的实际理由为：

> Implements temporary proxy ownership while preserving accountable ownership and legacy behavior. The store adds an idempotent additive proxy_owner migration, exposes proxyOwner on persisted tickets, validates and persists proxy assignment/clearing, and the API serializes both proxyOwner and effectiveOwner. Documentation covers ownership semantics, filtering, errors, persistence, and migration compatibility.

`src/domain.mjs` 中的选定差异直接展示模型提出的修改，不只依靠操作者转述：

```diff
-  return ticket.owner ?? null;
+  return ticket.proxyOwner ?? ticket.owner ?? null;
```

可信适配器应用白名单候选文本，再由 Docker 和独立检查确认 15/15 与 35/35。
不是模型自己运行并宣称检查通过。
[准确摘录记录](assets/engineering/copilot-excerpts.json)将方案和实现选段
绑定到实测摘要中的响应哈希。只发布选定文本和差异，不发布完整原始载荷。

## 拟议业务规则

临时代理不能覆盖承担责任的原负责人。
实验样本支持的负责人是 `avery` 和 `jordan`。

```text
effectiveOwner(ticket) = ticket.proxyOwner ?? ticket.owner ?? null
```

可以分配、转交或清空可为空的代理，保持工单标识、标题、状态和责任负责人不变。
筛选按有效负责人执行，并与状态条件以 AND 同时生效，包括未分配工单。
已有和新建工单均以 `proxyOwner: null` 开始。

## 影响范围与限制

| 工程实验应用中的范围 | 拟议修改 | 必须保留 |
|---|---|---|
| [领域逻辑](../../demos/engineering-lab/src/domain.mjs) | 有效负责人、代理校验和组合筛选 | 责任负责人不变，保留 null 语义和 AND |
| [存储](../../demos/engineering-lab/src/store.mjs) | 可为空的 SQLite `proxy_owner`；`assignProxy` | 增量幂等迁移，不重建表或丢失历史数据，重开后持久保留 |
| [API](../../demos/engineering-lab/src/api.mjs) | 序列化 `proxyOwner` 和 `effectiveOwner`，包含 null | 保留原序列化字段 |
| [行为约定](../../demos/engineering-lab/contract.md) | 记录行为、校验、清空与迁移 | 不引入未要求的身份或授权功能 |

只允许修改上述四个文件。无效或 undefined 代理必须抛出 `TypeError`；
缺失、非正数、非整数或非数字标识必须抛出 `RangeError`，
不能插入或修改工单。两位受支持负责人和 null 都是有效赋值。
十五项已批准可见测试必须保持不变，实现还必须通过 **35 项独立影响检查**。
候选实现满足了这些条件，所有获批测试文件内容不变，
只有允许的四个文件与基线不同。

## 准确方案绑定

| 绑定 | 值 |
|---|---|
| 方案哈希 | `2da119edb9b422f51024d85af9e9278aed748a958c1fa4891714cf1af869f02a` |
| 样本来源 | `0eb9973b3fb09d648ebeea21b64786a763fc3021` |
| 样本哈希 | `4d25f387db0329a1add68680ebd2f52974ae58e5996ce0adb3e61b12c40f351d` |
| 约定哈希 | `1581ec33f802fe9c0d638dc0ebb19d1ac8f78c65c1e36d3799dfbb53fa554eba` |
| 沙箱镜像 | `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` |

批准必须绑定未改变的方案、样本、约定和不可变镜像。
修改方案后需要新哈希和新审查。开发测试中的方案审查不替代交付产品的验收。

<a id="真实方案用量与隔离"></a>
## 真实调用用量与隔离

合格方案使用实测默认模型 `gpt-5.6-sol`：
一次调用，耗时 **50,733 毫秒**，**7,209 输入／3,445 输出 token**，
缓存读取为零，7,206 缓存写入 token 已包含在输入中。
实测用量为一个高级请求单位和 **10,494,200,000 nano-AIU**，
未推算美元价格。工具数和工具请求数均验证为零，
十五项对照测试的沙箱已清理。

单次实现调用使用同一实测模型：**33,480 毫秒**、
**10,090 输入／2,414 输出 token**、缓存读取为零，
10,087 缓存写入 token 已包含在输入中，一个高级请求单位，
**9,872,700,000 nano-AIU**。再次验证工具数为零；
可见测试和独立检查沙箱均已清理。未重试实现，也未人工修改候选代码。

更早的隔离拒绝单独保留：45,871 毫秒，
8,294 输入／3,182 输出 token，一个高级请求单位，
10,510,700,000 nano-AIU。两个可用工具别名导致拒绝，即使实际请求数为零。
未复用或执行其输出。这是明确披露的兼容性失败，不是隐藏的成功方案重试。

<a id="下一步授权动作"></a>
## 已验证实现结果

```text
审查准确方案 → 记录审查 → 验证全部绑定
    → 一次有限实现调用 → 不变的十五项测试与三十五项影响检查
    → 报告实际结果，包括失败 → 清理沙箱
```

| 已验证范围 | 独立检查 |
|---|---|
| 负责人 | 责任负责人不变；代理分配、转交、清空及有效负责人和 null 组合 |
| 迁移 | 增加可为空 TEXT 列，保留原表根页、索引、元数据和原工单字段 |
| 持久化 | 代理在关闭重开后保留，多次初始化无破坏 |
| 筛选与 API | 负责人和状态 AND 组合，保留原字段与代理、有效负责人显式 null |
| 无效输入 | 要求的 TypeError/RangeError，不插入或修改数据 |
| 修改范围 | 仅四个允许文件改变，十五项获批测试不变，行为约定已更新 |

候选哈希：
`a88beb04eeca099d17ed3f4a79ef35ba646845d3c6bfadcfadff88714db518e0`。
可见验证 15/15，没有跳过、取消或待办测试；独立检查 35/35，退出码 0。
两个沙箱都成功清理。

当前全部场景共记录十二次真实调用：一次保留的隔离拒绝、一次方案、
九次对比实验和一次实现。实验中的两次分类失败保持不变。

生成代码只在受限 Docker 中运行，从未在宿主机执行；
私有提示词、完整原始回复和完整候选源码不公开；上面的已审查选段说明实际贡献。
这完成了有限变更影响实验，
不是独立人类验收或生产授权。操作命令统一参照
[可复用影响分析流程](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/engineering-judgment-demos.md)。
