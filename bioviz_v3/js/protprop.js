const AA_MW={A:89.09,R:174.20,N:132.12,D:133.10,C:121.16,Q:146.15,E:147.13,G:75.03,H:155.16,I:131.17,L:131.17,K:146.19,M:149.21,F:165.19,P:115.13,S:105.09,T:119.12,W:204.23,Y:181.19,V:117.15};
const AA_PKA={D:3.9,E:4.1,C:8.3,Y:10.1,H:6.0,K:10.5,R:12.5};
const AA_HYDRO={A:1.8,R:-4.5,N:-3.5,D:-3.5,C:2.5,Q:-3.5,E:-3.5,G:-0.4,H:-3.2,I:4.5,L:3.8,K:-3.9,M:1.9,F:2.8,P:-1.6,S:-0.8,T:-0.7,W:-0.9,Y:-1.3,V:4.2};
const AA3TO1={Ala:'A',Arg:'R',Asn:'N',Asp:'D',Cys:'C',Gln:'Q',Glu:'E',Gly:'G',His:'H',Ile:'I',Leu:'L',Lys:'K',Met:'M',Phe:'F',Pro:'P',Ser:'S',Thr:'T',Trp:'W',Tyr:'Y',Val:'V'};
const AA1TO3=Object.fromEntries(Object.entries(AA3TO1).map(([k,v])=>[v,k]));

function protpropPanel(){
  return `
  <div class="tool-intro">Calculate molecular weight, isoelectric point, Kyte-Doolittle hydrophobicity, and amino acid composition from a protein or translated DNA sequence.</div>
  <div style="display:flex;gap:8px;margin-bottom:12px;">
    <button class="btn btn-primary" id="pp-mode-prot" onclick="setPPMode('prot')"><i class="ti ti-atom"></i> Protein sequence</button>
    <button class="btn" id="pp-mode-dna"  onclick="setPPMode('dna')"><i class="ti ti-dna"></i> Translate DNA</button>
  </div>
  <div id="pp-prot-input">
    <div class="input-group">
      <label>Protein sequence (one-letter code)</label>
      <textarea id="pp-prot" rows="4" placeholder="MAEGEITTFTALTEKFNLPPGNY…" style="font-family:var(--font-mono);font-size:12px;"></textarea>
    </div>
  </div>
  <div id="pp-dna-input" style="display:none;">
    <div class="input-group"><label>DNA coding sequence</label>${seqTextarea('pp-dna',4,getSharedSeq(DEMO_SEQS.coding))}</div>
    <div class="input-group"><label>Reading frame</label><select id="pp-frame" style="height:36px;"><option value="0">+1</option><option value="1">+2</option><option value="2">+3</option></select></div>
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runProtProp()"><i class="ti ti-calculator"></i> Calculate</button>
    <button class="btn" onclick="loadProtDemo()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="pp-result" style="display:none;"></div>`;
}

function setPPMode(mode){
  document.getElementById('pp-prot-input').style.display=mode==='prot'?'block':'none';
  document.getElementById('pp-dna-input').style.display=mode==='dna'?'block':'none';
  document.getElementById('pp-mode-prot').className='btn'+(mode==='prot'?' btn-primary':'');
  document.getElementById('pp-mode-dna').className='btn'+(mode==='dna'?' btn-primary':'');
}

function loadProtDemo(){
  setPPMode('prot');
  document.getElementById('pp-prot').value='MSHHWGYGKHNGPEHWHKDFPIAKGERQSPVDIDTHTAKYDPSLKPLSVSYDQATSLRILNNGAAFNVEFD';
  runProtProp();
}

function getProteinSeq(){
  const mode=document.getElementById('pp-dna-input').style.display==='none'?'prot':'dna';
  if(mode==='prot') return document.getElementById('pp-prot').value.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g,'');
  const dna=cleanDNA(document.getElementById('pp-dna').value);
  const frame=parseInt(document.getElementById('pp-frame').value)||0;
  let prot='';
  for(let i=frame;i<dna.length-2;i+=3){
    const aa=CODON_TABLE[dna.slice(i,i+3)]; if(!aa||aa==='*') break;
    prot+=AA3TO1[aa]||aa.slice(0,1);
  }
  return prot;
}

function calcMW(seq){ return seq.split('').reduce((s,aa)=>s+(AA_MW[aa]||110),0)-(seq.length-1)*18.02; }

function calcPI(seq){
  const cnt={};
  seq.split('').forEach(aa=>cnt[aa]=(cnt[aa]||0)+1);
  for(let pH=0;pH<=14;pH+=0.01){
    let charge=1/(1+Math.pow(10,pH-8.0))-1/(1+Math.pow(10,3.1-pH));
    ['R','K','H'].forEach(aa=>{ if(cnt[aa]) charge+=cnt[aa]/(1+Math.pow(10,pH-AA_PKA[aa])); });
    ['D','E','C','Y'].forEach(aa=>{ if(cnt[aa]) charge-=cnt[aa]/(1+Math.pow(10,AA_PKA[aa]-pH)); });
    if(charge<0) return pH.toFixed(2);
  }
  return '14.00';
}

function calcHydro(seq,win=9){
  const scores=[];
  for(let i=0;i<=seq.length-win;i++)
    scores.push(seq.slice(i,i+win).split('').reduce((s,aa)=>s+(AA_HYDRO[aa]||0),0)/win);
  return scores;
}

function runProtProp(){
  const seq=getProteinSeq();
  if(seq.length<2){ showToast('Enter or translate a protein sequence first.','error'); return; }
  const mw=calcMW(seq), pi=calcPI(seq), hydro=calcHydro(seq);
  const cnt={};
  seq.split('').forEach(aa=>cnt[aa]=(cnt[aa]||0)+1);
  const ext=(cnt.W||0)*5500+(cnt.Y||0)*1490+(cnt.C||0)*125;
  const avgH=(hydro.reduce((s,v)=>s+v,0)/Math.max(hydro.length,1)).toFixed(2);
  const sortedAA=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);

  const el=document.getElementById('pp-result');
  el.style.display='block';
  el.innerHTML=`
    ${statGrid([
      {v:seq.length+' aa', l:'Length'},
      {v:(mw/1000).toFixed(2)+' kDa', l:'Mol. weight'},
      {v:pi, l:'pI (isoelectric pt)'},
      {v:ext.toLocaleString(), l:'Ext. coeff (M⁻¹cm⁻¹)'},
      {v:avgH, l:'Avg hydrophobicity'},
      {v:parseFloat(avgH)>0?'Hydrophobic':'Hydrophilic', l:'Character'},
    ])}
    ${card('Hydrophobicity profile (Kyte-Doolittle, window=9)',`<div class="chart-wrap" style="height:170px;"><canvas id="hydro-chart"></canvas></div>`,
      exportBtn('PNG','downloadCanvasPNG("hydro-chart","hydrophobicity.png")')+'  '+exportBtn('CSV','exportPPcsv()'))}
    ${card('Amino acid composition',`
      <div style="display:flex;flex-direction:column;gap:3px;">
        ${sortedAA.map(([aa,c])=>`
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-family:var(--font-mono);font-weight:700;color:var(--accent);width:18px;">${aa}</span>
            <span style="font-size:11px;color:var(--text-3);width:55px;">${AA1TO3[aa]||'?'}</span>
            <div style="flex:1;height:9px;background:var(--surface-2);border-radius:100px;overflow:hidden;border:1px solid var(--border);">
              <div style="height:100%;width:${c/seq.length*100}%;background:var(--accent);border-radius:100px;opacity:0.7;"></div>
            </div>
            <span style="font-size:11px;width:22px;text-align:right;">${c}</span>
            <span style="font-size:10px;color:var(--text-3);width:38px;text-align:right;">${(c/seq.length*100).toFixed(1)}%</span>
          </div>`).join('')}
      </div>
    `)}
    ${card('Sequence',`<div class="seq-display" style="font-family:var(--font-mono);word-break:break-all;letter-spacing:0.05em;">${seq}</div>`,
      exportBtn('FASTA','exportPPfasta()'))}
  `;

  const ctx=document.getElementById('hydro-chart').getContext('2d');
  window._charts.hydro=new Chart(ctx,{
    type:'line',
    data:{labels:hydro.map((_,i)=>i+5),datasets:[{
      label:'Hydrophobicity',data:hydro,
      borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,0.07)',
      borderWidth:1.5,pointRadius:0,fill:true,
      segment:{borderColor:c=>c.p0.parsed.y>0?'#2563eb':'#dc2626'}
    }]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>`${c.parsed.y.toFixed(2)} (${c.parsed.x+4}–${c.parsed.x+12})`}}},
      scales:{x:{ticks:{color:'#888',maxTicksLimit:10}},y:{ticks:{color:'#888'},
        grid:{color:c=>c.tick.value===0?'rgba(0,0,0,0.2)':'rgba(128,128,128,0.06)'}
      }}}
  });
  window._ppData={seq,mw,pi,ext,cnt,hydro};
}

function exportPPcsv(){
  if(!window._ppData) return;
  const {seq,mw,pi,ext,cnt,hydro}=window._ppData;
  downloadCSV([
    ['Property','Value'],
    ['Length (aa)',seq.length],['MW (Da)',mw.toFixed(2)],['pI',pi],['Ext coeff',ext],
    ['Avg hydrophobicity',(hydro.reduce((s,v)=>s+v,0)/hydro.length).toFixed(3)],
    [],['Amino acid','Count','Percent'],
    ...Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([aa,c])=>[AA1TO3[aa]||aa,c,(c/seq.length*100).toFixed(2)])
  ],'protein_properties.csv');
}
function exportPPfasta(){
  if(!window._ppData) return;
  downloadFasta([{name:'protein',seq:window._ppData.seq}],'protein.fasta');
}
