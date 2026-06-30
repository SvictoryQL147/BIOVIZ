function mutationPanel(){
  return `
  <div class="tool-intro">Introduce point mutations, insertions, or deletions into a coding DNA sequence. BioViz shows the original vs mutant codon, amino acid change, and classifies the mutation type (synonymous, missense, nonsense, frameshift).</div>
  <div class="input-group"><label>Original DNA sequence</label>${seqTextarea('mut-seq',4,DEMO_SEQS.coding)}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
    <div class="input-group" style="margin:0"><label>Mutation type</label>
      <select id="mut-type" style="height:36px;" onchange="updateMutUI()">
        <option value="sub">Substitution</option>
        <option value="ins">Insertion</option>
        <option value="del">Deletion</option>
      </select>
    </div>
    <div class="input-group" style="margin:0"><label>Position (1-based)</label>
      <input type="number" id="mut-pos" value="4" min="1" style="height:36px;">
    </div>
    <div class="input-group" style="margin:0" id="mut-new-wrap"><label id="mut-new-lbl">New nucleotide</label>
      <input type="text" id="mut-new" value="A" placeholder="A / G / ATG…" style="height:36px;font-family:var(--font-mono);">
    </div>
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runMutation()"><i class="ti ti-pencil"></i> Apply mutation</button>
    <button class="btn" onclick="runRandomMutations()"><i class="ti ti-dice"></i> Random ×5</button>
    <button class="btn" onclick="document.getElementById('mut-seq').value=DEMO_SEQS.coding"><i class="ti ti-refresh"></i> Reset</button>
  </div>
  <div id="mut-result" style="display:none;"></div>`;
}

function updateMutUI(){
  const type=document.getElementById('mut-type').value;
  const lbl=document.getElementById('mut-new-lbl');
  const inp=document.getElementById('mut-new');
  if(type==='sub'){lbl.textContent='New nucleotide';inp.placeholder='A / G / C / T';}
  if(type==='ins'){lbl.textContent='Insert sequence';inp.placeholder='ATG…';}
  if(type==='del'){lbl.textContent='Delete N bases'; inp.placeholder='1';}
}

function applyMutation(seq,type,pos,nv){
  const i=Math.max(0,Math.min(pos-1,seq.length-1));
  if(type==='sub') return seq.slice(0,i)+nv.slice(0,1).toUpperCase()+seq.slice(i+1);
  if(type==='ins') return seq.slice(0,i)+nv.toUpperCase()+seq.slice(i);
  if(type==='del') return seq.slice(0,i)+seq.slice(i+(parseInt(nv)||1));
  return seq;
}

function classifyMutation(orig,mut,pos,type,nv){
  if(type==='ins'||type==='del'){
    const n=type==='ins'?nv.length:(parseInt(nv)||1);
    return n%3!==0?'Frameshift':'In-frame indel';
  }
  const ci=Math.floor((pos-1)/3);
  const oc=orig.slice(ci*3,ci*3+3), mc=mut.slice(ci*3,ci*3+3);
  if(oc.length<3||mc.length<3) return 'Unknown';
  const oAA=CODON_TABLE[oc]||'?', mAA=CODON_TABLE[mc]||'?';
  if(oAA===mAA) return 'Synonymous (silent)';
  if(mAA==='*') return 'Nonsense (premature stop)';
  if(oAA==='*') return 'Stop loss';
  return 'Missense';
}

function translateFull(seq){
  const MAP={Ala:'A',Arg:'R',Asn:'N',Asp:'D',Cys:'C',Gln:'Q',Glu:'E',Gly:'G',His:'H',Ile:'I',Leu:'L',Lys:'K',Met:'M',Phe:'F',Pro:'P',Ser:'S',Thr:'T',Trp:'W',Tyr:'Y',Val:'V'};
  let p='';
  for(let i=0;i<seq.length-2;i+=3){const aa=CODON_TABLE[seq.slice(i,i+3)];if(!aa||aa==='*'){p+='*';break;}p+=MAP[aa]||'?';}
  return p;
}

function diffSeqHTML(a,b){
  const len=Math.max(a.length,b.length); let html='';
  for(let i=0;i<len;i++){
    const ca=a[i]||'-', cb=b[i]||'-';
    if(ca!==cb) html+=`<span style="background:#fee2e2;color:#dc2626;font-weight:700;border-radius:2px;">${cb}</span>`;
    else html+=`<span class="${{A:'base-A',T:'base-T',C:'base-C',G:'base-G'}[cb]||''}">${cb}</span>`;
  }
  return html;
}

function runMutation(){
  const seq=cleanDNA(document.getElementById('mut-seq').value);
  const type=document.getElementById('mut-type').value;
  const pos=parseInt(document.getElementById('mut-pos').value)||1;
  const nv=document.getElementById('mut-new').value.trim();
  if(!seq){ showToast('Enter a sequence.','error'); return; }
  if(pos<1||pos>seq.length){ showToast(`Position must be 1–${seq.length}.`,'error'); return; }
  if(!nv){ showToast('Enter a value for the mutation.','error'); return; }

  const mutSeq=applyMutation(seq,type,pos,nv);
  const mutClass=classifyMutation(seq,mutSeq,pos,type,nv);
  const ci=Math.floor((pos-1)/3);
  const oC=seq.slice(ci*3,ci*3+3), mC=mutSeq.slice(ci*3,ci*3+3);
  const oAA=CODON_TABLE[oC]||'?', mAA=CODON_TABLE[mC]||'?';
  const origProt=translateFull(seq), mutProt=translateFull(mutSeq);

  const colorMap={'Synonymous (silent)':'#16a34a','Missense':'#d97706',
    'Nonsense (premature stop)':'#dc2626','Frameshift':'#db2777','In-frame indel':'#2563eb','Stop loss':'#7c3aed'};
  const color=colorMap[mutClass]||'#888';

  const el=document.getElementById('mut-result');
  el.style.display='block';
  el.innerHTML=`
    <div style="padding:12px 16px;background:${color}18;border-left:3px solid ${color};border-radius:0 var(--radius) var(--radius) 0;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span style="font-weight:700;font-size:14px;color:${color};">${mutClass}</span>
      ${type==='sub'?`<span style="font-size:12px;color:var(--text-2);">Codon ${ci+1}: <strong>${oC}→${mC}</strong> &nbsp;·&nbsp; AA: <strong>${oAA}→${mAA}</strong></span>`:''}
    </div>
    ${statGrid([
      {v:type==='sub'?`${oC[pos-ci*3-1]}${pos}${nv}`:type==='ins'?`+${nv.length}bp`:'-'+nv+'bp', l:'Mutation'},
      {v:seq.length+' bp', l:'Original'},
      {v:mutSeq.length+' bp', l:'Mutant'},
      {v:origProt.replace('*','').length+' aa', l:'Orig. protein'},
      {v:mutProt.replace('*','').length+' aa', l:'Mut. protein'},
    ])}
    ${card('Sequence comparison',`
      <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">Original</div>
      <div class="seq-display">${colorSeq(seq)}</div>
      <div style="font-size:11px;color:var(--text-3);margin:8px 0 4px;">Mutant <span style="background:#fee2e2;color:#dc2626;padding:1px 5px;border-radius:2px;font-size:10px;">changes in red</span></div>
      <div class="seq-display">${diffSeqHTML(seq,mutSeq)}</div>
    `, exportBtn('CSV','exportMutCSV()'))}
    ${card('Protein comparison',`
      <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;">Original protein</div>
      <div class="seq-display" style="font-family:var(--font-mono);">${origProt}</div>
      <div style="font-size:11px;color:var(--text-3);margin:8px 0 4px;">Mutant protein</div>
      <div class="seq-display" style="font-family:var(--font-mono);">${diffSeqHTML(origProt,mutProt)}</div>
    `)}
  `;
  window._mutData={seq,mutSeq,type,pos,nv,mutClass,oAA,mAA,oC,mC,origProt,mutProt};
}

function runRandomMutations(){
  const seq=cleanDNA(document.getElementById('mut-seq').value);
  if(!seq){ showToast('Enter a sequence first.','error'); return; }
  let mutated=seq;
  const log=[];
  const bases=['A','T','G','C'];
  for(let m=0;m<5;m++){
    const pos=Math.floor(Math.random()*mutated.length)+1;
    const newBase=bases.filter(b=>b!==mutated[pos-1])[Math.floor(Math.random()*3)];
    mutated=applyMutation(mutated,'sub',pos,newBase);
    log.push(`${seq[pos-1]||'?'}${pos}${newBase}`);
  }
  document.getElementById('mut-seq').value=mutated;
  showToast('Applied 5 random mutations: '+log.join(', '),'info');
  runMutation();
}

function exportMutCSV(){
  if(!window._mutData) return;
  const d=window._mutData;
  downloadCSV([
    ['Field','Value'],
    ['Mutation type',d.type],['Position',d.pos],['Change',d.nv],
    ['Classification',d.mutClass],['Original codon',d.oC],['Mutant codon',d.mC],
    ['Original AA',d.oAA],['Mutant AA',d.mAA],
    ['Original seq length',d.seq.length],['Mutant seq length',d.mutSeq.length],
    ['Original protein',d.origProt],['Mutant protein',d.mutProt],
  ],'mutation_report.csv');
}
