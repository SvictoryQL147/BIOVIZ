function restrictionPanel() {
  return `
  <div class="tool-intro">Detect restriction enzyme recognition and cut sites in your sequence. 30 common enzymes from 4-cutters (MspI, TaqI) to rare 8-cutters (NotI, AscI). Generates a linear map, hit table, and non-cutter list.</div>
  <div class="input-group">
    <label>DNA sequence</label>
    ${seqTextarea('re-seq', 5, DEMO_SEQS.lambda)}
  </div>
  <div class="input-group">
    <label>Enzyme selection</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
      <button class="btn btn-sm" onclick="selectAllEnzymes(true)">Select all</button>
      <button class="btn btn-sm" onclick="selectAllEnzymes(false)">Clear all</button>
      <button class="btn btn-sm" onclick="selectCommonEnzymes()">6+ cutters only</button>
    </div>
    <div id="enzyme-select-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:5px;max-height:180px;overflow-y:auto;padding:10px;background:var(--surface-2);border-radius:var(--radius);border:1px solid var(--border);">
      ${RESTRICTION_ENZYMES.map(e=>`
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:2px 0;">
          <input type="checkbox" class="enz-check" value="${e.name}" checked>
          <span style="font-weight:600;color:var(--accent)">${e.name}</span>
          <span style="color:var(--text-3);font-family:var(--font-mono);font-size:10px;">${e.site}</span>
        </label>`).join('')}
    </div>
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runRestriction()"><i class="ti ti-cut"></i> Map sites</button>
    <button class="btn" onclick="document.getElementById('re-seq').value=DEMO_SEQS.lambda;runRestriction()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="re-result" style="display:none;"></div>`;
}

function selectAllEnzymes(val){ document.querySelectorAll('.enz-check').forEach(c=>c.checked=val); }
function selectCommonEnzymes(){
  document.querySelectorAll('.enz-check').forEach(c=>{
    const e=RESTRICTION_ENZYMES.find(e=>e.name===c.value);
    c.checked=e?e.site.replace(/[^A-Z]/gi,'').length>=6:false;
  });
}

function enzymeToRegex(site){
  const IUPAC={N:'[ACGT]',R:'[AG]',Y:'[CT]',W:'[AT]',S:'[GC]',K:'[GT]',M:'[AC]'};
  return site.split('').map(c=>IUPAC[c]||c).join('');
}

function runRestriction() {
  const raw=cleanDNA(document.getElementById('re-seq').value);
  if (!raw||raw.length<4){ showToast('Enter a sequence of at least 4 bases.','error'); return; }
  const selected=[...document.querySelectorAll('.enz-check:checked')].map(c=>c.value);
  if (!selected.length){ showToast('Select at least one enzyme.','error'); return; }

  const results=[];
  for (const name of selected){
    const enz=RESTRICTION_ENZYMES.find(e=>e.name===name); if(!enz) continue;
    const re=new RegExp(enzymeToRegex(enz.site),'gi');
    const hits=[]; let m;
    while((m=re.exec(raw))!==null){ hits.push({pos:m.index,match:m[0],cutPos:m.index+enz.cut}); re.lastIndex=m.index+1; }
    if(hits.length) results.push({enz,hits});
  }
  results.sort((a,b)=>a.hits.length-b.hits.length);

  const el=document.getElementById('re-result');
  el.style.display='block';
  el.innerHTML=`
    ${statGrid([
      {v:raw.length.toLocaleString()+' bp', l:'Seq. length'},
      {v:selected.length, l:'Enzymes tested'},
      {v:results.length, l:'Enzymes that cut'},
      {v:selected.length-results.length, l:'Non-cutters'},
      {v:results.reduce((s,r)=>s+r.hits.length,0), l:'Total cut sites'},
    ])}
    ${card('Linear restriction map', buildLinearMap(raw,results), exportBtn('SVG','exportREmap()'))}
    ${results.length?card(`Enzymes that cut (${results.length})`, buildEnzymeTable(results), exportBtn('CSV','exportREcsv()')):''}
    ${card('Non-cutters', buildNonCutters(selected,results))}
  `;
  window._reData={raw,results,selected};
}

function buildLinearMap(seq,results){
  if(!results.length) return '<p style="color:var(--text-3);font-size:13px;">No enzymes cut this sequence.</p>';
  const W=640,PAD=40,trackW=W-PAD*2;
  const toX=p=>PAD+(p/seq.length)*trackW;
  const palette=['#2563eb','#16a34a','#dc2626','#d97706','#db2777','#7c3aed','#0891b2','#65a30d'];
  const LANE_H=26, lanes=[];
  const assigned=results.map(r=>{
    const x=toX(r.hits[0].pos);
    for(let l=0;l<20;l++){
      if(!lanes[l]) lanes[l]=[];
      if(!lanes[l].some(ex=>Math.abs(ex-x)<44)){lanes[l].push(x);return l;}
    }
    return 0;
  });
  const topH=(Math.max(...assigned,0)+1)*LANE_H+20;
  const H=topH+50;
  let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%">`;
  svg+=`<rect x="${PAD}" y="${topH+20}" width="${trackW}" height="5" rx="2" fill="var(--border-md)"/>`;
  [0,.25,.5,.75,1].forEach(t=>{
    const pos=Math.round(t*seq.length), x=toX(pos);
    svg+=`<line x1="${x}" y1="${topH+18}" x2="${x}" y2="${topH+28}" stroke="var(--text-3)" stroke-width="1"/>`;
    svg+=`<text x="${x}" y="${topH+42}" text-anchor="middle" fill="var(--text-3)" font-size="9">${pos} bp</text>`;
  });
  results.forEach((r,ri)=>{
    const color=palette[ri%palette.length], lane=assigned[ri];
    const y=topH-lane*LANE_H-10;
    r.hits.forEach(h=>{
      const x=toX(h.pos);
      svg+=`<line x1="${x}" y1="${y+6}" x2="${x}" y2="${topH+20}" stroke="${color}" stroke-width="1" stroke-dasharray="3,2" opacity="0.4"/>`;
      svg+=`<polygon points="${x},${topH+14} ${x-4},${topH+20} ${x+4},${topH+20}" fill="${color}"/>`;
    });
    const lx=toX(r.hits[0].pos);
    svg+=`<text x="${lx}" y="${y}" text-anchor="middle" fill="${color}" font-size="10" font-weight="700">${r.enz.name}</text>`;
    if(r.hits.length>1) svg+=`<text x="${lx}" y="${y+9}" text-anchor="middle" fill="${color}" font-size="8" opacity="0.7">×${r.hits.length}</text>`;
  });
  return svg+'</svg>';
}

function buildEnzymeTable(results){
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:8px;">
    ${results.map(r=>`
      <div class="enzyme-card">
        <div class="enzyme-name">${r.enz.name}</div>
        <div class="enzyme-site">${r.enz.site}</div>
        <div class="enzyme-hits">${r.hits.length} cut${r.hits.length!==1?'s':''} · ${r.enz.description}</div>
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-3);margin-top:2px;">${r.hits.map(h=>`pos ${h.pos+1}`).join(', ')}</div>
      </div>`).join('')}
  </div>`;
}

function buildNonCutters(selected,results){
  const cutters=new Set(results.map(r=>r.enz.name));
  const nc=selected.filter(n=>!cutters.has(n));
  if(!nc.length) return '<p style="font-size:13px;color:var(--text-3);">All selected enzymes cut at least once.</p>';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;">${nc.map(n=>`<span style="font-size:12px;padding:3px 10px;background:var(--surface-2);border-radius:100px;color:var(--text-2);border:1px solid var(--border);">${n}</span>`).join('')}</div>`;
}

function exportREcsv(){
  if(!window._reData) return;
  downloadCSV([['Enzyme','Site','Hits','Positions','Description'],
    ...window._reData.results.map(r=>[r.enz.name,r.enz.site,r.hits.length,r.hits.map(h=>h.pos+1).join(';'),r.enz.description])
  ],'restriction_sites.csv');
}
function exportREmap(){
  const svg=document.querySelector('#re-result svg');
  if(svg) downloadSVG(svg,'restriction_map.svg');
}
