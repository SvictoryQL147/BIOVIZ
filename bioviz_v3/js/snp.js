function snpPanel(){
  return `
  <div class="tool-intro">Compare two sequences and highlight every single-nucleotide variant. Transitions (A↔G, C↔T — same purine/pyrimidine class) and transversions are distinguished. Ti/Tv ratio is calculated.</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div class="input-group"><label>Reference sequence</label><textarea id="snp-ref" rows="4" style="font-family:var(--font-mono);font-size:12px;">ATGCGATCGATCGGCTATCGATCGATCGATCGATCGATCGATCGATCGATCG</textarea></div>
    <div class="input-group"><label>Query / variant sequence</label><textarea id="snp-qry" rows="4" style="font-family:var(--font-mono);font-size:12px;">ATGCGATCGAACGGCTATCGATCGATAGATCGATCGATCGATCAATCGATCG</textarea></div>
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runSNP()"><i class="ti ti-git-diff"></i> Visualize SNPs</button>
    <button class="btn" onclick="loadSNPDemo()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="snp-result" style="display:none;"></div>`;
}

function loadSNPDemo(){
  document.getElementById('snp-ref').value='ATGCGATCGATCGGCTATCGATCGATCGATCGATCGATCGATCGATCGATCG';
  document.getElementById('snp-qry').value='ATGCGATCGAACGGCTATCGATCGATAGATCGATCGATCGATCAATCGATCG';
  runSNP();
}

const TRANSITIONS_SET=new Set(['AG','GA','CT','TC']);
function classifySNP(r,a){
  if(!a||a==='-') return 'deletion';
  if(!r||r==='-') return 'insertion';
  return TRANSITIONS_SET.has(r+a)?'transition':'transversion';
}

function runSNP(){
  const ref=cleanDNA(document.getElementById('snp-ref').value);
  const qry=cleanDNA(document.getElementById('snp-qry').value);
  if(!ref){ showToast('Enter a reference sequence.','error'); return; }
  if(!qry){ showToast('Enter a query sequence.','error'); return; }

  const len=Math.max(ref.length,qry.length);
  const snps=[]; let transitions=0, transversions=0, matches=0;
  for(let i=0;i<len;i++){
    const r=ref[i]||'-', q=qry[i]||'-';
    if(r===q){matches++;continue;}
    const type=classifySNP(r,q);
    snps.push({pos:i+1,ref:r,alt:q,type});
    if(type==='transition') transitions++;
    else if(type==='transversion') transversions++;
  }
  const tiTv=transversions?(transitions/transversions).toFixed(2):'∞';

  const refHTML=ref.slice(0,600).split('').map((b,i)=>
    qry[i]&&qry[i]!==b?`<span style="background:#fee2e2;color:#dc2626;font-weight:700;border-radius:2px;">${b}</span>`
    :`<span class="${{A:'base-A',T:'base-T',C:'base-C',G:'base-G'}[b]||''}">${b}</span>`).join('');
  const qryHTML=qry.slice(0,600).split('').map((b,i)=>
    ref[i]&&ref[i]!==b?`<span style="background:#dcfce7;color:#16a34a;font-weight:700;border-radius:2px;">${b}</span>`
    :`<span class="${{A:'base-A',T:'base-T',C:'base-C',G:'base-G'}[b]||''}">${b}</span>`).join('');

  const BINS=20, binSize=Math.ceil(len/BINS), binCounts=Array(BINS).fill(0);
  snps.forEach(s=>{const b=Math.min(Math.floor((s.pos-1)/binSize),BINS-1);binCounts[b]++;});

  const el=document.getElementById('snp-result');
  el.style.display='block';
  el.innerHTML=`
    ${statGrid([
      {v:len.toLocaleString(), l:'Compared length'},
      {v:snps.length, l:'Total SNPs'},
      {v:(snps.length/len*100).toFixed(2)+'%', l:'Divergence'},
      {v:transitions, l:'Transitions'},
      {v:transversions, l:'Transversions'},
      {v:tiTv, l:'Ti/Tv ratio'},
    ])}
    ${card('SNP density',`<div class="chart-wrap" style="height:110px;"><canvas id="snp-chart"></canvas></div>`,
      exportBtn('PNG','downloadCanvasPNG("snp-chart","snp_density.png")'))}
    ${card('Annotated alignment (first 600 bp)',`
      <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">Reference &nbsp;<span style="background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:2px;font-size:10px;">variants</span></div>
      <div class="seq-display">${refHTML}${ref.length>600?`<span style="color:var(--text-3)"> …</span>`:''}</div>
      <div style="font-size:11px;color:var(--text-3);margin:8px 0 4px;">Query &nbsp;<span style="background:#dcfce7;color:#16a34a;padding:1px 6px;border-radius:2px;font-size:10px;">variants</span></div>
      <div class="seq-display">${qryHTML}${qry.length>600?`<span style="color:var(--text-3)"> …</span>`:''}</div>
    `)}
    ${snps.length?card(`SNP table (${Math.min(snps.length,200)} of ${snps.length})`,`
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="padding:5px 8px;text-align:left">Pos</th><th style="padding:5px 8px;text-align:left">Ref</th>
          <th style="padding:5px 8px;text-align:left">Alt</th><th style="padding:5px 8px;text-align:left">Type</th>
          <th style="padding:5px 8px;text-align:left">Change</th>
        </tr></thead>
        <tbody>${snps.slice(0,200).map(s=>{
          const c=s.type==='transition'?'#2563eb':s.type==='transversion'?'#d97706':'#dc2626';
          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:4px 8px;font-family:var(--font-mono);">${s.pos}</td>
            <td style="padding:4px 8px;font-family:var(--font-mono);font-weight:700;">${s.ref}</td>
            <td style="padding:4px 8px;font-family:var(--font-mono);font-weight:700;color:${c};">${s.alt}</td>
            <td style="padding:4px 8px;"><span style="font-size:10px;padding:2px 6px;border-radius:100px;background:${c}18;color:${c};">${s.type}</span></td>
            <td style="padding:4px 8px;font-family:var(--font-mono);">${s.ref}→${s.alt}</td>
          </tr>`;}).join('')}
        </tbody>
      </table></div>
    `, exportBtn('CSV','exportSNPcsv()')+'  '+exportBtn('VCF','exportSNPvcf()')):''}
  `;

  const ctx=document.getElementById('snp-chart').getContext('2d');
  window._charts.snp=new Chart(ctx,{type:'bar',
    data:{labels:binCounts.map((_,i)=>Math.round(i*binSize+binSize/2)),
      datasets:[{label:'SNPs',data:binCounts,backgroundColor:'#dc2626',borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{ticks:{color:'#888',maxTicksLimit:8}},y:{ticks:{color:'#888',stepSize:1}}}}
  });
  window._snpData={ref,qry,snps};
}

function exportSNPcsv(){
  if(!window._snpData) return;
  downloadCSV([['Position','Ref','Alt','Type'],
    ...window._snpData.snps.map(s=>[s.pos,s.ref,s.alt,s.type])],'snps.csv');
}
function exportSNPvcf(){
  if(!window._snpData) return;
  const header='##fileformat=VCFv4.2\n##source=BioViz\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO';
  const rows=window._snpData.snps.map(s=>`seq\t${s.pos}\t.\t${s.ref}\t${s.alt}\t.\tPASS\tTYPE=${s.type}`);
  downloadText(header+'\n'+rows.join('\n'),'variants.vcf');
}
