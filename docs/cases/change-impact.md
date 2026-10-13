# 变更影响：先审查代理负责人方案，再实现

[English](change-impact.en.md) · [案例索引](README.md) · [诊断与策略](engineering-judgment.md)

## 当前关卡

一次真实 Copilot 调用生成了完整影响方案，其引用和语义已审查，
隔离基线 **15/15** 通过。
**仍待操作者明确批准。尚无实现调用、批准回执、应用修改或 35 项影响检查结果。**

[方案审查](https://github.com/huangyingting/ai-native-sdlc-demo/issues/30)
是持久的英文记录。创建该 Issue 不会批准方案。
基线[工程实验应用](../../demos/engineering-lab/README.md)仍无代理负责人功能，
IT 服务台也未修改。

![原始准确哈希方案审查](assets/engineering/impact-review.png)

来源见[截图记录](assets/engineering/manifest.json)。

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
这些是后续验收条件，不是已经取得的结果。

## 准确方案绑定

| 绑定 | 值 |
|---|---|
| 方案哈希 | `2da119edb9b422f51024d85af9e9278aed748a958c1fa4891714cf1af869f02a` |
| 样本来源 | `0eb9973b3fb09d648ebeea21b64786a763fc3021` |
| 样本哈希 | `4d25f387db0329a1add68680ebd2f52974ae58e5996ce0adb3e61b12c40f351d` |
| 约定哈希 | `1581ec33f802fe9c0d638dc0ebb19d1ac8f78c65c1e36d3799dfbb53fa554eba` |
| 沙箱镜像 | `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` |

批准必须绑定未改变的方案、样本、约定和不可变镜像。
修改方案后需要新哈希和新审查。本地操作者回执只是开发测试关卡，
不是经过 GitHub 身份认证的人类验收，也不是另一个交付阶段的批准。

## 真实方案用量与隔离

合格方案使用实测默认模型 `gpt-5.6-sol`：
一次调用，耗时 **50,733 毫秒**，**7,209 输入／3,445 输出 token**，
缓存读取为零，7,206 缓存写入 token 已包含在输入中。
实测用量为一个高级请求单位和 **10,494,200,000 nano-AIU**，
未推算美元价格。工具数和工具请求数均验证为零，
十五项对照测试的沙箱已清理。

更早的隔离拒绝单独保留：45,871 毫秒，
8,294 输入／3,182 输出 token，一个高级请求单位，
10,510,700,000 nano-AIU。两个可用工具别名导致拒绝，即使实际请求数为零。
未复用或执行其输出。这是明确披露的兼容性失败，不是隐藏的成功方案重试。

## 下一步授权动作

```text
审查准确方案 → 操作者明确批准 → 验证全部绑定
    → 一次有限实现调用 → 不变的十五项测试与三十五项影响检查
    → 报告实际结果，包括失败 → 清理沙箱
```

尚未开始实现。明确批准后，适配器只可修改允许的四个文件，
生成源码只能在受限 Docker 中执行。应保留结果，不能静默修改或重试。
操作命令统一参照
[可复用影响分析流程](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/engineering-judgment-demos.md)；
本页记录的是实际当前关卡。
