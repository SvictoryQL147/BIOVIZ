function dotplotPanel(){
  return `
  <div class="tool-intro">Visualize sequence similarity. Each dot marks a position where two sequences share the same nucleotide (or a window of bases). Diagonal runs reveal conserved regions; off-diagonal = repeats or inversions.</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div class="input-group"><label>Sequence 1</label><textarea id="dot-a" rows="4" style="font-family:var(--font-mono);font-size:12px;" placeholder="Sequence 1…">ATGCGATCGATCGATCGGCTATCGATCGATCGATCGATCG</textarea></div>
    <div class="input-group"><label>Sequence 2</label><textarea id="dot-b" rows="4" style="font-family:var(--font-mono);font-size:12px;" placeholder="Sequence 2…">GCATCGATCGGCTATCGATCGATCGATCGGCTATCGATCG</textarea></div>
  </div>
  <div class="input-group">
    <label>Window size (1 = single base, larger = fewer noise dots)</label>
    <input type="number" id="dot-window" value="1" min="1" max="15" style="height:36px;width:120px;">
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runDotplot()"><i class="ti ti-chart-scatter"></i> Draw</button>
    <button class="btn" onclick="loadDotDemo()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="dotplot-result" style="display:none;"></div>`;
}

function loadDotDemo(){
  document.getElementById('dot-a').value='ATGCGATCGATCGATCGGCTATCGATCGATCGATCGATCG';
  document.getElementById('dot-b').value='GCATCGATCGGCTATCGATCGATCGATCGGCTATCGATCG';
  runDotplot();
}

function runDotplot(){
  const a=cleanDNA(document.getElementById('dot-a').value);
  const b=cleanDNA(document.getElementById('dot-b').value);
  const win=parseInt(document.getElementById('dot-window').value)||1;
  if(!a){ showToast('Enter sequence 1.','error'); return; }
  if(!b){ showToast('Enter sequence 2.','error'); return; }

  const MAX=150;
  const sa=a.slice(0,MAX), sb=b.slice(0,MAX);
  const cell=Math.max(4,Math.min(10,Math.floor(540/Math.max(sa.length,sb.length))));
  const cw=sa.length*cell+70, ch=sb.length*cell+60;

  // Build SVG (no canvas — fully exportable)
  let dots='';
  for(let i=0;i<=sa.length-win;i++){
    for(let j=0;j<=sb.length-win;j++){
      let match=true;
      for(let w=0;w<win;w++) if(sa[i+w]!==sb[j+w]){match=false;break;}
      if(match) dots+=`<rect x="${i*cell+60}" y="${j*cell+20}" width="${cell-1}" height="${cell-1}" fill="#2563eb" opacity="0.75"/>`;
    }
  }

  let axes='';
  const xStep=Math.max(1,Math.floor(sa.length/8)), yStep=Math.max(1,Math.floor(sb.length/8));
  for(let i=0;i<sa.length;i+=xStep)
    axes+=`<text x="${i*cell+60+cell/2}" y="14" text-anchor="middle" fill="#888" font-size="9">${i+1}</text>`;
  for(let j=0;j<sb.length;j+=yStep)
    axes+=`<text x="55" y="${j*cell+20+cell/2+3}" text-anchor="end" fill="#888" font-size="9">${j+1}</text>`;

  const svg=`<svg id="dotplot-svg" viewBox="0 0 ${cw} ${ch}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;border-radius:var(--radius);background:var(--surface-2);">
    <text x="${cw/2}" y="${ch-8}" text-anchor="middle" fill="#888" font-size="10">Sequence 1 (${sa.length} bp)</text>
    <text x="10" y="${ch/2}" transform="rotate(-90,10,${ch/2})" text-anchor="middle" fill="#888" font-size="10">Sequence 2 (${sb.length} bp)</text>
    ${axes}${dots}
  </svg>`;

  const el=document.getElementById('dotplot-result');
  el.style.display='block';
  el.innerHTML=`
    ${statGrid([
      {v:sa.length+' bp', l:'Seq 1 length'},
      {v:sb.length+' bp', l:'Seq 2 length'},
      {v:win, l:'Window size'},
      {v:a.length>MAX||b.length>MAX?'First '+MAX+' bp':'Full','l':'Coverage'},
    ])}
    ${card('Dot plot',svg+'<div class="legend-row"><div class="legend-item"><div class="legend-dot" style="background:#2563eb;opacity:0.75"></div>Match</div></div>',
      exportBtn('SVG','exportDotSVG()'))}
  `;
}
function exportDotSVG(){
  const el=document.getElementById('dotplot-svg');
  if(el) downloadSVG(el,'dotplot.svg');
  else showToast('Draw the dot plot first.','error');
}
