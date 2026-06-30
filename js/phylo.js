function phyloPanel(){
  const demo = window.sharedSeqs.length>=3
    ? window.sharedSeqs.slice(0,8).map(s=>`<div class="phylo-input-row"><input type="text" class="seq-name" value="${s.name}"><input type="text" class="seq-val" value="${s.seq.slice(0,150)}" style="font-family:var(--font-mono);font-size:11px;"></div>`).join('')
    : [['Human','ATGCGATCGATCGGCTATCGATCGATCGATCGATCG'],
       ['Chimpanzee','ATGCGATCGATCGGCTATCGATCGATCGATCGATCG'],
       ['Gorilla','ATGCGATCAATCGGCTATCGATCGGTCGATCGATCG'],
       ['Orangutan','ATGCGATCGATCGGCTATCGAGCGATCGATCGATCG'],
       ['Macaque','ATGCGATCGACCGGCTATCGATCGTTCGATCGATCG'],
       ['Mouse','ATGCGATCGACCGGCTTTCGAGCGTTCGATCGATCG']]
      .map(s=>`<div class="phylo-input-row"><input type="text" class="seq-name" value="${s[0]}"><input type="text" class="seq-val" value="${s[1]}" style="font-family:var(--font-mono);font-size:11px;"></div>`).join('');

  return `
  <div class="tool-intro">Neighbor-joining phylogenetic tree from multiple sequences. Computed entirely in your browser — nothing sent to a server. Enter 3–15 sequences of similar length.</div>
  <div id="seq-rows">${demo}</div>
  <div style="display:flex;gap:8px;margin:10px 0 14px;flex-wrap:wrap;">
    <button class="btn btn-sm" onclick="addSeqRow()"><i class="ti ti-plus"></i> Add row</button>
    <button class="btn btn-sm" onclick="removeLastRow()"><i class="ti ti-minus"></i> Remove last</button>
    <button class="btn btn-sm" onclick="loadFromImport()"><i class="ti ti-download"></i> Load from File Import</button>
  </div>
  <div class="input-group">
    <label>Distance method</label>
    <select id="dist-method" style="height:36px;">
      <option value="p">p-distance (raw fraction of differences)</option>
      <option value="jc">Jukes-Cantor correction</option>
    </select>
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" id="phylo-build-btn" onclick="runPhylo()"><i class="ti ti-binary-tree"></i> Build tree</button>
  </div>
  <div id="phylo-result" style="display:none;"></div>`;
}

let _seqRowCount=6;
function addSeqRow(){
  if(document.querySelectorAll('#seq-rows .phylo-input-row').length>=15){ showToast('Maximum 15 sequences.','error'); return; }
  _seqRowCount++;
  const div=document.createElement('div');
  div.className='phylo-input-row';
  div.innerHTML=`<input type="text" class="seq-name" value="Seq${_seqRowCount}" placeholder="Name"><input type="text" class="seq-val" placeholder="Sequence…" style="font-family:var(--font-mono);font-size:11px;">`;
  document.getElementById('seq-rows').appendChild(div);
}
function removeLastRow(){
  const rows=document.querySelectorAll('#seq-rows .phylo-input-row');
  if(rows.length>3) rows[rows.length-1].remove();
  else showToast('Minimum 3 sequences required.','error');
}
function loadFromImport(){
  if(!window.sharedSeqs.length){ showToast('No sequences imported yet. Use File Import first.','error'); return; }
  const c=document.getElementById('seq-rows'); c.innerHTML='';
  window.sharedSeqs.slice(0,15).forEach(s=>{
    const div=document.createElement('div');
    div.className='phylo-input-row';
    div.innerHTML=`<input type="text" class="seq-name" value="${s.name}"><input type="text" class="seq-val" value="${s.seq.slice(0,300)}" style="font-family:var(--font-mono);font-size:11px;">`;
    c.appendChild(div);
  });
  showToast(`Loaded ${Math.min(window.sharedSeqs.length,15)} sequences`,'success');
}

function pDist(a,b){const n=Math.min(a.length,b.length);if(!n)return 1;let d=0;for(let i=0;i<n;i++)if(a[i]!==b[i])d++;return d/n;}
function jcDist(a,b){const p=pDist(a,b);return p>=0.75?2:-0.75*Math.log(1-4/3*p);}

function neighborJoining(taxa,origD){
  let D=origD.map(r=>[...r]);
  let labels=[...taxa];
  let nodes=labels.map(l=>({name:l,children:[],bl:0}));
  let n=labels.length;
  while(n>2){
    const rowSums=D.map((row,i)=>row.reduce((s,v,j)=>i!==j?s+v:s,0));
    let minQ=Infinity,mi=0,mj=1;
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
      const q=(n-2)*D[i][j]-rowSums[i]-rowSums[j];
      if(q<minQ){minQ=q;mi=i;mj=j;}
    }
    const dij=D[mi][mj];
    const bli=dij/2+(rowSums[mi]-rowSums[mj])/(2*(n-2));
    const blj=dij-bli;
    const newNode={name:`(${labels[mi]},${labels[mj]})`,children:[
      {...nodes[mi],bl:Math.max(0,bli)},{...nodes[mj],bl:Math.max(0,blj)}
    ],bl:0};
    const keep=[...Array(n).keys()].filter(k=>k!==mi&&k!==mj);
    const newRow=keep.map(k=>(D[mi][k]+D[mj][k]-dij)/2);
    const newD=keep.map((i,ri)=>keep.map((j,rj)=>D[i][j]));
    newD.forEach((r,ri)=>r.push(newRow[ri]));
    newD.push([...newRow,0]);
    labels=keep.map(i=>labels[i]); labels.push(newNode.name);
    nodes=keep.map(i=>nodes[i]); nodes.push(newNode);
    D=newD; n=labels.length;
  }
  return {name:'root',children:[{...nodes[0],bl:D[0][1]/2},{...nodes[1],bl:D[0][1]/2}],bl:0};
}

function layoutTree(root){
  const leaves=[];
  (function collect(n){ if(!n.children||!n.children.length){leaves.push(n);return;} n.children.forEach(collect); })(root);
  leaves.forEach((l,i)=>l._y=i);
  (function assignX(n,x){ n._x=x; if(n.children) n.children.forEach(c=>assignX(c,x+(c.bl||0))); })(root,0);
  (function assignY(n){ if(!n.children||!n.children.length) return n._y; const ys=n.children.map(assignY); n._y=ys.reduce((a,b)=>a+b,0)/ys.length; return n._y; })(root);
  let maxX=0;
  (function gm(n){ maxX=Math.max(maxX,n._x); if(n.children) n.children.forEach(gm); })(root);
  return {leaves,maxX};
}

function drawTreeSVG(root,nLeaves){
  const W=600,PAD_L=20,PAD_R=170,PAD_T=20,PAD_B=24,trackW=W-PAD_L-PAD_R;
  const ROW_H=Math.max(22,Math.min(38,420/nLeaves));
  const H=nLeaves*ROW_H+PAD_T+PAD_B;
  const{leaves,maxX}=layoutTree(root);
  const xScale=maxX>0?trackW/maxX:trackW;
  const toX=x=>PAD_L+x*xScale, toY=y=>PAD_T+y*ROW_H+ROW_H/2;
  const parts=[`<svg id="phylo-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;overflow:visible;">`];

  function drawNode(node){
    const cx=toX(node._x), cy=toY(node._y);
    if(node.children&&node.children.length){
      node.children.forEach(child=>{
        const chx=toX(child._x), chy=toY(child._y);
        parts.push(`<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${chy}" stroke="var(--border-md)" stroke-width="1.5"/>`);
        parts.push(`<line x1="${cx}" y1="${chy}" x2="${chx}" y2="${chy}" stroke="var(--border-md)" stroke-width="1.5"/>`);
        if(child.bl>0.0001) parts.push(`<text x="${(cx+chx)/2}" y="${chy-3}" text-anchor="middle" fill="var(--text-3)" font-size="8">${child.bl.toFixed(3)}</text>`);
        drawNode(child);
      });
      parts.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="var(--text-3)" opacity="0.5"/>`);
    } else {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="5" fill="#2563eb" stroke="var(--surface)" stroke-width="1.5"/>`);
      parts.push(`<text x="${cx+10}" y="${cy+4}" fill="var(--text)" font-size="12" font-weight="600">${node.name}</text>`);
    }
  }
  drawNode(root);

  const scaleLen=maxX*0.1, sbX1=PAD_L, sbX2=PAD_L+scaleLen*xScale, sbY=H-8;
  parts.push(`<line x1="${sbX1}" y1="${sbY}" x2="${sbX2}" y2="${sbY}" stroke="var(--text-2)" stroke-width="1.5"/>`);
  parts.push(`<text x="${(sbX1+sbX2)/2}" y="${sbY-4}" text-anchor="middle" fill="var(--text-3)" font-size="9">${scaleLen.toFixed(3)}</text>`);
  parts.push('</svg>');
  return parts.join('');
}

function buildDistTable(taxa,D){
  const th=`<tr><th style="padding:5px 8px;"></th>${taxa.map(t=>`<th style="padding:5px 8px;font-size:11px;color:var(--text-2)">${t}</th>`).join('')}</tr>`;
  const rows=taxa.map((t,i)=>`<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 8px;font-weight:700;color:var(--accent)">${t}</td>${
    D[i].map((v,j)=>`<td style="padding:5px 8px;font-size:11px;text-align:right;color:${i===j?'var(--text-3)':'var(--text)'};">${i===j?'—':v.toFixed(3)}</td>`).join('')
  }</tr>`).join('');
  return `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead style="border-bottom:1px solid var(--border);">${th}</thead><tbody>${rows}</tbody></table></div>`;
}

function runPhylo(){
  const nameEls=document.querySelectorAll('.seq-name');
  const seqEls=document.querySelectorAll('.seq-val');
  const taxa=[],seqs=[];
  nameEls.forEach((n,i)=>{
    const name=n.value.trim(), seq=seqEls[i].value.toUpperCase().replace(/\s/g,'');
    if(name&&seq.length>=4){taxa.push(name);seqs.push(seq);}
  });
  if(taxa.length<3){ showToast('Enter at least 3 valid sequences (name + ≥4 bp).','error'); return; }
  if(taxa.length>15){ showToast('Maximum 15 sequences supported.','error'); return; }

  // Loading state
  const btn=document.getElementById('phylo-build-btn');
  const origLabel=btn.innerHTML;
  btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite;"></i> Computing…';
  btn.disabled=true;

  setTimeout(()=>{
    try {
      const method=document.getElementById('dist-method').value;
      const distFn=method==='jc'?jcDist:pDist;
      const D=taxa.map((_,i)=>taxa.map((_,j)=>i===j?0:distFn(seqs[i],seqs[j])));
      const tree=neighborJoining(taxa,D);
      const svg=drawTreeSVG(tree,taxa.length);
      const meanDist=D.flat().filter(v=>v>0).reduce((s,v)=>s+v,0)/(taxa.length*(taxa.length-1));

      const el=document.getElementById('phylo-result');
      el.style.display='block';
      el.innerHTML=`
        ${statGrid([
          {v:taxa.length, l:'Sequences'},
          {v:method==='jc'?'Jukes-Cantor':'p-distance', l:'Distance model'},
          {v:Math.round(seqs.reduce((s,x)=>s+x.length,0)/seqs.length), l:'Avg. length (bp)'},
          {v:meanDist.toFixed(4), l:'Mean distance'},
        ])}
        ${card('Neighbor-joining tree', svg, exportBtn('SVG','exportPhyloSVG()')+'  '+exportBtn('Newick','exportPhyloNewick()'))}
        ${card('Pairwise distance matrix', buildDistTable(taxa,D), exportBtn('CSV','exportPhyloDistCSV()'))}
      `;
      window._phyloData={taxa,D,tree};
      showToast('Tree built successfully!','success');
    } catch(e) {
      showToast('Error building tree: '+e.message,'error');
    } finally {
      btn.innerHTML=origLabel;
      btn.disabled=false;
    }
  }, 50);
}

function toNewick(node){
  if(!node.children||!node.children.length) return node.name;
  return '('+node.children.map(c=>toNewick(c)+':'+(c.bl||0).toFixed(4)).join(',')+')';
}
function exportPhyloNewick(){
  if(!window._phyloData) return;
  downloadText(toNewick(window._phyloData.tree)+';','tree.nwk');
}
function exportPhyloSVG(){
  const el=document.getElementById('phylo-svg');
  if(el) downloadSVG(el,'phylo_tree.svg');
}
function exportPhyloDistCSV(){
  if(!window._phyloData) return;
  const{taxa,D}=window._phyloData;
  downloadCSV([['',...taxa],...taxa.map((t,i)=>[t,...D[i].map(v=>v.toFixed(4))])],'distance_matrix.csv');
}
