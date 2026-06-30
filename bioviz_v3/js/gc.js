function gcPanel() {
  return `
  <div class="tool-intro">
    Paste any DNA or RNA sequence to analyze base composition, GC content, and nucleotide frequencies.
    Upper/lowercase both accepted. Non-ACGTU characters are silently ignored.
  </div>
  <div class="input-group">
    <label>Sequence</label>
    ${seqTextarea('gc-seq', 5, DEMO_SEQS.short)}
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runGC()"><i class="ti ti-chart-pie"></i> Analyze</button>
    <button class="btn" onclick="document.getElementById('gc-seq').value=DEMO_SEQS.short;runGC()"><i class="ti ti-flask"></i> Demo</button>
    <button class="btn" onclick="document.getElementById('gc-seq').value='';document.getElementById('gc-result').style.display='none'"><i class="ti ti-trash"></i> Clear</button>
  </div>
  <div id="gc-result" style="display:none;"></div>`;
}

function runGC() {
  const raw = document.getElementById('gc-seq').value;
  const seq = cleanSeq(raw);
  if (!seq.length) { showToast('Enter a sequence first.', 'error'); return; }

  const cnt = {A:0,C:0,G:0,T:0,U:0};
  for (const b of seq) if (b in cnt) cnt[b]++;
  const total  = seq.length;
  const gcPct  = ((cnt.G+cnt.C)/total*100).toFixed(1);
  const atPct  = (100-parseFloat(gcPct)).toFixed(1);
  const isRNA  = cnt.U > cnt.T;
  const N4     = isRNA ? cnt.U : cnt.T;
  const N4lbl  = isRNA ? 'Uracil (U)' : 'Thymine (T)';

  // GC interpretation
  let gcNote = '';
  const gc = parseFloat(gcPct);
  if (gc < 30)      gcNote = '⚠️ Very AT-rich — may have low thermostability';
  else if (gc < 40) gcNote = 'AT-rich sequence';
  else if (gc > 70) gcNote = '⚠️ Very GC-rich — potential for secondary structures';
  else if (gc > 60) gcNote = 'GC-rich sequence';
  else              gcNote = '✓ Balanced composition';

  const el = document.getElementById('gc-result');
  el.style.display = 'block';
  el.innerHTML = `
    ${statGrid([
      {v:total.toLocaleString(), l:'Length (bp)'},
      {v:gcPct+'%', l:'GC content'},
      {v:atPct+'%', l:isRNA?'AU content':'AT content'},
      {v:cnt.A.toLocaleString(), l:'Adenine (A)'},
      {v:cnt.C.toLocaleString(), l:'Cytosine (C)'},
      {v:cnt.G.toLocaleString(), l:'Guanine (G)'},
      {v:N4.toLocaleString(), l:N4lbl},
    ])}

    ${card('GC Content', `
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-2);margin-bottom:6px;">
        <span>AT-rich (0%)</span>
        <strong style="color:var(--accent)">${gcPct}% GC — ${gcNote}</strong>
        <span>GC-rich (100%)</span>
      </div>
      <div class="gc-bar-wrap"><div class="gc-bar" id="gc-bar-inner" style="width:0%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-3);margin-top:4px;"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
    `, exportBtn('CSV','exportGCcsv()'))}

    ${card('Base Frequency', `<div class="chart-wrap" style="height:200px;"><canvas id="gc-chart"></canvas></div>`,
      exportBtn('PNG','downloadCanvasPNG("gc-chart","gc-frequency.png")'))}

    ${card('Colored Sequence', `<div class="seq-display" id="gc-colored">${colorSeq(seq)}</div>
      <div class="legend-row">
        <div class="legend-item"><div class="legend-dot" style="background:var(--base-A)"></div>A</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--base-T)"></div>${isRNA?'U':'T'}</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--base-C)"></div>C</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--base-G)"></div>G</div>
      </div>`,
      exportBtn('FASTA','exportGCfasta()'))}
  `;

  setTimeout(() => {
    const bar = document.getElementById('gc-bar-inner');
    if (bar) bar.style.width = gcPct + '%';
  }, 60);

  const labels = isRNA ? ['A','C','G','U'] : ['A','C','G','T'];
  const data   = isRNA ? [cnt.A,cnt.C,cnt.G,cnt.U] : [cnt.A,cnt.C,cnt.G,cnt.T];
  const colors = ['var(--base-A)','var(--base-C)','var(--base-G)','var(--base-T)'];
  const ctx = document.getElementById('gc-chart').getContext('2d');
  window._charts.gc = new Chart(ctx, {
    type:'bar',
    data:{labels, datasets:[{label:'Count', data, backgroundColor:['#16a34a','#2563eb','#d97706','#dc2626'], borderRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.parsed.y.toLocaleString()} (${(c.parsed.y/total*100).toFixed(1)}%)`}}},
      scales:{y:{grid:{color:'rgba(128,128,128,0.08)'},ticks:{color:'#888'}},x:{ticks:{color:'#888'}}}}
  });

  // Store for export
  window._gcData = {seq, cnt, gcPct, isRNA, total};
}

function exportGCcsv() {
  if (!window._gcData) return;
  const {cnt,gcPct,total,isRNA} = window._gcData;
  downloadCSV([
    ['Base','Count','Percentage'],
    ['A', cnt.A, (cnt.A/total*100).toFixed(2)+'%'],
    ['C', cnt.C, (cnt.C/total*100).toFixed(2)+'%'],
    ['G', cnt.G, (cnt.G/total*100).toFixed(2)+'%'],
    [isRNA?'U':'T', isRNA?cnt.U:cnt.T, ((isRNA?cnt.U:cnt.T)/total*100).toFixed(2)+'%'],
    ['GC%', gcPct+'%',''],
    ['Length', total,''],
  ], 'gc-composition.csv');
}

function exportGCfasta() {
  if (!window._gcData) return;
  downloadFasta([{name:'sequence', seq:window._gcData.seq}], 'sequence.fasta');
}
