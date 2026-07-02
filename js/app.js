// ── Tab metadata ──────────────────────────────────────────────────────────────
const TAB_META = {
  fileimport:    { title:'File Import',                          sub:'Upload .fasta .fa .fna .gb .gbk files', badge:'Import' },
  batch:         { title:'Batch Analysis',                       sub:'Run multiple analyses across all imported sequences at once', badge:'Batch' },
  gc:            { title:'GC Content & Nucleotide Composition',  sub:'Base frequencies, GC ratio, colored sequence', badge:'DNA / RNA' },
  translate:     { title:'Translation',                          sub:'Translate DNA in all 3 forward reading frames', badge:'DNA → Protein' },
  orf:           { title:'ORF Finder',                           sub:'Detect all open reading frames across 6 frames', badge:'ORF' },
  codonusage:    { title:'Codon Usage Analysis',                 sub:'Frequency table and chart of all 64 codons', badge:'Codons' },
  motif:         { title:'Motif Search',                         sub:'Exact and IUPAC degenerate pattern matching', badge:'Pattern' },
  restriction:   { title:'Restriction Site Mapping',             sub:'30 enzymes — linear map, cut table, non-cutters', badge:'Cloning' },
  protprop:      { title:'Protein Properties',                   sub:'MW, pI, hydrophobicity, amino acid composition', badge:'Protein' },
  mutation:      { title:'Mutation Simulator',                   sub:'Substitution, insertion, deletion with effect classification', badge:'Variation' },
  snp:           { title:'SNP Visualizer',                       sub:'Highlight variants, Ti/Tv ratio, density chart', badge:'SNP' },
  genomebrowser: { title:'Genome Browser',                       sub:'Zoom, scroll, annotate — mini genome browser', badge:'Browser' },
  align:         { title:'Pairwise Alignment',                   sub:'Needleman-Wunsch global alignment with scoring', badge:'Comparative' },
  dotplot:       { title:'Dot Plot',                             sub:'Sliding-window sequence similarity matrix', badge:'Comparative' },
  phylo:         { title:'Phylogenetic Tree',                    sub:'Neighbor-joining tree, Jukes-Cantor, pure SVG', badge:'Phylogenetics' },
  revcomp:       { title:'Reverse Complement',                   sub:'Antisense strand, double-stranded view, Tm', badge:'DNA' },
  about:         { title:'About & How to Use',                   sub:'Quick start guide, tool reference, privacy info', badge:'Help' },
};

function getPanel(id) {
  const map = {
    fileimport: fileimportPanel, batch: batchPanel, gc: gcPanel, translate: translatePanel,
    orf: orfPanel, codonusage: codonusagePanel, motif: motifPanel,
    restriction: restrictionPanel, protprop: protpropPanel,
    mutation: mutationPanel, snp: snpPanel, genomebrowser: genomebrowserPanel,
    align: alignPanel, dotplot: dotplotPanel, phylo: phyloPanel, revcomp: revcompPanel,
    about: aboutPanel,
  };
  return map[id];
}

window._charts   = {};
window.sharedSeqs = [];
window._activeTab = 'gc';

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(id) {
  if (!TAB_META[id]) return;
  window._activeTab = id;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const btn = document.querySelector(`.nav-item[data-tab="${id}"]`);
  if (btn) btn.classList.add('active');

  const m = TAB_META[id];
  document.getElementById('tab-title').textContent = m.title;
  document.getElementById('tab-sub').textContent   = m.sub;
  document.getElementById('tab-badge').textContent = m.badge;

  const fn = getPanel(id);
  if (!fn) { showToast('Panel not found: ' + id, 'error'); return; }

  // Destroy old charts
  Object.values(window._charts).forEach(c => { try { c.destroy(); } catch(e){} });
  window._charts = {};

  document.getElementById('content-area').innerHTML = fn();

  // Update URL without reload
  try { history.replaceState({}, '', '?tool=' + id); } catch(e){}

  // Close mobile sidebar
  closeSidebar();
}

// ── Boot ───────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  // Nav clicks
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Theme
  const saved = localStorage.getItem('bioviz-theme') || 'light';
  if (saved === 'dark') document.documentElement.setAttribute('data-theme','dark');
  updateThemeBtn();

  // URL param
  const urlTool = new URLSearchParams(location.search).get('tool');
  switchTab(urlTool && TAB_META[urlTool] ? urlTool : 'gc');
});

// ── Theme ─────────────────────────────────────────────────────────────────────
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('bioviz-theme', isDark ? 'light' : 'dark');
  updateThemeBtn();
}
function updateThemeBtn() {
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.innerHTML = isDark ? '<i class="ti ti-sun"></i>' : '<i class="ti ti-moon"></i>';
}

// ── Mobile sidebar ─────────────────────────────────────────────────────────────
function openSidebar()  {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── Tool search ───────────────────────────────────────────────────────────────
function filterTools(q) {
  const query = q.toLowerCase().trim();
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    const kw  = (btn.dataset.keywords || '') + ' ' + btn.textContent;
    const hit = !query || kw.toLowerCase().includes(query);
    btn.classList.toggle('hidden', !hit);
  });
  // Hide section headers with no visible items
  document.querySelectorAll('.nav-group').forEach(g => {
    const visible = g.querySelectorAll('.nav-item:not(.hidden)').length;
    g.classList.toggle('hidden', visible === 0);
  });
}

// ── Share ─────────────────────────────────────────────────────────────────────
function shareTab() {
  const url = location.origin + location.pathname + '?tool=' + window._activeTab;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => showToast('Link copied to clipboard!', 'success'));
  } else {
    prompt('Share this URL:', url);
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type='info', duration=3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success:'ti-check', error:'ti-alert-circle', info:'ti-info-circle' };
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<i class="ti ${icons[type]||'ti-info-circle'}"></i> ${msg}`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(),300); }, duration);
}

// ── Export utilities ──────────────────────────────────────────────────────────
function downloadText(content, filename, mime='text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Downloaded ' + filename, 'success');
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadText(csv, filename, 'text/csv');
}

function downloadFasta(seqs, filename) {
  const fa = seqs.map(s => `>${s.name}\n${s.seq.match(/.{1,60}/g).join('\n')}`).join('\n\n');
  downloadText(fa, filename, 'text/plain');
}

function downloadSVG(svgEl, filename) {
  const svg = svgEl.outerHTML;
  downloadText(svg, filename, 'image/svg+xml');
}

function downloadCanvasPNG(canvasId, filename) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) { showToast('Chart not found', 'error'); return; }
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
  showToast('Downloaded ' + filename, 'success');
}

// ── Shared input helpers ──────────────────────────────────────────────────────
function cleanSeq(raw, allowed='ACGTU') {
  return raw.toUpperCase().replace(/\s/g,'').split('').filter(c=>allowed.includes(c)).join('');
}
function cleanDNA(raw) { return cleanSeq(raw,'ACGTN'); }

function validateSeq(raw, minLen=4, name='Sequence') {
  if (!raw.trim()) { showError(name + ' is empty.'); return null; }
  const seq = cleanDNA(raw);
  if (seq.length < minLen) { showError(name + ` is too short (min ${minLen} bp).`); return null; }
  return seq;
}

function showError(msg, containerId='') {
  const html = `<div class="error-msg"><i class="ti ti-alert-circle"></i>${msg}</div>`;
  if (containerId) {
    const el = document.getElementById(containerId);
    if (el) { el.innerHTML = html; el.style.display='block'; }
  } else {
    showToast(msg, 'error');
  }
  return null;
}

function colorSeq(seq, max=600) {
  const map = {A:'base-A',T:'base-T',C:'base-C',G:'base-G',U:'base-U'};
  let html = seq.slice(0,max).split('').map(b=>{
    const cls=map[b]; return cls?`<span class="${cls}">${b}</span>`:b;
  }).join('');
  if (seq.length>max) html+=`<span style="color:var(--text-3)"> …+${seq.length-max} bp</span>`;
  return html;
}

function statGrid(stats) {
  return `<div class="stat-grid">${stats.map(s=>
    `<div class="stat-box"><span class="stat-val">${s.v}</span><span class="stat-lbl">${s.l}</span></div>`
  ).join('')}</div>`;
}

function card(title, inner, actions='') {
  return `<div class="card">
    <div class="card-header"><div class="card-title">${title}</div>${actions?`<div class="card-actions">${actions}</div>`:''}</div>
    ${inner}
  </div>`;
}

function exportBtn(label, onclick, icon='ti-download') {
  return `<button class="btn btn-sm" onclick="${onclick}"><i class="ti ${icon}"></i> ${label}</button>`;
}

function seqTextarea(id, rows=4, val='', placeholder='Paste sequence — or import via File Import above…') {
  return `<div style="position:relative;">
    <textarea id="${id}" rows="${rows}" placeholder="${placeholder}" style="font-family:var(--font-mono);font-size:12px;">${val}</textarea>
    ${window.sharedSeqs.length ? `<div style="position:absolute;top:6px;right:8px;">
      <select onchange="if(this.value){document.getElementById('${id}').value=this.value;this.value=''}" style="font-size:11px;padding:2px 6px;height:auto;width:auto;">
        <option value="">Import from file…</option>
        ${window.sharedSeqs.map(s=>`<option value="${s.seq}">${s.name} (${s.seq.length}bp)</option>`).join('')}
      </select>
    </div>` : ''}
  </div>`;
}

function getSharedSeq(fallback='') {
  return window.sharedSeqs.length ? window.sharedSeqs[0].seq : fallback;
}

// ── Phase 2 tab metadata additions ───────────────────────────────────────────
Object.assign(TAB_META, {
  ncbifetch:   { title:'NCBI Sequence Fetch',          sub:'Fetch any sequence by accession number directly from NCBI', badge:'NCBI' },
  primer:      { title:'Primer Design',                sub:'Design PCR primers with Tm, GC%, hairpin scoring', badge:'PCR' },
  msa:         { title:'Multiple Sequence Alignment',  sub:'Progressive alignment of 2–20 sequences (ClustalW-style)', badge:'MSA' },
  sw:          { title:'Smith-Waterman Local Align',   sub:'Find the best matching sub-region between two sequences', badge:'Local' },
  annotation:  { title:'Sequence Annotation Builder',  sub:'Add features, export GenBank and GFF3', badge:'Annotate' },
});

// Patch getPanel to include Phase 2 panels
const _origGetPanel = getPanel;
function getPanel(id) {
  const phase2 = {
    ncbifetch:  ncbiFetchPanel,
    primer:     primerPanel,
    msa:        msaPanel,
    sw:         swPanel,
    annotation: annotationPanel,
  };
  return phase2[id] || _origGetPanel(id);
}
