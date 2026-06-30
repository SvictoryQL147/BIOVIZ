function motifPanel() {
  return `
  <div class="tool-intro">Search for exact or IUPAC degenerate patterns. Wildcards: <code>N</code>=any, <code>R</code>=A/G, <code>Y</code>=C/T, <code>W</code>=A/T, <code>S</code>=G/C, <code>K</code>=G/T, <code>M</code>=A/C, <code>B</code>=C/G/T, <code>D</code>=A/G/T, <code>H</code>=A/C/T, <code>V</code>=A/C/G.</div>
  <div class="input-group">
    <label>Sequence</label>
    ${seqTextarea('motif-seq', 5, DEMO_SEQS.short)}
  </div>
  <div class="input-group">
    <label>Motif pattern (IUPAC codes supported)</label>
    <input type="text" id="motif-pat" value="ATCG" placeholder="e.g. GAATTC or RAATTY" style="height:38px;font-family:var(--font-mono);">
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runMotif()"><i class="ti ti-search"></i> Search</button>
    <button class="btn" onclick="document.getElementById('motif-seq').value=DEMO_SEQS.short;document.getElementById('motif-pat').value='ATCG';runMotif()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="motif-result" style="display:none;"></div>`;
}

function iupacToRegex(pat) {
  const IUPAC_MAP={N:'[ACGTU]',R:'[AG]',Y:'[CT]',W:'[AT]',S:'[GC]',K:'[GT]',M:'[AC]',B:'[CGT]',D:'[AGT]',H:'[ACT]',V:'[ACG]'};
  return pat.toUpperCase().split('').map(c=>IUPAC_MAP[c]||c).join('');
}

function runMotif() {
  const seq = cleanSeq(document.getElementById('motif-seq').value);
  const pat = document.getElementById('motif-pat').value.trim();
  if (!seq){ showToast('Enter a sequence.','error'); return; }
  if (!pat){ showToast('Enter a motif pattern.','error'); return; }

  let re;
  try { re=new RegExp(iupacToRegex(pat),'gi'); }
  catch(e){ showToast('Invalid pattern: '+e.message,'error'); return; }

  const hits=[]; let m;
  while((m=re.exec(seq))!==null){ hits.push({pos:m.index,match:m[0]}); re.lastIndex=m.index+1; }

  const hitSet=new Set(hits.flatMap(h=>Array.from({length:h.match.length},(_,i)=>h.pos+i)));
  const colored=seq.slice(0,600).split('').map((b,i)=>
    hitSet.has(i)
      ?`<span style="background:var(--accent-bg);color:var(--accent);border-radius:2px;font-weight:700;">${b}</span>`
      :`<span class="${{A:'base-A',T:'base-T',C:'base-C',G:'base-G',U:'base-U'}[b]||''}">${b}</span>`
  ).join('');

  const BINS=20, binSize=Math.ceil(seq.length/BINS);
  const binCounts=Array(BINS).fill(0);
  hits.forEach(h=>{ const b=Math.min(Math.floor(h.pos/binSize),BINS-1); binCounts[b]++; });

  const el=document.getElementById('motif-result');
  el.style.display='block';
  el.innerHTML=`
    ${statGrid([
      {v:seq.length.toLocaleString(), l:'Seq. length'},
      {v:hits.length, l:'Hits found'},
      {v:hits.length?(hits.length/seq.length*1000).toFixed(2):0, l:'Hits per kb'},
      {v:pat.length+' bp', l:'Pattern length'},
    ])}
    ${hits.length===0?`<div class="error-msg"><i class="ti ti-info-circle"></i>No hits found for pattern <strong>${pat}</strong>. Check IUPAC codes or try a shorter pattern.</div>`:''}
    ${hits.length?card(`Hits (${Math.min(hits.length,50)} of ${hits.length})`,`
      <div style="display:flex;flex-direction:column;gap:3px;">
        ${hits.slice(0,50).map(h=>`<div class="hit-row"><span class="hit-match">${h.match}</span><span class="hit-pos">pos ${h.pos+1}–${h.pos+h.match.length}</span></div>`).join('')}
        ${hits.length>50?`<p style="font-size:11px;color:var(--text-3);padding:4px 8px;">…and ${hits.length-50} more</p>`:''}
      </div>`, exportBtn('CSV','exportMotifCSV()')+'  '+exportBtn('BED','exportMotifBED()')):''}
    ${card('Highlighted sequence',`<div class="seq-display">${colored}${seq.length>600?`<span style="color:var(--text-3)"> …+${seq.length-600} bp</span>`:''}</div>`)}
    ${hits.length?card('Hit density',`<div class="chart-wrap" style="height:100px;"><canvas id="motif-chart"></canvas></div>`,exportBtn('PNG','downloadCanvasPNG("motif-chart","motif_density.png")')):''}
  `;

  if(hits.length){
    const ctx=document.getElementById('motif-chart').getContext('2d');
    window._charts.motif=new Chart(ctx,{
      type:'bar',
      data:{labels:binCounts.map((_,i)=>Math.round(i*binSize+binSize/2)),
        datasets:[{label:'Hits',data:binCounts,backgroundColor:'#2563eb',borderRadius:2}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{x:{title:{display:true,text:'Position',color:'#888',font:{size:10}},ticks:{color:'#888',maxTicksLimit:8}},
                y:{ticks:{color:'#888',stepSize:1}}}}
    });
  }
  window._motifData={seq,pat,hits};
}

function exportMotifCSV(){
  if(!window._motifData) return;
  const {pat,hits}=window._motifData;
  downloadCSV([['Pattern','Position_start','Position_end','Match'],
    ...hits.map(h=>[pat,h.pos+1,h.pos+h.match.length,h.match])],'motif_hits.csv');
}
function exportMotifBED(){
  if(!window._motifData) return;
  const {pat,hits}=window._motifData;
  const bed=hits.map(h=>`seq\t${h.pos}\t${h.pos+h.match.length}\t${pat}\t0\t+`).join('\n');
  downloadText('track name="Motif hits"\n'+bed,'motif_hits.bed');
}
