function genomebrowserPanel(){
  return `
  <div class="tool-intro">A mini genome browser with zoom, scroll, and annotation tracks. Add features manually (name start end strand color) or import from a GenBank file via File Import. Hover features for details.</div>
  <div class="input-group"><label>Sequence</label>${seqTextarea('gb-seq',3,getSharedSeq(DEMO_SEQS.lambda))}</div>
  <div class="input-group">
    <label>Annotations <span style="font-weight:400;color:var(--text-3);font-size:11px;">— one per line: name start end strand color</span></label>
    <textarea id="gb-annot" rows="5" style="font-family:var(--font-mono);font-size:12px;">EcoRI_site 8 13 + #2563eb
BamHI_site 24 29 + #16a34a
HindIII 45 50 + #7c3aed
ORF_1 1 60 + #d97706
ORF_2 35 90 - #dc2626
CDS_A 55 89 + #0891b2</textarea>
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runGB()"><i class="ti ti-zoom-in"></i> Render</button>
    <button class="btn" onclick="loadGBDemo()"><i class="ti ti-flask"></i> Demo</button>
    <button class="btn" onclick="populateFromGenBank()"><i class="ti ti-file-description"></i> Import GenBank</button>
  </div>
  <div id="gb-toolbar" style="display:none;margin-bottom:10px;">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-sm" onclick="gbZoom(0.5)"><i class="ti ti-zoom-in"></i> Zoom in</button>
      <button class="btn btn-sm" onclick="gbZoom(2)"><i class="ti ti-zoom-out"></i> Zoom out</button>
      <button class="btn btn-sm" onclick="gbScroll(-0.2)"><i class="ti ti-arrow-left"></i></button>
      <button class="btn btn-sm" onclick="gbScroll(0.2)"><i class="ti ti-arrow-right"></i></button>
      <button class="btn btn-sm" onclick="gbReset()"><i class="ti ti-refresh"></i> Reset</button>
      <span id="gb-range-label" style="font-size:12px;color:var(--text-3);"></span>
      <button class="btn btn-sm" onclick="exportGBsvg()"><i class="ti ti-download"></i> SVG</button>
    </div>
  </div>
  <div id="gb-canvas-wrap" style="display:none;overflow-x:auto;"></div>
  <div id="gb-tooltip" style="display:none;position:fixed;background:var(--text);color:var(--surface);padding:6px 10px;border-radius:6px;font-size:11px;pointer-events:none;z-index:1000;"></div>`;
}

let _gbState=null;

function loadGBDemo(){ document.getElementById('gb-seq').value=DEMO_SEQS.lambda; runGB(); }

function populateFromGenBank(){
  const gb=window.sharedSeqs.find(s=>s.type==='genbank');
  if(!gb||!gb.genbank){ showToast('No GenBank file imported yet. Use File Import first.','error'); return; }
  document.getElementById('gb-seq').value=gb.seq;
  const colors=['#2563eb','#16a34a','#d97706','#dc2626','#db2777','#7c3aed'];
  const lines=gb.genbank.features.filter(f=>f.type==='gene'||f.type==='CDS').map((f,i)=>{
    const m=f.location.match(/(\d+)\.\.(\d+)/);
    const [s,e]=m?[parseInt(m[1]),parseInt(m[2])]:[1,10];
    const strand=f.location.includes('complement')?'-':'+';
    const name=(f.qualifiers.gene||f.qualifiers.product||f.type+'_'+i).replace(/\s+/g,'_');
    return `${name} ${s} ${e} ${strand} ${colors[i%colors.length]}`;
  });
  document.getElementById('gb-annot').value=lines.join('\n');
  runGB();
}

function parseAnnotations(text){
  return text.split('\n').map(l=>{
    const p=l.trim().split(/\s+/);
    if(p.length<3) return null;
    return{name:p[0],start:parseInt(p[1]),end:parseInt(p[2]),strand:p[3]||'+',color:p[4]||'#2563eb'};
  }).filter(a=>a&&!isNaN(a.start)&&!isNaN(a.end));
}

function runGB(){
  const seq=cleanDNA(document.getElementById('gb-seq').value);
  const annots=parseAnnotations(document.getElementById('gb-annot').value);
  if(!seq.length){ showToast('Enter a sequence.','error'); return; }
  _gbState={seq,annots,viewStart:0,viewEnd:seq.length};
  document.getElementById('gb-toolbar').style.display='block';
  document.getElementById('gb-canvas-wrap').style.display='block';
  renderGB();
}

function gbZoom(f){
  if(!_gbState) return;
  const{viewStart,viewEnd}=_gbState;
  const mid=(viewStart+viewEnd)/2, half=(viewEnd-viewStart)/2*f;
  _gbState.viewStart=Math.max(0,Math.round(mid-half));
  _gbState.viewEnd=Math.min(_gbState.seq.length,Math.round(mid+half));
  if(_gbState.viewEnd-_gbState.viewStart<10) _gbState.viewEnd=_gbState.viewStart+10;
  renderGB();
}
function gbScroll(fraction){
  if(!_gbState) return;
  const len=_gbState.viewEnd-_gbState.viewStart, delta=Math.round(len*fraction);
  _gbState.viewStart=Math.max(0,_gbState.viewStart+delta);
  _gbState.viewEnd=Math.min(_gbState.seq.length,_gbState.viewEnd+delta);
  renderGB();
}
function gbReset(){
  if(!_gbState) return;
  _gbState.viewStart=0; _gbState.viewEnd=_gbState.seq.length; renderGB();
}

function renderGB(){
  if(!_gbState) return;
  const{seq,annots,viewStart,viewEnd}=_gbState;
  const visSeq=seq.slice(viewStart,viewEnd);
  const W=640, PAD=40, trackW=W-PAD*2;
  const toX=p=>PAD+((p-viewStart)/(viewEnd-viewStart))*trackW;

  document.getElementById('gb-range-label').textContent=
    `${(viewStart+1).toLocaleString()}–${viewEnd.toLocaleString()} bp · ${(viewEnd-viewStart).toLocaleString()} bp visible`;

  const LANE_H=22, TOP_TRACK=30;
  const lanes=[];
  const assigned=annots.map(a=>{
    const xs=toX(a.start),xe=toX(a.end);
    for(let l=0;l<20;l++){
      if(!lanes[l]) lanes[l]=[];
      if(!lanes[l].some(([s,e])=>xs<e+4&&xe>s-4)){lanes[l].push([xs,xe]);return l;}
    }
    return 0;
  });
  const annotH=(Math.max(...assigned,0)+1)*LANE_H+16;
  const SEQ_TRACK=TOP_TRACK+annotH+10;
  const H=SEQ_TRACK+55;

  let svg=`<svg id="gb-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;min-width:400px;border-radius:var(--radius);background:var(--surface-2);">`;

  // Scale ruler
  const ticks=8;
  for(let t=0;t<=ticks;t++){
    const pos=Math.round(viewStart+t*(viewEnd-viewStart)/ticks), x=toX(pos);
    svg+=`<line x1="${x}" y1="${TOP_TRACK-7}" x2="${x}" y2="${TOP_TRACK}" stroke="var(--text-3)" stroke-width="1"/>`;
    svg+=`<text x="${x}" y="${TOP_TRACK-10}" text-anchor="middle" fill="var(--text-3)" font-size="9">${pos.toLocaleString()}</text>`;
  }
  svg+=`<line x1="${PAD}" y1="${TOP_TRACK}" x2="${W-PAD}" y2="${TOP_TRACK}" stroke="var(--border-md)" stroke-width="2"/>`;

  // Annotations
  annots.forEach((a,i)=>{
    if(a.end<viewStart||a.start>viewEnd) return;
    const xs=Math.max(toX(a.start),PAD), xe=Math.min(toX(a.end),W-PAD);
    if(xe-xs<1) return;
    const lane=assigned[i], y=TOP_TRACK+6+lane*LANE_H, h=14, aw=Math.min(8,xe-xs);
    const pts=a.strand!=='-'
      ?`${xs},${y} ${xe-aw},${y} ${xe},${y+h/2} ${xe-aw},${y+h} ${xs},${y+h}`
      :`${xs+aw},${y} ${xe},${y} ${xe},${y+h} ${xs+aw},${y+h} ${xs},${y+h/2}`;
    svg+=`<polygon class="gb-feat" points="${pts}" fill="${a.color}" opacity="0.85"><title>${a.name} | ${a.start}–${a.end} | ${a.strand} strand</title></polygon>`;
    if(xe-xs>30) svg+=`<text x="${(xs+xe)/2}" y="${y+h/2+4}" text-anchor="middle" fill="white" font-size="9" font-weight="700" pointer-events="none">${a.name.slice(0,14)}</text>`;
  });

  // Sequence track
  svg+=`<rect x="${PAD}" y="${SEQ_TRACK}" width="${trackW}" height="20" rx="3" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>`;
  if(visSeq.length<=120){
    const bw=trackW/visSeq.length;
    const bc={A:'#16a34a',T:'#dc2626',C:'#2563eb',G:'#d97706',N:'#888'};
    visSeq.split('').forEach((b,i)=>{
      const bx=PAD+i*bw;
      svg+=`<rect x="${bx+0.5}" y="${SEQ_TRACK+1}" width="${Math.max(1,bw-1)}" height="18" rx="1" fill="${bc[b]||'#888'}" opacity="0.75"/>`;
      if(bw>11) svg+=`<text x="${bx+bw/2}" y="${SEQ_TRACK+14}" text-anchor="middle" fill="white" font-size="${Math.min(10,bw*0.8)}" font-weight="700">${b}</text>`;
    });
  } else {
    const CH=Math.ceil(visSeq.length/trackW);
    for(let px=0;px<trackW;px++){
      const chunk=visSeq.slice(px*CH,(px+1)*CH);
      const gc=chunk?(chunk.split('').filter(b=>b==='G'||b==='C').length/chunk.length):0;
      svg+=`<rect x="${PAD+px}" y="${SEQ_TRACK+20-gc*18}" width="1" height="${gc*18}" fill="#2563eb" opacity="0.5"/>`;
    }
    svg+=`<text x="${PAD+4}" y="${SEQ_TRACK+12}" fill="var(--text-3)" font-size="9">GC content track — zoom in to see individual bases</text>`;
  }
  svg+=`<text x="${PAD}" y="${SEQ_TRACK+36}" fill="var(--text-3)" font-size="9">${(viewStart+1).toLocaleString()} bp</text>`;
  svg+=`<text x="${W-PAD}" y="${SEQ_TRACK+36}" text-anchor="end" fill="var(--text-3)" font-size="9">${viewEnd.toLocaleString()} bp</text>`;
  svg+='</svg>';

  document.getElementById('gb-canvas-wrap').innerHTML=svg;
}

function exportGBsvg(){
  const el=document.getElementById('gb-svg');
  if(el) downloadSVG(el,'genome_browser.svg');
  else showToast('Render the browser first.','error');
}
