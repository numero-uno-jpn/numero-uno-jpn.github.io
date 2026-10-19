/* cfDNA integrity の系譜ページ。データは lineage.js (window.LINEAGE) から読む。 */
(function () {
  'use strict';
  const D = window.LINEAGE;
  const nodes = D.nodes;
  const css = (v) => getComputedStyle(document.querySelector('.viz-root')).getPropertyValue(v).trim();

  /* ---------- 語彙の日本語表記 ---------- */
  const LINEAGE_JA = {
    integrity_core: '血中 DNA の長さ (integrity) を測った研究', review: '総説・メタ解析', fragmentomics: '断片長の網羅解析 (fragmentomics)',
    cfdna_quant: '血中 DNA の量などを測った研究', method_preanalytic: '測定前の条件・方法の研究',
  };
  const CANCER_JA = {
    breast: '乳がん', colorectal: '大腸がん', lung: '肺がん', prostate: '前立腺がん', liver: '肝がん', pancreas: '膵がん',
    gastric: '胃がん', esophagus: '食道がん', ovary: '卵巣がん', cervix: '子宮頸がん', endometrium: '子宮体がん',
    head_neck: '頭頸部がん', thyroid: '甲状腺がん', melanoma: '悪性黒色腫', bladder_urothelial: '膀胱・尿路上皮がん',
    kidney: '腎がん', hematologic: '血液がん', brain: '脳腫瘍', biliary: '胆道・乳頭部がん', testis: '精巣腫瘍',
    sarcoma: '肉腫', pediatric: '小児がん', multiple: '複数のがん', other_cancer: 'その他のがん',
  };
  const PURPOSE_JA = {
    diagnosis: '診断', screening: 'スクリーニング', prognosis: '予後', treatment_response: '治療効果',
    monitoring_recurrence: '再発の監視', preanalytic_method: '測定前条件・方法', biology_mechanism: '生物学・機序',
  };
  const TARGET_JA = { ALU: 'ALU', LINE1: 'LINE-1', ACTB: 'β-actin', GAPDH: 'GAPDH', mtDNA: 'ミトコンドリア DNA', other_gene: 'その他の遺伝子', genome_wide: 'ゲノム全体' };
  const SPEC_JA = { serum: '血清', plasma: '血漿', urine: '尿', csf: '髄液', saliva: '唾液', effusion: '胸水・腹水', stool: '便', tissue: '組織', other: 'その他' };
  const FIND_JA = { positive: '有用', mixed: '条件付き・一部', negative: '否定的', na: '評価対象外' };
  const SEED_JA = { '16723681': 'Clin Chem 2006', '16963729': 'J Clin Oncol 2006', '17108224': 'Ann N Y Acad Sci 2006' };

  /* 種別 → 色と形 (色が判別できなくても形で区別できるように) */
  const KIND = {
    integrity_core: { color: '--series-1', shape: 'circle' },
    review: { color: '--series-2', shape: 'square' },
    fragmentomics: { color: '--series-3', shape: 'triangle' },
    cfdna_quant: { color: '--neutral-mark', shape: 'circle' },
    method_preanalytic: { color: '--neutral-mark', shape: 'circle' },
  };
  const symbolOf = (s) => ({ circle: d3.symbolCircle, square: d3.symbolSquare, triangle: d3.symbolTriangle }[s]);
  const pubmed = (n) => n.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${n.pmid}/` : (n.doi ? `https://doi.org/${n.doi}` : null);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 冒頭の数字 ---------- */
  const core = nodes.filter((n) => n.lineage === 'integrity_core');
  const sr = nodes.filter((n) => n.review_type === 'systematic' || n.review_type === 'meta-analysis');
  const directN = Object.values(D.trends.direct_citations).reduce((a, b) => a + b, 0);
  const cancerKinds = new Set(core.flatMap((n) => n.cancers).filter((c) => c !== 'multiple' && c !== 'other_cancer'));
  const stats = [
    [directN, '梅谷の 3 論文を引用した論文'],
    [core.length, '後続研究のうち、血中 DNA の長さ (integrity) を実際に測った研究'],
    [core.filter((n) => n.alu).length, 'うち ALU247/115 (同等の ALU 比を含む) を使用'],
    [sr.length, 'システマティックレビュー・メタ解析'],
    [cancerKinds.size + ' 種', '研究されたがん種'],
  ];
  document.getElementById('stats').innerHTML = stats.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  document.getElementById('coreN').textContent = core.length;
  document.getElementById('nDirect').textContent = directN;

  /* ---------- 年表 ---------- */
  const byPmid = Object.fromEntries(nodes.map((n) => [n.pmid, n]));
  const L = Object.fromEntries(D.fragmentomics_landmarks.map((n) => [n.pmid, n]));
  const ref = (pmid, label) => {
    const n = byPmid[pmid] || L[pmid] || D.anchors.seeds.find((s) => s.pmid === pmid) || D.anchors.prior.find((s) => s.pmid === pmid);
    const cb = n && n.cited_by != null ? `、被引用 ${n.cited_by}` : '';
    return `<a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}/" target="_blank" rel="noopener">${esc(label)}</a>${cb}`;
  };
  const TL = [
    { y: 2003, parallel: true, t: '同時期に進んでいた 2 つの研究: Wang らが先に公表', p: '血中 DNA の長い断片の割合 (integrity) をがんの指標にするというアイデアは、梅谷らと Johns Hopkins の Wang らが、それぞれ独自に研究を進めていた。論文の公表は Wang らが先で、血漿 DNA を real-time PCR で測定し、がん患者で integrity が高いことを報告した。', r: [['12873992', 'Wang BG, Cancer Res 2003']] },
    { y: 2006, seed: true, t: '梅谷らの報告: より高感度で安価な測定法', p: '血清を DNA 精製なしにそのまま鋳型とし、ALU 反復配列の長短 2 種類のアンプリコン (247 bp / 115 bp) を qPCR で測る方法を報告した。検出限界は 0.01 pg と超高感度で、精製を省くことで技術的な誤差と試薬・労力のコストを減らし、多数の検体を速く処理できる。大腸癌・十二指腸乳頭部癌での上昇、乳癌の進行度との相関を示し、血清で測ってよい根拠も示した。この ALU247/115 は、後続研究で最も広く使われる測定法になった (このページの集計で、長さを測った後続研究の約半数)。', r: [['16723681', 'Clin Chem 2006'], ['16963729', 'J Clin Oncol 2006'], ['17108224', 'Ann N Y Acad Sci 2006']] },
    { y: 2007, t: '各がん種への広がり', p: '頭頸部がん、前立腺がん、膀胱がん、精巣腫瘍、胃がんなどで、integrity や長短断片比を測る研究が相次いだ。', r: [['16991120', 'Jiang WW, Int J Cancer 2006'], ['17764114', 'Ellinger J, Int J Cancer 2007']] },
    { y: 2011, t: '腫瘍由来の DNA はむしろ短い', p: '大腸がんのマウスモデルと患者の血漿で、腫瘍由来の DNA が高度に断片化していることが示された。integrity の上昇・低下の解釈が見直され、「長さ」そのものへの関心が高まった。', r: [['20494973', 'Thierry AR, Nucleic Acids Res 2010'], ['21909401', 'Mouliere F, PLoS One 2011']] },
    { y: 2014, t: 'ALU・LINE-1 による乳がんの診断・予後', p: '原発・転移乳がんで ALU と LINE-1 を使った integrity が診断と予後予測に有用と報告された。', r: [['24838941', 'Madhavan D, Breast Cancer Res Treat 2014']] },
    { y: 2017, t: 'メタ解析による検証', p: '25 論文 40 研究のメタ解析で、integrity の診断能は比較的高い一方、上昇・低下の報告が混在すると指摘された。', r: [['28830871', 'Cheng J, Cancer Epidemiol Biomarkers Prev 2017']] },
    { y: 2018, t: 'fragmentomics の時代へ', p: '断片長をシーケンスで網羅的に解析する手法が登場し、Nature・Science 系の主要誌に展開した。これらの代表的論文も起点の論文を引用している。', r: [['30404863', 'Mouliere F, Sci Transl Med 2018'], ['31142840', 'Cristiano S, Nature 2019 (DELFI)'], ['33833097', 'Lo YMD, Science 2021']] },
    { y: 2024, t: 'ALU 系 integrity のメタ解析', p: '大腸がんの ALU 系 cfDNA 17 研究で診断の統合 AUC 0.92、がん診断の integrity 46 研究で統合 AUC 0.84 と報告された。', r: [['35251637', 'Shaban SA, Mol Clin Oncol 2022'], ['39169935', 'Taghizadeh-Teymorloei M, Front Oncol 2024'], ['39061602', 'Rodríguez-Ces AM, Diagnostics 2024']] },
  ];
  document.getElementById('timeline').innerHTML = TL.map((e) => `<li class="${e.seed ? 'seed' : e.parallel ? 'parallel' : ''}"><span class="yr">${e.y}</span><h3>${esc(e.t)}</h3><p>${esc(e.p)}</p><p class="refs">${e.r.map(([p, l]) => ref(p, l)).join(' / ')}</p></li>`).join('');

  /* ---------- 凡例 ---------- */
  function legendHTML(items) {
    return items.map(([label, color, shape]) => {
      const path = d3.symbol(symbolOf(shape), 80)();
      return `<span><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><path d="${path}" fill="${css(color)}"/></svg>${esc(label)}</span>`;
    }).join('');
  }
  const mapLegendItems = [
    ['血中 DNA の長さ (integrity) を測った研究', '--series-1', 'circle'], ['総説・メタ解析', '--series-2', 'square'],
    ['断片長の網羅解析 (fragmentomics)', '--series-3', 'triangle'], ['血中 DNA の量などを測った研究・方法の研究', '--neutral-mark', 'circle'], ['梅谷の 3 論文 (2006)', '--seed', 'circle'],
  ];

  /* ---------- ツールチップ ---------- */
  const tip = document.getElementById('tooltip');
  function showTip(ev, html) {
    tip.innerHTML = html; tip.hidden = false;
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + w > innerWidth - 8) x = ev.clientX - w - pad;
    if (y + h > innerHeight - 8) y = ev.clientY - h - pad;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------- 系譜マップ ---------- */
  const W = 1040, H = 980, CX = W / 2, CY = H / 2, R0 = 70, R1 = 370, Y0 = 2006, Y1 = 2026;
  const rOf = (y) => R0 + ((Math.min(Math.max(y, Y0), Y1) - Y0) / (Y1 - Y0)) * (R1 - R0);
  const svg = d3.select('#mapSvg').attr('viewBox', `0 0 ${W} ${H}`);
  const gBg = svg.append('g'), gSec = svg.append('g'), gNodes = svg.append('g'), gCenter = svg.append('g');
  const sizeOf = (n) => Math.max(18, Math.min(420, 18 + Math.sqrt(n.cited_by || 0) * 14));

  [2006, 2010, 2015, 2020, 2025].forEach((y) => {
    gBg.append('circle').attr('class', 'ring').attr('cx', CX).attr('cy', CY).attr('r', rOf(y));
    gBg.append('text').attr('class', 'ring-label').attr('x', CX + 4).attr('y', CY - rOf(y) - 3).text(y);
  });

  const PURPOSE_ORDER = ['diagnosis', 'screening', 'prognosis', 'treatment_response', 'monitoring_recurrence', 'preanalytic_method', 'biology_mechanism'];
  const TARGET_ORDER = ['ALU', 'LINE1', 'ACTB', 'GAPDH', 'mtDNA', 'other_gene', 'genome_wide'];
  function groupKey(n, mode) {
    if (mode === 'cancer') {
      const cs = n.cancers.filter((c) => c !== 'multiple' && c !== 'other_cancer');
      if (cs.length > 1 || n.cancers.includes('multiple')) return 'multiple';
      if (cs.length === 1) return cs[0];
      if (n.cancers.includes('other_cancer')) return 'other_cancer';
      return n.non_cancer ? '_noncancer' : '_none';
    }
    if (mode === 'purpose') return PURPOSE_ORDER.find((p) => n.purposes.includes(p)) || '_none';
    return TARGET_ORDER.find((t) => n.targets.includes(t)) || '_none';
  }
  function groupLabel(k, mode) {
    if (k === '_none') return mode === 'target' ? '記載なし' : (mode === 'cancer' ? 'がん種の指定なし' : 'その他');
    if (k === '_noncancer') return 'がん以外';
    if (k === '_small') return 'その他のがん種';
    return (mode === 'cancer' ? CANCER_JA : mode === 'purpose' ? PURPOSE_JA : TARGET_JA)[k] || k;
  }

  let selected = null;
  function visibleFilter(n, which) {
    if (which === 'core') return n.lineage === 'integrity_core';
    if (which === 'alu') return n.alu;
    if (which === 'review') return n.lineage === 'review';
    return true;
  }

  function layout(mode, which) {
    const vis = nodes.filter((n) => visibleFilter(n, which));
    const counts = d3.rollup(vis, (v) => v.length, (n) => groupKey(n, mode));
    // 小さすぎる枝はまとめる (がん種モード)
    let keys = [...counts.keys()];
    const small = mode === 'cancer' ? keys.filter((k) => !k.startsWith('_') && k !== 'multiple' && counts.get(k) < 4) : [];
    const keyOf = (n) => { const k = groupKey(n, mode); return small.includes(k) ? '_small' : k; };
    const grouped = d3.group(vis, keyOf);
    keys = [...grouped.keys()].sort((a, b) => {
      const sa = a.startsWith('_') ? 1 : 0, sb = b.startsWith('_') ? 1 : 0;
      return sa - sb || grouped.get(b).length - grouped.get(a).length;
    });
    const gap = 0.025, total = 2 * Math.PI - gap * keys.length;
    const weights = keys.map((k) => Math.max(Math.sqrt(grouped.get(k).length), 1.6));
    const wsum = d3.sum(weights);
    let a = -Math.PI / 2;
    const sectors = keys.map((k, i) => { const span = total * weights[i] / wsum; const s = { key: k, a0: a, a1: a + span, n: grouped.get(k).length }; a += span + gap; return s; });
    const pos = new Map();
    sectors.forEach((s) => {
      const byYear = d3.group(grouped.get(s.key), (n) => n.year);
      byYear.forEach((list, y) => {
        list.sort((p, q) => (q.cited_by || 0) - (p.cited_by || 0));
        const r = rOf(y);
        const arcLen = (s.a1 - s.a0) * r;
        const perRow = Math.max(1, Math.floor(arcLen / 13));
        list.forEach((n, i) => {
          const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, list.length - row * perRow);
          const t = (col + 0.5) / inRow;
          const ang = s.a0 + (s.a1 - s.a0) * (0.06 + 0.88 * t);
          const rr = r + (row % 2 ? 1 : -1) * Math.ceil(row / 2) * 7;
          pos.set(n.id, [CX + rr * Math.cos(ang), CY + rr * Math.sin(ang)]);
        });
      });
    });
    return { vis, sectors, pos };
  }

  function drawSectors(sectors, mode) {
    const sel = gSec.selectAll('g.sector').data(sectors, (d) => d.key);
    sel.exit().remove();
    const enter = sel.enter().append('g').attr('class', 'sector');
    enter.append('line').attr('class', 'sector-line');
    enter.append('text').attr('class', 'sector-label');
    enter.append('text').attr('class', 'sector-count');
    const all = enter.merge(sel);
    all.select('line').attr('x1', (d) => CX + R0 * Math.cos(d.a0 - 0.0125)).attr('y1', (d) => CY + R0 * Math.sin(d.a0 - 0.0125))
      .attr('x2', (d) => CX + (R1 + 10) * Math.cos(d.a0 - 0.0125)).attr('y2', (d) => CY + (R1 + 10) * Math.sin(d.a0 - 0.0125));
    const lab = (d, dr) => { const m = (d.a0 + d.a1) / 2, r = R1 + 24 + dr; return [CX + r * Math.cos(m), CY + r * Math.sin(m), m]; };
    all.select('.sector-label').each(function (d) {
      const [x, y, m] = lab(d, 0);
      d3.select(this).attr('x', x).attr('y', y).attr('text-anchor', Math.cos(m) > 0.25 ? 'start' : Math.cos(m) < -0.25 ? 'end' : 'middle')
        .attr('dominant-baseline', 'middle').text(groupLabel(d.key, mode));
    });
    all.select('.sector-count').each(function (d) {
      const [x, y, m] = lab(d, 0);
      d3.select(this).attr('x', x).attr('y', y + 14).attr('text-anchor', Math.cos(m) > 0.25 ? 'start' : Math.cos(m) < -0.25 ? 'end' : 'middle')
        .attr('dominant-baseline', 'middle').text(d.n + ' 本');
    });
  }

  function renderMap() {
    const mode = document.getElementById('groupBy').value, which = document.getElementById('showWhich').value;
    const { vis, sectors, pos } = layout(mode, which);
    drawSectors(sectors, mode);
    document.getElementById('mapCount').textContent = `${vis.length} 本を表示`;
    const sel = gNodes.selectAll('path.node').data(vis, (d) => d.id);
    sel.exit().transition().duration(300).style('opacity', 0).remove();
    const enter = sel.enter().append('path').attr('class', 'node')
      .attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', (d) => `${d.year} ${d.title}`)
      .attr('d', (d) => d3.symbol(symbolOf(KIND[d.lineage].shape), sizeOf(d))())
      .attr('fill', (d) => css(KIND[d.lineage].color))
      .attr('transform', `translate(${CX},${CY})`).style('opacity', 0)
      .on('mousemove', (ev, d) => showTip(ev, `<b>${esc(d.title)}</b><div class="tt-meta">${d.year} ・ ${esc(d.journal || '')} ・ ${esc(LINEAGE_JA[d.lineage])}${d.cited_by != null ? ' ・ 被引用 ' + d.cited_by : ''}</div>`))
      .on('mouseleave', hideTip)
      .on('click', (ev, d) => select(d))
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(d); } });
    enter.merge(sel).transition().duration(600)
      .attr('transform', (d) => { const p = pos.get(d.id); return `translate(${p[0]},${p[1]})`; }).style('opacity', 0.9);
    gNodes.selectAll('path.node').classed('active', (d) => selected && d.id === selected.id);
  }

  // 中心: 起点の 3 論文と先行研究
  (function drawCenter() {
    gCenter.append('circle').attr('cx', CX).attr('cy', CY).attr('r', R0 - 12).attr('fill', 'none').attr('stroke', 'var(--border)');
    D.anchors.seeds.forEach((s, i) => {
      const ang = -Math.PI / 2 + i * (2 * Math.PI / 3), r = 26;
      const x = CX + r * Math.cos(ang), y = CY + r * Math.sin(ang);
      gCenter.append('circle').attr('class', 'seed-node node').attr('cx', x).attr('cy', y).attr('r', 7 + Math.sqrt(s.cited_by || 0) / 3)
        .attr('tabindex', 0).attr('role', 'button').attr('aria-label', s.title)
        .on('mousemove', (ev) => showTip(ev, `<b>${esc(s.title)}</b><div class="tt-meta">Umetani N ・ ${esc(SEED_JA[s.pmid])} ・ 被引用 ${s.cited_by}</div>`))
        .on('mouseleave', hideTip)
        .on('click', () => selectSeed(s));
    });
    gCenter.append('text').attr('class', 'seed-label').attr('x', CX).attr('y', CY + 58).attr('text-anchor', 'middle').text('梅谷の 3 論文 (2006)');
  })();

  function select(d) {
    selected = d;
    gNodes.selectAll('path.node').classed('active', (n) => n.id === d.id);
    const tags = [
      ...d.cancers.map((c) => CANCER_JA[c] || c), d.non_cancer, ...d.specimen.map((s) => SPEC_JA[s] || s),
      ...d.targets.map((t) => TARGET_JA[t] || t), ...d.purposes.map((p) => PURPOSE_JA[p] || p),
      d.alu ? 'ALU247/115' : null, d.finding && d.finding !== 'na' ? '結論: ' + FIND_JA[d.finding] : null,
      d.n ? `対象 ${d.n} 例` : null,
    ].filter(Boolean);
    const cites = d.cites.length ? `梅谷の論文のうち ${d.cites.map((p) => SEED_JA[p]).join('、')} を引用` : '梅谷の論文を直接は引用していない (キーワード検索で収集)';
    const link = pubmed(d);
    document.getElementById('detail').innerHTML = `
      <h3>${esc(d.title)}</h3>
      <p class="meta">${esc(d.first_author || '')}${d.n_authors > 1 ? ' ほか' : ''} ・ ${esc(d.journal || '')} ${d.year}<br>${esc(LINEAGE_JA[d.lineage])}${d.review_type ? ' (' + ({ narrative: '総説', systematic: 'システマティックレビュー', 'meta-analysis': 'メタ解析' }[d.review_type]) + ')' : ''}${d.cited_by != null ? ' ・ 被引用 ' + d.cited_by : ''}</p>
      <p>${esc(d.summary_ja || '')}</p>
      <div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <p class="meta">${esc(cites)}</p>
      ${link ? `<p><a href="${link}" target="_blank" rel="noopener">${d.pmid ? 'PubMed で見る' : '論文を見る'}</a></p>` : ''}`;
  }
  function selectSeed(s) {
    selected = null;
    gNodes.selectAll('path.node').classed('active', false);
    document.getElementById('detail').innerHTML = `
      <h3>${esc(s.title)}</h3>
      <p class="meta">Umetani N ほか ・ ${esc(SEED_JA[s.pmid])} ・ 被引用 ${s.cited_by}</p>
      <p>${esc(s.role_ja)}</p>
      <p><a href="https://pubmed.ncbi.nlm.nih.gov/${s.pmid}/" target="_blank" rel="noopener">PubMed で見る</a></p>`;
  }

  document.getElementById('mapLegend').innerHTML = legendHTML(mapLegendItems);
  document.getElementById('groupBy').addEventListener('change', renderMap);
  document.getElementById('showWhich').addEventListener('change', renderMap);
  renderMap();

  /* ---------- 年次推移 ---------- */
  (function trend() {
    const series = [
      { key: 'direct_citations', label: '梅谷の 3 論文を引用した論文', short: '3 論文を引用', color: '--text-secondary' },
      { key: 'integrity_core', label: '血中 DNA の長さ (integrity) を測った研究', short: '長さを測った研究', color: '--series-1' },
      { key: 'fragmentomics_pubmed', label: '断片長の網羅解析 (fragmentomics、PubMed の検索による)', short: 'fragmentomics', color: '--series-3' },
    ];
    const years = d3.range(2006, 2027);
    const data = series.map((s) => ({ ...s, values: years.map((y) => ({ y, v: D.trends[s.key][y] || 0 })) }));
    document.getElementById('trendLegend').innerHTML = legendHTML(series.map((s) => [s.label, s.color, 'circle']));
    const el = document.getElementById('trendChart');
    const w = 1000, h = 340, m = { t: 16, r: 170, b: 28, l: 40 };
    const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('role', 'img').attr('aria-label', '年ごとの論文数の推移');
    const x = d3.scaleLinear().domain([2006, 2026]).range([m.l, w - m.r]);
    const yMax = d3.max(data, (d) => d3.max(d.values, (v) => v.v));
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([h - m.b, m.t]);
    s.append('g').attr('class', 'gridline').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w - m.l - m.r)).tickFormat(''));
    s.append('g').attr('class', 'axis').attr('transform', `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(10).tickFormat(d3.format('d')));
    s.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
    const line = d3.line().x((d) => x(d.y)).y((d) => y(d.v));
    data.forEach((d) => {
      s.append('path').attr('class', 'line').attr('d', line(d.values)).attr('stroke', css(d.color));
      const last = d.values[d.values.length - 1];
      s.append('text').attr('class', 'direct-label').attr('x', x(last.y) + 8).attr('y', y(last.v)).attr('dominant-baseline', 'middle').text(`${d.short} ${last.v}`);
    });
    // 直接ラベルの重なりをずらす
    const labels = s.selectAll('.direct-label').nodes().sort((a, b) => +a.getAttribute('y') - +b.getAttribute('y'));
    for (let i = 1; i < labels.length; i++) {
      const prev = +labels[i - 1].getAttribute('y'), cur = +labels[i].getAttribute('y');
      if (cur - prev < 15) labels[i].setAttribute('y', prev + 15);
    }
    const cross = s.append('line').attr('class', 'crosshair').attr('y1', m.t).attr('y2', h - m.b).style('display', 'none');
    const dots = data.map((d) => s.append('circle').attr('r', 4).attr('fill', css(d.color)).attr('stroke', 'var(--surface-1)').attr('stroke-width', 2).style('display', 'none'));
    s.append('rect').attr('x', m.l).attr('y', m.t).attr('width', w - m.l - m.r).attr('height', h - m.t - m.b).attr('fill', 'transparent')
      .on('mousemove', function (ev) {
        const [mx] = d3.pointer(ev, this); const yr = Math.round(x.invert(mx));
        cross.style('display', null).attr('x1', x(yr)).attr('x2', x(yr));
        data.forEach((d, i) => { const v = d.values.find((p) => p.y === yr).v; dots[i].style('display', null).attr('cx', x(yr)).attr('cy', y(v)); });
        showTip(ev, `<b>${yr} 年</b><br>${data.map((d) => `${esc(d.label)}: ${d.values.find((p) => p.y === yr).v}`).join('<br>')}`);
      })
      .on('mouseleave', () => { cross.style('display', 'none'); dots.forEach((c) => c.style('display', 'none')); hideTip(); });
  })();

  /* ---------- 内訳 ---------- */
  (function bars() {
    const count = (arrOf, ja, top) => {
      const c = d3.rollups(core.flatMap(arrOf).filter(Boolean), (v) => v.length, (k) => k).sort((a, b) => b[1] - a[1]);
      return c.slice(0, top).map(([k, v]) => [ja ? (ja[k] || k) : k, v]);
    };
    const COUNTRY = { DE: 'ドイツ', CN: '中国', IT: 'イタリア', JP: '日本', EG: 'エジプト', US: '米国', FR: 'フランス', IN: 'インド', TR: 'トルコ', GB: '英国', GR: 'ギリシャ', BR: 'ブラジル', AU: 'オーストラリア', NL: 'オランダ', RU: 'ロシア', ES: 'スペイン', KR: '韓国', AT: 'オーストリア', CH: 'スイス', IR: 'イラン', PL: 'ポーランド', CZ: 'チェコ', BE: 'ベルギー', CA: 'カナダ', DK: 'デンマーク', HK: '香港', TW: '台湾', MX: 'メキシコ' };
    const cards = [
      ['がん種', count((n) => n.cancers.filter((c) => c !== 'multiple'), CANCER_JA, 12)],
      ['検体', count((n) => n.specimen, SPEC_JA, 8)],
      ['測定対象', count((n) => n.targets, TARGET_JA, 8)],
      ['目的', count((n) => n.purposes, PURPOSE_JA, 8)],
      ['結論 (抄録による)', count((n) => [n.finding], FIND_JA, 4)],
      ['国 (著者の所属)', count((n) => n.countries, COUNTRY, 12)],
    ];
    document.getElementById('bars').innerHTML = cards.map(([title, rows]) => {
      const max = d3.max(rows, (r) => r[1]) || 1;
      return `<div class="bar-card"><h3>${title}</h3>${rows.map(([k, v]) => `<div class="bar-row" title="${esc(k)}: ${v} 本"><span class="lbl">${esc(k)}</span><span class="track"><span class="fill" style="display:block;width:${(v / max * 100).toFixed(1)}%"></span></span><span class="val">${v}</span></div>`).join('')}</div>`;
    }).join('');
  })();

  /* ---------- 文献一覧 ---------- */
  (function table() {
    const fL = document.getElementById('fLineage'), fC = document.getElementById('fCancer'), q = document.getElementById('q');
    Object.entries(LINEAGE_JA).forEach(([k, v]) => fL.insertAdjacentHTML('beforeend', `<option value="${k}">${v}</option>`));
    const cs = [...new Set(nodes.flatMap((n) => n.cancers))].sort((a, b) => (CANCER_JA[a] || a).localeCompare(CANCER_JA[b] || b, 'ja'));
    cs.forEach((c) => fC.insertAdjacentHTML('beforeend', `<option value="${c}">${CANCER_JA[c] || c}</option>`));
    const tbody = document.querySelector('#table tbody');
    const fS = document.getElementById('fSort');
    const SORTS = {
      cited: (a, b) => ((b.cited_by || 0) - (a.cited_by || 0)) || (b.year - a.year),
      new: (a, b) => (b.year - a.year) || ((b.cited_by || 0) - (a.cited_by || 0)),
      old: (a, b) => (a.year - b.year) || ((b.cited_by || 0) - (a.cited_by || 0)),
    };
    function render() {
      const s = q.value.trim().toLowerCase();
      const list = [...nodes].sort(SORTS[fS.value]).filter((n) => (!fL.value || n.lineage === fL.value) && (!fC.value || n.cancers.includes(fC.value)) &&
        (!s || [n.title, n.first_author, n.summary_ja, n.journal].join(' ').toLowerCase().includes(s)));
      document.getElementById('listCount').textContent = `${list.length} 本`;
      tbody.innerHTML = list.map((n) => {
        const k = KIND[n.lineage], link = pubmed(n);
        const sym = d3.symbol(symbolOf(k.shape), 60)();
        return `<tr><td>${n.year}</td><td><span class="badge"><svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true"><path d="${sym}" fill="${css(k.color)}"/></svg>${esc(LINEAGE_JA[n.lineage])}</span></td>
          <td>${link ? `<a href="${link}" target="_blank" rel="noopener">${esc(n.title)}</a>` : esc(n.title)}<span class="sum">${esc(n.first_author || '')} ・ ${esc(n.journal || '')}</span><span class="sum">${esc(n.summary_ja || '')}</span></td>
          <td>${esc(n.cancers.map((c) => CANCER_JA[c] || c).join('、') || (n.non_cancer || ''))}</td><td class="num">${n.cited_by ?? ''}</td></tr>`;
      }).join('');
    }
    [fL, fC, fS].forEach((e) => e.addEventListener('change', render));
    q.addEventListener('input', render);
    render();
  })();
})();
