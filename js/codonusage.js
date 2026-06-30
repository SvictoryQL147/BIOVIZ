function codonusagePanel() {
  return `
  <div class="tool-intro">Calculate the frequency of all 64 codons. Useful for identifying codon bias, optimizing synthetic genes, and comparing translational preferences between organisms.</div>
  <div class="input-group">
    <label>DNA coding sequence</label>
    ${seqTextarea('cu-seq', 5, getSharedSeq(DEMO_SEQS.lambda))}
  </div>
  <div class="input-group">
    <label>Reading frame</label>
    <select id="cu-frame" style="height:36px;">
      <option value="0">+1 (start at position 1)</option>
      <option value="1">+2 (start at position 2)</option>
      <option value="2">+3 (start at position 3)</option>
    </select>
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runCodonUsage()"><i class="ti ti-list-numbers"></i> Analyze</button>
    <button class="btn" onclick="document.getElementById('cu-seq').value=DEMO_SEQS.lambda;runCodonUsage()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="cu-result" style="display:none;"></div>`;
}

function runCodonUsage() {
  const raw   = cleanDNA(document.getElementById('cu-seq').value);
  const frame = parseInt(document.getElementById('cu-frame').value)||0;
  if (!raw||raw.length<3){ showToast('Enter a sequence of at least 3 bases.','error'); return; }

  const counts={};
  Object.keys(CODON_TABLE).forEach(c=>counts[c]=0);
  for (let i=frame;i<raw.length-2;i+=3){
    const c=raw.slice(i,i+3);
    if(c in counts) counts[c]++;
  }
  const total=Object.values(counts).reduce((a,b)=>a+b,0);

  const byAA={};
  Object.entries(CODON_TABLE).forEach(([codon,aa])=>{
    if(!byAA[aa]) byAA[aa]=[];
    byAA[aa].push({codon,count:counts[codon],freq:total?(counts[codon]/total*1000).toFixed(1):0});
  });

  const top20=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20);
  const sortedAA=Object.keys(byAA).sort();
  const tableHTML=sortedAA.map(aa=>{
    const entries=byAA[aa].sort((a,b)=>b.count-a.count);
    const maxC=entries[0].count||1;
    return `<div style="margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:3px;">${aa==='*'?'Stop (*)':aa}</div>
      ${entries.map(e=>`
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <span style="font-family:var(--font-mono);font-size:12px;font-weight:600;color:var(--accent);width:32px;">${e.codon}</span>
          <div style="flex:1;height:10px;background:var(--surface-2);border-radius:100px;overflow:hidden;border:1px solid var(--border);">
            <div style="height:100%;width:${e.count/maxC*100}%;background:var(--accent);border-radius:100px;opacity:0.7;"></div>
          </div>
          <span style="font-size:11px;width:28px;text-align:right;">${e.count}</span>
          <span style="font-size:10px;color:var(--text-3);width:44px;text-align:right;">${e.freq}/kb</span>
        </div>`).join('')}
    </div>`;
  }).join('');

  const el=document.getElementById('cu-result');
  el.style.display='block';
  el.innerHTML=`
    ${statGrid([
      {v:raw.length.toLocaleString(), l:'Seq. length'},
      {v:total.toLocaleString(), l:'Total codons'},
      {v:Object.values(counts).filter(v=>v>0).length, l:'Unique codons'},
      {v:(Object.values(counts).filter(v=>v>0).length/64*100).toFixed(0)+'%', l:'Coverage'},
    ])}
    ${card('Top 20 codons', `<div class="chart-wrap" style="height:220px;"><canvas id="cu-chart"></canvas></div>`,
      exportBtn('PNG','downloadCanvasPNG("cu-chart","codon_usage.png")')+'  '+exportBtn('CSV','exportCUcsv()'))}
    ${card('All codons by amino acid',`<div style="column-count:3;column-gap:20px;padding:4px;">${tableHTML}</div>`,
      exportBtn('CSV','exportCUfull()'))}
  `;

  const ctx=document.getElementById('cu-chart').getContext('2d');
  window._charts.cu=new Chart(ctx,{
    type:'bar',
    data:{labels:top20.map(([c])=>c),datasets:[{label:'Count',data:top20.map(([,v])=>v),
      backgroundColor:top20.map(([c])=>CODON_TABLE[c]==='*'?'#dc2626':'#2563eb'),borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.parsed.y} (${(c.parsed.y/total*1000).toFixed(1)}/kb)`}}},
      scales:{x:{ticks:{color:'#888',font:{family:'monospace',size:10}}},y:{ticks:{color:'#888'}}}}
  });
  window._cuData={counts,total,raw};
}

function exportCUcsv(){
  if(!window._cuData) return;
  const {counts,total}=window._cuData;
  downloadCSV([['Codon','Amino_acid','Count','Freq_per_1000'],
    ...Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([c,n])=>
      [c, CODON_TABLE[c]||'?', n, total?(n/total*1000).toFixed(2):0])
  ],'codon_usage.csv');
}
function exportCUfull(){ exportCUcsv(); }
