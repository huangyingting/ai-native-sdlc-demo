<a id="engineering-lab"></a>
# 工程实验室

[English](README.en.md)

这是一个刻意保持精简、独立的工单分配应用，用于范围明确的工程练习。
所有身份与请求都是合成数据。它只使用 Node.js 24 内置功能，包括真正的 SQLite；
不需要任何 npm 运行时或测试依赖。它不是 npm workspace，
也不与 IT 服务台共享数据或代码。

```sh
cd demos/engineering-lab
npm test
npm start
```

不需要安装步骤。锁文件记录了这个独立、零依赖的软件包。
CLI 会输出一个 JSON 数组，默认使用内存数据库；
Node 可能会在 stderr 输出 SQLite 的实验性功能警告。

完整的校验、筛选、存储与 API 行为定义，请参阅 [contract.md](contract.md)。
这个基线版本刻意**不包含代理负责人功能**。

<a id="fixture-validation"></a>
## 测试基底验证

已批准的测试套件恰好包含 **15 项测试**，没有以运行时间为判据的断言。
持久化测试会在当前工作目录下创建唯一目录，并在结束后删除，
因此请在可写的工作目录中运行测试。

在仓库根目录运行：

```sh
node --test tools/engineering-demo/tests/cases.test.mjs
node tools/engineering-demo/oracle.mjs case-1 demos/engineering-lab
node tools/engineering-demo/oracle.mjs case-2 demos/engineering-lab
node tools/engineering-demo/oracle.mjs case-3 demos/engineering-lab
```

每个诊断判定器命令都会在未修改的基线版本上通过。三个案例的覆盖内容
分别引入产品缺陷、测试预期偏移或运行时配置故障；公开的修复请求不会透露诊断答案。
应用其中任一案例，都会使真正已批准的测试套件失败。
工具测试套件包含 **12 项测试**。每次诊断成功会报告 **20 项判定器检查**；
测试预期偏移的案例仍须修复可见的测试套件，
因为独立产品判定器会正确接受未改变的产品行为。

独立的 `impact` 判定器在此基线版本上必须失败：它验证的是 `IMPACT_CONTRACT`
所定义、尚待实现的临时代理负责人功能，而不是假装功能已存在。
判定器需要可写的工作目录来创建临时数据库，完成后会自行清理，
且绝不修改应用文件。在容器中的命令是
`node /oracle/oracle.mjs CASE_ID /work`（也可用 `impact` 替换 `CASE_ID`），
其中 `/work` 与 `/oracle` 为只读，工作目录则必须可写。
stdout 只会输出最后一行 JSON 成功／失败摘要。
影响验证成功时会报告 **35 项检查**，涵盖既有契约，以及迁移、代理分配、
清除、持久化、筛选、序列化与文档定义的 API 名称。
失败时一律报告 `{"kind":"engineering-oracle","passed":false,"checks":0}`，
并以非零退出码退出，不透露断言细节。
