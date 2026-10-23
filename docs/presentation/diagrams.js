(() => {
  const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
  const text = (x, y, value, className = '', anchor = 'start') => `<text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}">${escape(value)}</text>`;
  const box = (x, y, w, h, title, subtitle, dark = false) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="13" class="${dark ? 'dark' : 'box'}"/>${text(x + 20, y + 32, title, dark ? 'white label' : 'label')}${subtitle ? text(x + 20, y + 58, subtitle, dark ? 'light small' : 'muted small') : ''}</g>`;
  const arrow = (x1, y1, x2, y2, dashed = false) => `<path d="M${x1} ${y1}H${x2}" class="line${dashed ? ' dashed' : ''}" marker-end="url(#arrow)"/>`;
  const labels = {
    lifecycle9: {
      en: ['End-to-end lifecycle', 'Nine stages connect value validation, delivery execution and organizational learning.', 'Intent', 'Outcome + boundary', 'Discover', 'Evidence + hypotheses', 'Specify', 'Executable spec', 'Plan', 'Tasks + dependencies', 'Build', 'Code + tests', 'Verify', 'Evaluation + evidence', 'Deploy', 'Gates + rollback', 'Operate', 'Signals + incidents', 'Learn', 'Skills + standards', 'Every stage: input contract → bounded execution → verifiable evidence → Human Gate'],
      zh: ['端到端生命周期', '九个阶段把价值验证、交付执行与组织学习连接成闭环。', 'Intent', '目标与边界', 'Discover', '证据与假设', 'Specify', '可执行规格', 'Plan', '任务与依赖', 'Build', '代码与测试', 'Verify', '评估与证据', 'Deploy', '门禁与回滚', 'Operate', '信号与事件', 'Learn', '技能与标准', '每个阶段：输入契约 → 有界执行 → 可验证证据 → Human Gate'],
    },
    'operating-model': {
      en: ['The missing middle', 'Five engineering layers connect lifecycle, maturity and tools into one runnable system.', 'Memory', 'Project Record', 'Method', 'Skills', 'Interface', 'Machine Interface', 'Control', 'Validation', 'View', 'Derived Status', 'One record · reusable method · safe mutation · evidence-derived view'],
      zh: ['缺失的中间层', '五个工程层把 lifecycle、maturity 与 tools 连接成同一个可运行系统。', 'MEMORY', 'Project Record', 'METHOD', 'Skills', 'INTERFACE', 'Machine Interface', 'CONTROL', 'Validation', 'VIEW', 'Derived Status', 'One record · reusable method · safe mutation · evidence-derived view'],
    },
    research: {
      en: ['Research architecture', 'Principles become contracts; contracts produce evidence; experiments test engineering choices.', '01 / PRINCIPLES', 'Operating model', 'Authority + contracts', '02 / OBSERVATIONS', 'Accepted delivery', 'Ownership + readiness', '03 / INVESTIGATION', 'Engineering research', 'Recovery + impact + diagnosis', 'Reusable method', 'Version-bound evidence', 'Bounded conclusions', 'Cross-cutting: orchestration · traces · workflow comparison'],
      zh: ['研究与证据架构', '从方法原则到真实交付，再用实验检验工程选择。', '01 / 方法原则', '交付运行模型', '权限边界 + 交付契约', '02 / 交付案例', '已验收交付', '责任归属 + 就绪检查', '03 / 工程实验', '工程研究', '恢复 + 影响 + 诊断', '解释为什么', '证明发生了什么', '检验工程选择', '贯穿各层：Agent 编排 · 调用轨迹 · 工作流对比'],
    },
    lifecycle: {
      en: ['The accountable delivery lifecycle', 'Seven stages with explicit approval and a feedback loop that opens new work.', 'Intent', 'Problem + outcome', 'Spec', 'Behavior + decisions', 'Plan', 'Tasks + checks', 'Build', 'Tests + code', 'Verify', 'Independent evidence', 'Deploy', 'Digest + acceptance', 'Operate', 'Observe + recover', 'Human decisions and version-specific approvals', 'Feedback → explicit new Intent / continuation', 'No silent rewrite of a frozen contract'],
      zh: ['责任清晰的交付生命周期', '七个阶段、明确批准，并把反馈转化为新的工作。', '需求意图', '问题 + 预期结果', '规格', '行为 + 决策', '计划', '任务 + 检查', '构建', '测试 + 代码', '验证', '独立证据', '部署', '产物摘要 + 验收', '运行', '观察 + 恢复', '人工决策与针对具体版本的批准', '反馈 → 新的需求意图或明确的续办流程', '不能静默改写已经冻结的契约'],
    },
    reliability: {
      en: ['Three operational loops', 'Admission, recovery and prevention have different evidence and decision boundaries.', '01 / ADMISSION', 'Reject bad candidate', 'Ready + journey checks', 'Preserve stable service', '02 / RECOVERY', 'Promote → observe', '2 failed samples → fallback', 'Verify writes survive', '03 / PREVENTION', 'Review maintenance', 'Known injected pause', 'Owner + approved new scope', '2 isolated runs', '1 fallback per run', 'Review still pending', 'Fixed policy execution ≠ autonomous AI recovery'],
      zh: ['三个运行闭环', '准入、恢复和预防，需要不同的证据与决策边界。', '01 / 准入', '拦截异常候选版本', '就绪检查 + 业务操作检查', '保护稳定服务', '02 / 恢复', '切换候选版本 → 持续观察', '连续两次采样失败 → 回退', '确认业务写入未丢失', '03 / 预防', '审查后续维护工作', '已知故障注入：暂停进程', '明确负责人 + 批准新范围', '两次隔离演练', '每次演练回退一次', '维护审查尚未完成', '执行固定策略 ≠ AI 自主决定恢复'],
    },
    patterns: {
      en: ['Four agent coordination patterns', 'Choose by dependency, then verify the observed execution structure.', 'Direct', 'Baseline; no subagent', 'Task', 'Result', 'Parallel', 'Independent branches overlap', 'Split', 'Synthesize', 'Critic–reviser', 'Challenge an existing position', 'Draft', 'Critic', 'Revise', 'Sequential', 'Later work consumes earlier output', 'Design', 'Review', 'Result', 'A', 'B'],
      zh: ['四种 Agent 协作模式', '根据任务依赖选择模式，再通过轨迹确认实际执行结构。', '直接执行', '基准模式；不使用子 Agent', '任务', '结果', '并行委派', '彼此独立的分支在时间上重叠', '拆分', '汇总', '批判—修订', '针对已有方案进行质疑和改进', '初稿', '批判', '修订', '顺序流水线', '后续步骤使用前序步骤的输出', '设计', '审查', '结果', 'A', 'B'],
    },
    evidence: {
      en: ['The evidence chain', 'Every claim must identify its source, execution, artifact, observation and authorized decision.', 'Decisions', 'Question + version', 'Contract', 'Spec / Plan hashes', 'Execution', 'Commit + run / attempt', 'Artifact', 'Immutable image digest', 'Observation', 'Journey + data checks', 'Acceptance', 'Authorized receipt', 'Provenance: source · time · SHA-256 · scope · limitations', 'A model’s summary is not a replacement for any link.'],
      zh: ['可追溯证据链', '每项结论都要关联决策、契约、执行、产物、观察与授权记录。', '决策', '问题 + 版本', '契约', '规格 / 计划哈希', '执行', '提交记录 + 运行编号', '产物', '不可变镜像摘要', '观察', '业务操作 + 数据检查', '验收', '授权记录', '来源信息：来源 · 时间 · SHA-256 · 范围 · 限制', '模型生成的总结，不能替代证据链中的任何一环。'],
    },
  };

  const renderers = {
    lifecycle9: (l) => `
      ${[0, 1, 2, 3, 4].map((i) => {
        const x = 20 + i * 194;
        return `${box(x, 50, 174, 78, l[2 + i * 2], l[3 + i * 2], i === 0)}${i < 4 ? arrow(x + 174, 89, x + 190, 89) : ''}`;
      }).join('')}
      <path d="M884 128V182H878" class="line" marker-end="url(#arrow)"/>
      ${[0, 1, 2, 3].map((i) => {
        const sourceIndex = 5 + i;
        const x = 796 - i * 194;
        return `${box(x, 184, 174, 78, l[2 + sourceIndex * 2], l[3 + sourceIndex * 2], sourceIndex === 8)}${i < 3 ? arrow(x, 223, x - 16, 223) : ''}`;
      }).join('')}
      <rect x="20" y="310" width="950" height="62" rx="12" class="band"/>
      ${text(495, 348, l[20], 'teal label', 'middle')}`,
    'operating-model': (l) => `
      ${[0, 1, 2, 3, 4].map((i) => {
        const x = 20 + i * 194;
        return `${text(x, 42, l[2 + i * 2], 'eyebrow')}
          <rect x="${x}" y="62" width="174" height="125" rx="13" class="${i === 2 ? 'dark' : 'box'}"/>
          ${text(x + 14, 98, l[3 + i * 2], i === 2 ? 'white small' : 'small')}
          ${i < 4 ? arrow(x + 174, 125, x + 190, 125) : ''}`;
      }).join('')}
      <rect x="20" y="235" width="950" height="74" rx="12" class="band"/>
      ${text(495, 279, l[12], 'teal label', 'middle')}`,
    research: (l) => `
      ${[0, 1, 2].map((i) => {
        const x = 24 + i * 326;
        return `${text(x, 48, l[2 + i * 3], 'eyebrow')}${box(x, 69, 298, 105, l[3 + i * 3], l[4 + i * 3], i === 1)}
          ${text(x + 18, 218, l[11 + i], 'muted small')}${i < 2 ? arrow(x + 298, 122, x + 322, 122) : ''}`;
      }).join('')}
      <rect x="24" y="258" width="950" height="63" rx="12" class="band"/>
      ${text(499, 297, l[14], 'label teal', 'middle')}`,
    lifecycle: (l) => `
      <rect x="24" y="20" width="952" height="42" rx="10" class="band"/>
      ${text(500, 47, l[16], 'teal small', 'middle')}
      ${[0, 1, 2, 3].map((i) => `${box(24 + i * 244, 88, 220, 82, l[2 + i * 2], l[3 + i * 2], i === 0)}${i < 3 ? arrow(244 + i * 244, 129, 264 + i * 244, 129) : ''}`).join('')}
      <path d="M866 170V215H744" class="line" marker-end="url(#arrow)"/>
      ${[0, 1, 2].map((i) => `${box(512 - i * 244, 213, 220, 82, l[10 + i * 2], l[11 + i * 2], i === 2)}${i < 2 ? arrow(512 - i * 244, 254, 492 - i * 244, 254) : ''}`).join('')}
      <path d="M134 295V329H974V339" class="line dashed"/>
      ${text(500, 369, l[17], 'teal label', 'middle')}
      ${text(500, 398, l[18], 'muted small', 'middle')}`,
    reliability: (l) => `
      ${[0, 1, 2].map((i) => {
        const x = 24 + i * 326;
        return `${text(x, 38, l[2 + i * 4], 'eyebrow')}<rect x="${x}" y="60" width="298" height="186" rx="14" class="${i === 1 ? 'dark' : 'box'}"/>
          ${text(x + 20, 98, l[3 + i * 4], i === 1 ? 'white label' : 'label')}
          ${text(x + 20, 136, l[4 + i * 4], i === 1 ? 'light small' : 'muted small')}
          ${text(x + 20, 166, l[5 + i * 4], i === 1 ? 'light small' : 'muted small')}
          ${text(x + 20, 217, l[14 + i], i === 1 ? 'mint small' : 'teal small')}
          ${i < 2 ? arrow(x + 298, 152, x + 322, 152) : ''}`;
      }).join('')}
      ${text(500, 302, l[17], 'teal label', 'middle')}`,
    patterns: (l) => {
      const node = (x, y, w, label) => `<rect x="${x}" y="${y}" width="${w}" height="38" rx="9" class="node"/>${text(x + w / 2, y + 25, label, 'small', 'middle')}`;
      return `
        ${[[24, 18, 2], [514, 18, 6], [24, 213, 10], [514, 213, 15]].map(([x, y, n]) => `<rect x="${x}" y="${y}" width="462" height="177" rx="14" class="box"/>${text(x + 20, y + 33, l[n], 'label')}${text(x + 20, y + 59, l[n + 1], 'muted small')}`).join('')}
        ${node(48, 112, 120, l[4])}${arrow(169, 131, 313, 131)}${node(316, 112, 142, l[5])}
        ${node(535, 112, 85, l[8])}${node(660, 83, 90, l[20])}${node(660, 140, 90, l[21])}${node(803, 112, 150, l[9])}
        <path d="M620 131H639V102H657M639 131V159H657M750 102H779V131H800M750 159H779V131" class="line"/>
        ${node(48, 305, 110, l[12])}${arrow(160, 324, 190, 324)}${node(194, 305, 110, l[13])}${arrow(306, 324, 336, 324)}${node(340, 305, 110, l[14])}
        ${node(538, 305, 110, l[17])}${arrow(650, 324, 680, 324)}${node(684, 305, 110, l[18])}${arrow(796, 324, 826, 324)}${node(830, 305, 110, l[19])}`;
    },
    evidence: (l) => `
      ${[0, 1, 2].map((i) => `${box(24 + i * 326, 36, 298, 88, l[2 + i * 2], l[3 + i * 2], i === 0)}${i < 2 ? arrow(322 + i * 326, 80, 346 + i * 326, 80) : ''}`).join('')}
      <path d="M825 124V159H825V178" class="line" marker-end="url(#arrow)"/>
      ${[0, 1, 2].map((i) => `${box(676 - i * 326, 182, 298, 88, l[8 + i * 2], l[9 + i * 2], i === 2)}${i < 2 ? arrow(676 - i * 326, 226, 652 - i * 326, 226) : ''}`).join('')}
      <rect x="24" y="304" width="950" height="49" rx="10" class="band"/>
      ${text(500, 335, l[14], 'teal small', 'middle')}
      ${text(500, 389, l[15], 'muted small', 'middle')}`,
  };

  globalThis.SDLC_DIAGRAMS = Object.freeze({
    names: Object.keys(labels),
    render(name, language) {
      if (!Object.hasOwn(labels, name)) throw new Error(`Unknown diagram: ${name}`);
      if (!['en', 'zh'].includes(language)) throw new Error(`Unknown diagram language: ${language}`);
      const l = labels[name][language];
      const height = name === 'research' || name === 'reliability' ? 340 : 420;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${height}" width="1000" height="${height}" role="img" aria-labelledby="title desc" lang="${language === 'zh' ? 'zh-CN' : 'en'}">
        <title id="title">${escape(l[0])}</title><desc id="desc">${escape(l[1])}</desc>
        <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#167d79"/></marker></defs>
        <style>
          text{font-family:Inter,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;fill:#142d39;font-size:19px}
          .label{font-size:22px;font-weight:650}.small{font-size:17px}.eyebrow{font-size:15px;fill:#167d79;letter-spacing:1px;font-weight:650}
          .box{fill:#fff;stroke:#d7e2de;stroke-width:1.4}.dark{fill:#142d39}.band,.node{fill:#edf5f1}
          .node{stroke:#c3dad3}.line{fill:none;stroke:#167d79;stroke-width:2}.dashed{stroke-dasharray:6 5}
          .muted{fill:#546b73}.white{fill:#fff}.light{fill:#c4d6d8}.teal{fill:#167d79}.mint{fill:#94e3cc}
        </style><rect width="1000" height="${height}" fill="#f7f8f4"/>${renderers[name](l)}</svg>`;
    },
  });
})();
