(() => {
  'use strict';

  const content = globalThis.SDLC_CONTENT;
  const diagrams = globalThis.SDLC_DIAGRAMS;
  if (!content || !diagrams) throw new Error('Presentation content failed to load.');

  const state = {
    language: localStorage.getItem('sdlc-language') === 'zh' ? 'zh' : 'en',
    index: 0,
    group: 'all',
  };

  const copy = {
    en: {
      edition: 'EDITORIAL EDITION', overview: 'Overview', library: 'Evidence library',
      route: 'PRESENTATION ROUTE', evidenceBase: 'EVIDENCE BASE', next: 'Next',
      sourceNotes: 'SPEAKER NOTES', speakerNote: 'Speaker note', finding: 'Finding',
      limitation: 'Limit', openSource: 'Open source', all: 'All', search: 'Search sources',
      noResults: 'No sources match this search.', download: 'Download SVG',
      source: 'Source', records: 'Evidence records',
    },
    zh: {
      edition: '编辑版', overview: '内容总览', library: '证据资料库',
      route: '演示结构', evidenceBase: '证据资料库', next: '下一页',
      sourceNotes: '讲者备注与来源', speakerNote: '讲解重点', finding: '研究发现',
      limitation: '结论边界', openSource: '打开来源', all: '全部', search: '搜索来源',
      noResults: '没有匹配的来源。', download: '下载 SVG',
      source: '来源', records: '证据记录',
    },
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const tr = (value) => {
    if (value == null) return '';
    return typeof value === 'object' && ('en' in value || 'zh' in value) ? value[state.language] : String(value);
  };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const multiline = (value) => escapeHtml(tr(value)).replace(/\n/g, '<br>');
  const sourceById = new Map(content.sources.map((source) => [source.id, source]));

  function updateStaticCopy() {
    document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
    document.title = tr(content.meta.title);
    $$('[data-copy]').forEach((element) => {
      const value = copy[state.language][element.dataset.copy];
      if (value) element.textContent = value;
    });
    $$('[data-language]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.language === state.language));
    });
    $('#library-search').placeholder = state.language === 'zh'
      ? '搜索研究发现、结论边界和来源…'
      : 'Search findings, limits, and sources…';
  }

  function slideHeader(slide) {
    const kicker = tr(slide.kicker).replace(/^(?:\d+|[A-Z]+)\s*\/\s*/, '');
    return `<header class="slide-head">
      <span class="eyebrow">${String(state.index + 1).padStart(2, '0')} / ${escapeHtml(kicker)}</span>
      <h1>${multiline(slide.title)}</h1>
      ${slide.lead ? `<p class="lead">${escapeHtml(tr(slide.lead))}</p>` : ''}
    </header>`;
  }

  function renderCards(slide, className = 'cards-grid') {
    return `<div class="${className}">${(slide.cards || []).map((card) => `
      <article class="${className === 'comparison-grid' ? 'comparison-card' : 'card'}">
        <span class="card-number">${escapeHtml(card.n)}</span>
        <h3>${escapeHtml(tr(card.title))}</h3>
        <p>${escapeHtml(tr(card.body))}</p>
      </article>`).join('')}</div>`;
  }

  function renderTable(slide) {
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr>${slide.columns.map((column) => `<th scope="col">${escapeHtml(tr(column))}</th>`).join('')}</tr></thead>
      <tbody>${slide.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(tr(cell))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }

  function renderEvidence(slide) {
    const metrics = slide.metrics || slide.cards || [];
    const details = slide.evidence || slide.rows || [];
    return `<div class="evidence-grid">
      <div class="metric-card">${metrics.map((metric) => {
        const value = metric.value ?? metric.n ?? metric.title;
        const label = metric.label ?? metric.body ?? '';
        return `<div class="metric"><strong>${escapeHtml(tr(value))}</strong><span>${escapeHtml(tr(label))}</span></div>`;
      }).join('')}</div>
      <ul class="evidence-list">${details.map((detail) => {
        if (Array.isArray(detail)) return `<li><strong>${escapeHtml(tr(detail[0]))}</strong><span>${escapeHtml(detail.slice(1).map(tr).join(' · '))}</span></li>`;
        return `<li><strong>${escapeHtml(tr(detail.title ?? detail.label ?? detail.n))}</strong><span>${escapeHtml(tr(detail.body ?? detail.value ?? ''))}</span></li>`;
      }).join('')}</ul>
    </div>`;
  }

  function renderDiagram(slide) {
    return `<div class="diagram-wrap">
      <button class="diagram-download" type="button" data-download-diagram="${escapeHtml(slide.diagram)}">${copy[state.language].download}</button>
      ${diagrams.render(slide.diagram, state.language)}
    </div>`;
  }

  function renderBody(slide) {
    switch (slide.layout) {
      case 'hero':
        return `<section class="slide hero-slide">
          ${slideHeader(slide)}
          <aside class="hero-aside">
            <div class="hero-index">01</div>
            <p>${escapeHtml(tr(slide.statement))}</p>
          </aside>
          <div class="tag-row">${(slide.tags || []).map((tag) => `<span class="tag">${escapeHtml(tr(tag))}</span>`).join('')}</div>
        </section>`;
      case 'statement':
        return `<section class="slide">${slideHeader(slide)}${renderCards(slide)}${takeaway(slide)}</section>`;
      case 'cards':
        return `<section class="slide">${slideHeader(slide)}${slide.code ? `<div class="code-chip">${escapeHtml(slide.code)}</div>` : ''}${renderCards(slide)}${takeaway(slide)}</section>`;
      case 'comparison':
        return `<section class="slide">${slideHeader(slide)}${renderCards(slide, 'comparison-grid')}${takeaway(slide)}</section>`;
      case 'table':
      case 'cost':
        return `<section class="slide">${slideHeader(slide)}${slide.code ? `<div class="code-chip">${escapeHtml(slide.code)}</div>` : ''}${renderTable(slide)}${takeaway(slide)}</section>`;
      case 'diagram':
        return `<section class="slide">${slideHeader(slide)}${renderDiagram(slide)}${takeaway(slide)}</section>`;
      case 'evidence':
        return `<section class="slide">${slideHeader(slide)}${renderEvidence(slide)}${takeaway(slide)}</section>`;
      case 'closing':
        return `<section class="slide closing-slide">
          <div class="closing-mark" aria-hidden="true">✓</div>${slideHeader(slide)}
          <p class="takeaway">${escapeHtml(tr(slide.statement))}</p>
        </section>`;
      case 'library':
        return `<section class="slide">${slideHeader(slide)}${renderCards(slide, 'library-preview')}${takeaway(slide)}</section>`;
      default:
        throw new Error(`Unsupported slide layout: ${slide.layout}`);
    }
  }

  function takeaway(slide) {
    return slide.takeaway ? `<p class="takeaway">${escapeHtml(tr(slide.takeaway))}</p>` : '';
  }

  function renderSlide({ focus = false } = {}) {
    const slide = content.slides[state.index];
    $('#slide').innerHTML = renderBody(slide);
    $('#slide-count').textContent = `${String(state.index + 1).padStart(2, '0')} / ${String(content.slides.length).padStart(2, '0')}`;
    $('#chapter-label').textContent = tr(content.chapters.find((chapter) => chapter.id === slide.chapter)?.label);
    $('#progress-bar').style.width = `${((state.index + 1) / content.slides.length) * 100}%`;
    $$('.chapter-button').forEach((button) => {
      button.setAttribute('aria-current', String(button.dataset.chapter === slide.chapter));
    });
    history.replaceState(null, '', `#${slide.id}`);
    if (focus) $('#slide').focus({ preventScroll: true });
  }

  function renderChapterNav() {
    $('#chapter-nav').innerHTML = content.chapters.map((chapter, index) => `
      <button class="chapter-button" type="button" data-chapter="${chapter.id}" aria-label="${escapeHtml(tr(chapter.label))}">
        ${String(index + 1).padStart(2, '0')}<span>${escapeHtml(tr(chapter.label))}</span>
      </button>`).join('');
  }

  function renderOverview() {
    $('#overview-grid').innerHTML = content.slides.map((slide, index) => `
      <button class="overview-item${index === state.index ? ' active' : ''}" type="button" data-slide-index="${index}">
        <small>${String(index + 1).padStart(2, '0')} · ${escapeHtml(tr(content.chapters.find((chapter) => chapter.id === slide.chapter)?.label))}</small>
        <strong>${multiline(slide.title)}</strong>
        <span>${escapeHtml(tr(slide.kicker))}</span>
      </button>`).join('');
  }

  function renderFilters() {
    const groups = [{ id: 'all', label: { en: 'All', zh: '全部' } }, ...content.groups];
    $('#library-filters').innerHTML = groups.map((group) => `
      <button type="button" data-source-group="${group.id}" aria-pressed="${group.id === state.group}">
        ${escapeHtml(tr(group.label))}
      </button>`).join('');
  }

  function sourceCard(source) {
    const href = tr(source.href);
    return `<article class="source-card">
      <span class="source-kind">${escapeHtml(tr(source.kind))}</span>
      <h3>${escapeHtml(tr(source.title))}</h3>
      <p><strong>${copy[state.language].finding}:</strong> ${escapeHtml(tr(source.finding))}</p>
      <p><strong>${copy[state.language].limitation}:</strong> ${escapeHtml(tr(source.limit))}</p>
      <a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${copy[state.language].openSource} ↗</a>
      ${source.records?.length ? `<div class="record-links">${source.records.map((record) => `<a href="${escapeHtml(record.href)}" target="_blank" rel="noreferrer">${escapeHtml(tr(record.label))}</a>`).join('')}</div>` : ''}
    </article>`;
  }

  function renderLibrary() {
    const query = $('#library-search').value.trim().toLocaleLowerCase(state.language === 'zh' ? 'zh-CN' : 'en');
    const matches = content.sources.filter((source) => {
      if (state.group !== 'all' && source.group !== state.group) return false;
      const haystack = [source.title, source.finding, source.limit, source.kind]
        .map(tr).join(' ').toLocaleLowerCase(state.language === 'zh' ? 'zh-CN' : 'en');
      return !query || haystack.includes(query);
    });
    $('#library-results').innerHTML = matches.length
      ? matches.map(sourceCard).join('')
      : `<p>${copy[state.language].noResults}</p>`;
  }

  function openSources() {
    const slide = content.slides[state.index];
    $('#drawer-title').textContent = tr(slide.title).replace(/\n/g, ' ');
    const sources = (slide.sources || []).map((id) => sourceById.get(id)).filter(Boolean);
    $('#drawer-content').innerHTML = `
      ${slide.note ? `<div class="speaker-note"><strong>${copy[state.language].speakerNote}</strong><br>${escapeHtml(tr(slide.note))}</div>` : ''}
      ${sources.map((source) => `<article class="drawer-source">
        <h3>${escapeHtml(tr(source.title))}</h3>
        <p><strong>${copy[state.language].finding}:</strong> ${escapeHtml(tr(source.finding))}</p>
        <p><strong>${copy[state.language].limitation}:</strong> ${escapeHtml(tr(source.limit))}</p>
        <a href="${escapeHtml(tr(source.href))}" target="_blank" rel="noreferrer">${copy[state.language].openSource} ↗</a>
      </article>`).join('')}
      <p class="source-status">${escapeHtml(tr(content.meta.sourceNote))}</p>`;
    $('#source-drawer').classList.add('open');
    $('#drawer-scrim').classList.add('open');
    $('#source-drawer').setAttribute('aria-hidden', 'false');
  }

  function closeSources() {
    $('#source-drawer').classList.remove('open');
    $('#drawer-scrim').classList.remove('open');
    $('#source-drawer').setAttribute('aria-hidden', 'true');
  }

  function navigate(delta) {
    state.index = Math.min(content.slides.length - 1, Math.max(0, state.index + delta));
    renderSlide({ focus: true });
  }

  function setLanguage(language) {
    state.language = language;
    localStorage.setItem('sdlc-language', language);
    updateStaticCopy();
    renderChapterNav();
    renderSlide();
    renderOverview();
    renderFilters();
    renderLibrary();
    if ($('#source-drawer').classList.contains('open')) openSources();
  }

  function downloadDiagram(name) {
    const blob = new Blob([diagrams.render(name, state.language)], { type: 'image/svg+xml;charset=utf-8' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${name}-${state.language}.svg`;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
  }

  document.addEventListener('click', (event) => {
    const languageButton = event.target.closest('[data-language]');
    if (languageButton) return setLanguage(languageButton.dataset.language);

    const chapterButton = event.target.closest('[data-chapter]');
    if (chapterButton) {
      state.index = content.slides.findIndex((slide) => slide.chapter === chapterButton.dataset.chapter);
      return renderSlide({ focus: true });
    }

    const overviewItem = event.target.closest('[data-slide-index]');
    if (overviewItem) {
      state.index = Number(overviewItem.dataset.slideIndex);
      $('#overview-dialog').close();
      return renderSlide({ focus: true });
    }

    const filter = event.target.closest('[data-source-group]');
    if (filter) {
      state.group = filter.dataset.sourceGroup;
      renderFilters();
      return renderLibrary();
    }

    const diagramButton = event.target.closest('[data-download-diagram]');
    if (diagramButton) return downloadDiagram(diagramButton.dataset.downloadDiagram);

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'home') { state.index = 0; renderSlide({ focus: true }); }
    if (action === 'previous') navigate(-1);
    if (action === 'next') navigate(1);
    if (action === 'sources') openSources();
    if (action === 'close-sources') closeSources();
    if (action === 'overview') { renderOverview(); $('#overview-dialog').showModal(); }
    if (action === 'library') { renderFilters(); renderLibrary(); $('#library-dialog').showModal(); }
  });

  $$('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  $('#library-search').addEventListener('input', renderLibrary);
  document.addEventListener('keydown', (event) => {
    if ($('dialog[open]') || event.target.matches('input')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); navigate(1); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); navigate(-1); }
    if (event.key === 'Home') { state.index = 0; renderSlide({ focus: true }); }
    if (event.key === 'End') { state.index = content.slides.length - 1; renderSlide({ focus: true }); }
    if (event.key.toLowerCase() === 's') openSources();
    if (event.key === 'Escape') closeSources();
  });

  const hashIndex = content.slides.findIndex((slide) => `#${slide.id}` === location.hash);
  if (hashIndex >= 0) state.index = hashIndex;
  updateStaticCopy();
  renderChapterNav();
  renderOverview();
  renderFilters();
  renderLibrary();
  renderSlide();
})();
