function orfPanel() {
  return `
  <div class="tool-intro">Scans all 6 reading frames (+1,+2,+3,−1,−2,−3) for open reading frames (ATG…stop codon). Reports start, stop, length, and translated protein for each ORF found.</div>
  <div class="input-group">
    <label>DNA sequence</label>
    ${seqTextarea('orf-seq', 5, getSharedSeq(DEMO_SEQS.lambda))}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
    <div class="input-group" style="margin:0"><label>Min ORF length (aa)</label><input type="number" id="orf-minlen" value="10" min="1" style="height:36px;"></div>
    <div class="input-group" style="margin:0"><label>Frames</label>
      <select id="orf-frames" style="height:36px;">
        <option value="3">Forward only (+1,+2,+3)</option>
        <option value="6" selected>All 6 frames</option>
      </select>
    </div>
    <div class="input-group" style="margin:0"><label>Strand display</label>
      <select id="orf-stopinclude" style="height:36px;">
        <option value="no" selected>Exclude stop codon</option>
        <option value="yes">Include stop codon</option>
      </select>
    </div>
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runORF()"><i class="ti ti-scan"></i> Find ORFs</button>
    <button class="btn" onclick="document.getElementById('orf-seq').value=DEMO_SEQS.lambda;runORF()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="orf-result" style="display:none;"></div>`;
}

const RC = {A:'T',T:'A',G:'C',C:'G',N:'N'};
function revCompStr(s){ return s.split('').reverse().map(b=>RC[b]||b).join(''); }

function translateStr(dna) {
  const MAP = {Ala:'A',Arg:'R',Asn:'N',Asp:'D',Cys:'C',Gln:'Q',Glu:'E',Gly:'G',His:'H',
    Ile:'I',Leu:'L',Lys:'K',Met:'M',Phe:'F',Pro:'P',Ser:'S',Thr:'T',Trp:'W',Tyr:'Y',Val:'V'};
  let p='';
  for (let i=0;i<dna.length-2;i+=3){
    const aa=CODON_TABLE[dna.slice(i,i+3)];
    if (!aa||aa==='*') break;
    p+=MAP[aa]||aa.slice(0,1);
  }
  return p||'?';
}

function findORFs(seq, minAA, allFrames) {
  const STOP = new Set(['TAA','TAG','TGA']);
  const results = [];
  const strands = allFrames ? [[seq,'+'],[revCompStr(seq),'-']] : [[seq,'+']];
  strands.forEach(([s,strand])=>{
    for (let frame=0;frame<3;frame++){
      let inORF=false, start=-1;
      for (let i=frame;i<s.length-2;i+=3){
        const codon=s.slice(i,i+3);
        if (!inORF && codon==='ATG'){ inORF=true; start=i; }
        else if (inORF && STOP.has(codon)){
          const orfDNA=s.slice(start,i+3);
          const lenAA=Math.floor((i-start)/3);
          if (lenAA>=minAA){
            const gStart=strand==='+'?start:seq.length-(i+3);
            const gEnd  =strand==='+'?i+3  :seq.length-start;
            results.push({ strand, frame:strand==='+'?frame+1:-(frame+1),
              start:gStart+1, end:gEnd, lenBP:orfDNA.length, lenAA,
              protein:translateStr(orfDNA), stopCodon:codon });
          }
          inORF=false; start=-1;
        }
      }
    }
  });
  return results.sort((a,b)=>b.lenAA-a.lenAA);
}

function buildORFMap(seq, orfs) {
  const W=620, PAD=30, H=130, trackW=W-PAD*2;
  const toX=p=>PAD+(p/seq.length)*trackW;
  const fwdColors=['#2563eb','#16a34a','#d97706'];
  const revColors=['#dc2626','#db2777','#7c3aed'];
  let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%">`;
  svg+=`<rect x="${PAD}" y="${H/2-2}" width="${trackW}" height="4" rx="2" fill="var(--border-md)"/>`;
  [0,.25,.5,.75,1].forEach(t=>{
    const x=PAD+t*trackW, pos=Math.round(t*seq.length);
    svg+=`<line x1="${x}" y1="${H/2+4}" x2="${x}" y2="${H/2+12}" stroke="var(--text-3)" stroke-width="1"/>`;
    svg+=`<text x="${x}" y="${H/2+22}" text-anchor="middle" fill="var(--text-3)" font-size="9">${pos}</text>`;
  });
  orfs.slice(0,30).forEach((o,i)=>{
    const isFwd=o.strand==='+';
    const color=isFwd?fwdColors[(Math.abs(o.frame)-1)%3]:revColors[(Math.abs(o.frame)-1)%3];
    const x1=toX(o.start-1), x2=toX(o.end);
    const y=isFwd?H/2-16-(i%3)*14:H/2+8+(i%3)*14;
    svg+=`<rect x="${x1}" y="${y}" width="${Math.max(2,x2-x1)}" height="10" rx="2" fill="${color}" opacity="0.85">
      <title>Frame ${o.strand}${Math.abs(o.frame)}: pos ${o.start}–${o.end} · ${o.lenAA} aa</title></rect>`;
  });
  svg+=`<text x="${PAD}" y="12" font-size="9" fill="#2563eb" font-weight="600">+ strand</text>`;
  svg+=`<text x="${PAD}" y="${H-4}" font-size="9" fill="#dc2626" font-weight="600">− strand</text>`;
  return svg+'</svg>';
}

function runORF() {
  const raw   = cleanDNA(document.getElementById('orf-seq').value);
  const minAA = parseInt(document.getElementById('orf-minlen').value)||10;
  const frames= document.getElementById('orf-frames').value==='6';
  if (!raw||raw.length<9){ showToast('Enter a sequence of at least 9 bases.','error'); return; }

  const orfs = findORFs(raw, minAA, frames);
  const el   = document.getElementById('orf-result');
  el.style.display='block';

  if (!orfs.length) {
    el.innerHTML=`<div class="error-msg"><i class="ti ti-info-circle"></i>No ORFs found with minimum length ${minAA} aa in ${frames?'6':'3'} frame(s). Try reducing the minimum length.</div>`;
    return;
  }

  el.innerHTML=`
    ${statGrid([
      {v:orfs.length, l:'ORFs found'},
      {v:orfs[0].lenAA+' aa', l:'Longest ORF'},
      {v:raw.length.toLocaleString()+' bp', l:'Seq. length'},
      {v:frames?'6':'3', l:'Frames searched'},
    ])}
    ${card('ORF map', buildORFMap(raw,orfs), exportBtn('SVG','exportORFmap()'))}
    ${card(`ORF table — top ${Math.min(orfs.length,100)}`,`
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="padding:6px 8px;text-align:left">#</th>
          <th style="padding:6px 8px;text-align:left">Frame</th>
          <th style="padding:6px 8px;text-align:left">Start</th>
          <th style="padding:6px 8px;text-align:left">End</th>
          <th style="padding:6px 8px;text-align:left">bp</th>
          <th style="padding:6px 8px;text-align:left">aa</th>
          <th style="padding:6px 8px;text-align:left">Protein</th>
        </tr></thead>
        <tbody>${orfs.slice(0,100).map((o,i)=>`
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:5px 8px;font-weight:700;color:var(--accent)">${i+1}</td>
            <td style="padding:5px 8px;"><span style="font-size:10px;padding:2px 6px;border-radius:100px;background:${o.strand==='+'?'#eff6ff':'#fff1f2'};color:${o.strand==='+'?'#2563eb':'#dc2626'}">${o.strand}${Math.abs(o.frame)}</span></td>
            <td style="padding:5px 8px;font-family:var(--font-mono)">${o.start.toLocaleString()}</td>
            <td style="padding:5px 8px;font-family:var(--font-mono)">${o.end.toLocaleString()}</td>
            <td style="padding:5px 8px;">${o.lenBP}</td>
            <td style="padding:5px 8px;font-weight:600;">${o.lenAA}</td>
            <td style="padding:5px 8px;font-family:var(--font-mono);font-size:10px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${o.protein}">${o.protein.slice(0,18)}${o.protein.length>18?'…':''}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    `, exportBtn('CSV','exportORFcsv()')+'  '+exportBtn('FASTA','exportORFfasta()'))}
  `;
  window._orfData={raw,orfs};
}

function exportORFcsv(){
  if(!window._orfData) return;
  downloadCSV([['#','Frame','Start','End','Length_bp','Length_aa','Stop_codon','Protein'],
    ...window._orfData.orfs.map((o,i)=>[i+1,o.strand+Math.abs(o.frame),o.start,o.end,o.lenBP,o.lenAA,o.stopCodon,o.protein])
  ],'orfs.csv');
}
function exportORFfasta(){
  if(!window._orfData) return;
  downloadFasta(window._orfData.orfs.map((o,i)=>({
    name:`ORF${i+1}_frame${o.strand}${Math.abs(o.frame)}_${o.start}-${o.end}_${o.lenAA}aa`,
    seq:o.protein
  })),'orfs.fasta');
}
function exportORFmap(){
  const svg=document.querySelector('#orf-result svg');
  if(svg) downloadSVG(svg,'orf_map.svg');
}
