<a id="engineering-lab"></a>
# 工程实验应用 (Engineering Lab)

[English](README.en.md)

这是一个刻意保持极简、完全独立的工单派单实验应用，专门用于边界明确的受控工程实验。
应用内的所有人员身份与测试工单均为合成数据。它仅使用 Node.js 24 内置的原生能力（包含原生的 `node:sqlite`），
不依赖任何第三方 npm 运行时依赖或测试框架。它不是 npm workspace，亦不与 IT 服务台共享任何数据或代码。

```sh
cd demos/engineering-lab
npm test
npm start
```

该工程无需任何 `npm install` 步骤即可直接运行。锁定文件清晰登记了该独立软件包的零外部依赖状态。
CLI 默认在内存数据库中运行并输出 JSON 数组；Node.js 可能会在 stderr 中输出关于 SQLite 实验性特性的常规提示。

关于完整的参数校验、筛选逻辑、数据持久化与 API 行为定义，请参阅行为契约文档 [contract.md](contract.md)。
当前基线版本**刻意未实现临时代理负责人（Proxy Owner）功能**。

<a id="fixture-validation"></a>
## 实验基底验证

获批的测试套件恰好包含 **15 项测试用例**，未包含任何依赖脆弱执行时延的断言。
持久化测试会在当前工作目录下创建唯一的临时目录并在测试结束后自动销毁，因此请在具备写权限的工作目录中执行测试。

在仓库根目录下运行：

```sh
node --test tools/engineering-demo/tests/cases.test.mjs
node tools/engineering-demo/oracle.mjs case-1 demos/engineering-lab
node tools/engineering-demo/oracle.mjs case-2 demos/engineering-lab
node tools/engineering-demo/oracle.mjs case-3 demos/engineering-lab
```

每个诊断判定器指令均会在未修改的基线版本上顺利通过。这 3 个典型案例分别对应引入业务代码缺陷、测试断言漂移与运行时配置故障；公开的修复请求绝不提前泄露任何诊断答案。应用其中任何一个案例，均会使当前获批的测试用例抛出失败。
工具自身的测试套件包含 **12 项测试**。每次成功诊断会报告 **20 项判定器检查**；测试断言漂移的案例依然必须修复可见的测试套件，因为独立业务判定器能够正确识别未改变的业务行为。

独立的 `impact` 判定器在此初始基线上必须报错：它用于严密验证 `IMPACT_CONTRACT` 所定义、尚待实现的临时代理负责人功能，坚决杜绝在功能缺失时虚假判定通过。判定器会在可写的工作区中创建临时数据库并在此后自动清理，且绝不会修改应用源文件。在容器中的执行命令为：
`node /oracle/oracle.mjs CASE_ID /work`（亦可使用 `impact` 替换 `CASE_ID`），
其中 `/work` 与 `/oracle` 挂载为只读，工作目录保持可写。
标准输出 stdout 仅在最后一行输出 JSON 格式的成功/失败摘要。
影响分析验证成功时会报告 **35 项检查**，全面覆盖既有契约、表结构迁移、代理人分配、清空、数据持久化、检索筛选、数据序列化与文档定义的 API 命名。若校验未达标，一律规范返回 `{"kind":"engineering-oracle","passed":false,"checks":0}` 并以非零状态码退出，杜绝泄露断言内部细节。
