// ── NCBI Sequence Fetch ────────────────────────────────────────────────────────
function ncbiFetchPanel() {
  return `
  <div class="tool-intro">
    Fetch any sequence directly from NCBI by accession number — GenBank, RefSeq, UniProt.
    No need to visit NCBI separately. Fetched sequences are automatically added to your
    shared sequence library for use in all other tools.
  </div>

  <div class="card" style="margin-bottom:14px;">
    <div class="card-header"><div class="card-title">Fetch by accession</div></div>
    <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;">
      <div class="input-group" style="margin:0;">
        <label>Accession number(s) — one per line or comma-separated</label>
        <textarea id="ncbi-acc" rows="3" placeholder="NM_007294&#10;NC_000913&#10;NP_000537" style="font-family:var(--font-mono);font-size:13px;"></textarea>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
      <div class="input-group" style="margin:0;flex:1;min-width:160px;">
        <label>Database</label>
        <select id="ncbi-db" style="height:36px;">
          <option value="nucleotide">Nucleotide (DNA/RNA)</option>
          <option value="protein">Protein</option>
        </select>
      </div>
      <div style="padding-top:20px;">
        <button class="btn btn-primary" onclick="runNCBIfetch()"><i class="ti ti-download"></i> Fetch from NCBI</button>
      </div>
    </div>
  </div>

  <div style="margin-bottom:14px;">
    ${card('Quick examples', `
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${[
          ['NM_007294','BRCA1 mRNA'],['NM_000546','TP53 mRNA'],['NC_000913','E. coli K-12'],
          ['NM_005228','EGFR mRNA'],['NP_000537','TP53 protein'],['NM_004985','KRAS mRNA'],
        ].map(([acc,label])=>`
          <button class="btn btn-sm" onclick="document.getElementById('ncbi-acc').value='${acc}';runNCBIfetch()">
            <i class="ti ti-dna"></i> ${acc} <span style="color:var(--text-3);font-size:10px;">${label}</span>
          </button>`).join('')}
      </div>
    `)}
  </div>

  <div id="ncbi-result" style="display:none;"></div>`;
}

async function runNCBIfetch() {
  const raw = document.getElementById('ncbi-acc').value.trim();
  const db  = document.getElementById('ncbi-db').value;
  if (!raw) { showToast('Enter at least one accession number.','error'); return; }

  const accessions = raw.split(/[\n,;]+/).map(a=>a.trim()).filter(Boolean);
  if (!accessions.length) { showToast('No valid accessions found.','error'); return; }
  if (accessions.length > 10) { showToast('Max 10 accessions at once to be kind to NCBI servers.','error'); return; }

  const el = document.getElementById('ncbi-result');
  el.style.display = 'block';
  el.innerHTML = `<div class="card"><div style="display:flex;align-items:center;gap:10px;padding:8px 0;">
    <i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite;color:var(--accent);font-size:20px;"></i>
    <span style="font-size:13px;color:var(--text-2);">Fetching from NCBI… (this may take 5–10 seconds)</span>
  </div></div>`;

  const fetched = [];
  const errors  = [];

  for (const acc of accessions) {
    try {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=${db}&id=${encodeURIComponent(acc)}&rettype=fasta&retmode=text&tool=bioviz&email=bioviz@example.com`;
      const res = await fetch(url);
      if (!res.ok) { errors.push(`${acc}: HTTP ${res.status}`); continue; }
      const text = await res.text();
      if (!text.startsWith('>')) { errors.push(`${acc}: No sequence returned (check accession)`); continue; }

      // Parse FASTA response
      const lines = text.split('\n');
      const header = lines[0].slice(1).trim();
      const seq    = lines.slice(1).join('').replace(/\s/g,'').toUpperCase();
      if (!seq) { errors.push(`${acc}: Empty sequence`); continue; }

      const entry = { name:acc, header, seq, type:'ncbi' };
      addSharedSeq(entry);
      fetched.push(entry);
    } catch(e) {
      if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        errors.push(`${acc}: Network error — check your internet connection`);
      } else {
        errors.push(`${acc}: ${e.message}`);
      }
    }
  }

  // Render results
  let html = '';
  if (fetched.length) {
    html += `<div class="success-msg"><i class="ti ti-check"></i>
      Successfully fetched <strong>${fetched.length}</strong> sequence(s) — added to shared library
    </div>`;
    html += card(`Fetched sequences`, `
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${fetched.map(s=>`
          <div style="padding:10px 14px;background:var(--surface-2);border-radius:var(--radius);border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div>
                <div style="font-weight:700;color:var(--accent);">${s.name}</div>
                <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${s.header.slice(0,120)}${s.header.length>120?'…':''}</div>
                <div style="font-size:11px;color:var(--text-2);margin-top:4px;">${s.seq.length.toLocaleString()} bp</div>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0;">
                <button class="btn btn-sm" onclick="downloadFasta([{name:'${s.name}',seq:'${s.seq.slice(0,50)}...'}],'${s.name}.fasta')" title="Download FASTA"><i class="ti ti-download"></i></button>
                <button class="btn btn-sm btn-primary" onclick="copyToTool('${s.name}')" title="Use in a tool"><i class="ti ti-arrow-right"></i> Use</button>
              </div>
            </div>
            <div class="seq-display" style="margin-top:8px;font-size:11px;">${colorSeq(s.seq,80)}</div>
          </div>`).join('')}
      </div>
    `, exportBtn('All as FASTA',`downloadFasta(window.sharedSeqs.filter(s=>s.type==='ncbi'),'ncbi_sequences.fasta')`));
  }

  if (errors.length) {
    html += `<div class="error-msg" style="flex-direction:column;align-items:flex-start;gap:4px;">
      <div style="display:flex;align-items:center;gap:8px;"><i class="ti ti-alert-circle"></i><strong>${errors.length} error(s):</strong></div>
      ${errors.map(e=>`<div style="font-size:12px;padding-left:24px;">${e}</div>`).join('')}
    </div>`;
  }

  el.innerHTML = html || '<div class="error-msg"><i class="ti ti-alert-circle"></i>No sequences fetched.</div>';
}

function copyToTool(seqName) {
  const seq = window.sharedSeqs.find(s=>s.name===seqName);
  if (!seq) return;
  showToast(`${seqName} added to shared library — switch to any tool and select it from the dropdown.`,'success');
}

// ── Primer Design ─────────────────────────────────────────────────────────────
function primerPanel() {
  return `
  <div class="tool-intro">
    Design PCR primers from a template sequence. BioViz finds all valid primer candidates,
    scores them by Tm, GC content, hairpin potential, and self-complementarity, then ranks them.
    Paste your template and set your parameters.
  </div>

  <div class="input-group">
    <label>Template DNA sequence (paste the region you want to amplify + flanking)</label>
    ${seqTextarea('primer-seq', 5, getSharedSeq('ATGCGATCGATCGGCTATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGGCTATCGGCGGCTATCGATAGCGATCGATCGATCGATCGGCTATCGA'))}
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:14px;">
    <div class="input-group" style="margin:0;"><label>Min primer length</label><input type="number" id="pr-minlen" value="18" min="15" max="35" style="height:36px;"></div>
    <div class="input-group" style="margin:0;"><label>Max primer length</label><input type="number" id="pr-maxlen" value="24" min="15" max="35" style="height:36px;"></div>
    <div class="input-group" style="margin:0;"><label>Min Tm (°C)</label><input type="number" id="pr-mintm" value="55" style="height:36px;"></div>
    <div class="input-group" style="margin:0;"><label>Max Tm (°C)</label><input type="number" id="pr-maxtm" value="65" style="height:36px;"></div>
    <div class="input-group" style="margin:0;"><label>Min GC%</label><input type="number" id="pr-mingc" value="40" style="height:36px;"></div>
    <div class="input-group" style="margin:0;"><label>Max GC%</label><input type="number" id="pr-maxgc" value="60" style="height:36px;"></div>
    <div class="input-group" style="margin:0;"><label>Product size min (bp)</label><input type="number" id="pr-prodmin" value="100" style="height:36px;"></div>
    <div class="input-group" style="margin:0;"><label>Product size max (bp)</label><input type="number" id="pr-prodmax" value="1000" style="height:36px;"></div>
  </div>

  <div class="btn-row">
    <button class="btn btn-primary" onclick="runPrimerDesign()"><i class="ti ti-search"></i> Design Primers</button>
    <button class="btn" onclick="document.getElementById('primer-seq').value=getSharedSeq('ATGCGATCGATCGGCTATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGGCTATCGGCGGCTATCGATAGCGATCGATCGATCGATCGGCTATCGA');runPrimerDesign()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="primer-result" style="display:none;"></div>`;
}

function calcTmNearest(seq) {
  // Nearest-neighbor method (simplified SantaLucia 1998)
  const NN = {
    AA:-7.9, AT:-7.2, AC:-8.4, AG:-7.8,
    TA:-7.2, TT:-7.9, TC:-8.2, TG:-8.5,
    CA:-8.5, CT:-7.8, CC:-8.0, CG:-10.6,
    GA:-8.2, GT:-8.4, GC:-9.8, GG:-8.0
  };
  const dH_NN = {
    AA:-7.9,AT:-7.2,AC:-8.4,AG:-7.8,TA:-7.2,TT:-7.9,TC:-8.2,TG:-8.5,
    CA:-8.5,CT:-7.8,CC:-8.0,CG:-10.6,GA:-8.2,GT:-8.4,GC:-9.8,GG:-8.0
  };
  const dS_NN = {
    AA:-22.2,AT:-20.4,AC:-22.4,AG:-21.0,TA:-21.3,TT:-22.2,TC:-22.2,TG:-22.7,
    CA:-22.7,CT:-21.0,CC:-19.9,CG:-27.2,GA:-22.2,GT:-22.4,GC:-24.4,GG:-19.9
  };
  let dH=-0.2, dS=-5.7; // initiation
  const s=seq.toUpperCase();
  for(let i=0;i<s.length-1;i++){
    const pair=s[i]+s[i+1];
    dH+=(dH_NN[pair]||NN[pair]||0);
    dS+=(dS_NN[pair]||0);
  }
  const R=1.987, c=250e-9; // 250nM primer concentration
  const tm=dH*1000/(dS+R*Math.log(c/4))-273.15;
  return Math.round(tm*10)/10;
}

function calcGC(seq) {
  const s=seq.toUpperCase();
  const gc=(s.split('').filter(b=>b==='G'||b==='C').length/s.length*100);
  return Math.round(gc*10)/10;
}

function checkHairpin(seq) {
  // Simple check: does the 3' end complement the 5' end?
  const s=seq.toUpperCase();
  const RC={A:'T',T:'A',G:'C',C:'G'};
  const half=Math.floor(s.length/2);
  let maxComp=0;
  for(let i=0;i<half-3;i++){
    const frag=s.slice(0,i+4);
    const rc=frag.split('').reverse().map(b=>RC[b]||b).join('');
    let comp=0;
    for(let j=0;j<rc.length&&j<s.length-i-4;j++) if(rc[j]===s[s.length-rc.length+j]) comp++;
    maxComp=Math.max(maxComp,comp);
  }
  return maxComp;
}

function checkSelfComp(seq) {
  const s=seq.toUpperCase();
  const RC={A:'T',T:'A',G:'C',C:'G'};
  const rc=s.split('').reverse().map(b=>RC[b]||b).join('');
  let max=0;
  for(let i=0;i<s.length-2;i++){
    let run=0;
    for(let j=0;j<s.length-i;j++){
      if(s[j]===rc[j+i]) run++;
      else run=0;
      max=Math.max(max,run);
    }
  }
  return max;
}

function scoreP(p) {
  // Lower is better
  let penalty = 0;
  if(p.tm<55||p.tm>70) penalty+=10;
  if(p.gc<40||p.gc>60) penalty+=8;
  if(p.hairpin>3) penalty+=p.hairpin*3;
  if(p.selfComp>4) penalty+=p.selfComp*2;
  if(p.seq.slice(-2).includes('A')||p.seq.slice(-2).includes('T')) penalty+=5; // 3' end GC clamp
  if(p.seq.endsWith('GG')||p.seq.endsWith('CC')) penalty-=5; // 3' GC clamp bonus
  return penalty;
}

function runPrimerDesign() {
  const raw    = cleanDNA(document.getElementById('primer-seq').value);
  const minLen = parseInt(document.getElementById('pr-minlen').value)||18;
  const maxLen = parseInt(document.getElementById('pr-maxlen').value)||24;
  const minTm  = parseFloat(document.getElementById('pr-mintm').value)||55;
  const maxTm  = parseFloat(document.getElementById('pr-maxtm').value)||65;
  const minGC  = parseFloat(document.getElementById('pr-mingc').value)||40;
  const maxGC  = parseFloat(document.getElementById('pr-maxgc').value)||60;
  const prodMin= parseInt(document.getElementById('pr-prodmin').value)||100;
  const prodMax= parseInt(document.getElementById('pr-prodmax').value)||1000;

  if (!raw||raw.length<50){ showToast('Enter a sequence of at least 50 bp.','error'); return; }

  // Find forward primers (from 5' end region)
  const fwdCandidates=[], revCandidates=[];
  const RC={A:'T',T:'A',G:'C',C:'G'};

  // Scan first 60% for forward primers
  const fwdZone = Math.floor(raw.length*0.6);
  for(let start=0; start<fwdZone; start++) {
    for(let len=minLen; len<=maxLen; len++) {
      if(start+len>raw.length) break;
      const seq=raw.slice(start,start+len);
      const tm=calcTmNearest(seq);
      const gc=calcGC(seq);
      if(tm<minTm||tm>maxTm) continue;
      if(gc<minGC||gc>maxGC) continue;
      const hairpin=checkHairpin(seq);
      const selfComp=checkSelfComp(seq);
      fwdCandidates.push({seq,start:start+1,end:start+len,len,tm,gc,hairpin,selfComp,strand:'+'});
    }
  }

  // Scan last 60% for reverse primers (on RC strand)
  const revStart = Math.floor(raw.length*0.4);
  for(let start=revStart; start<raw.length; start++) {
    for(let len=minLen; len<=maxLen; len++) {
      if(start+len>raw.length) break;
      const fwdSeq=raw.slice(start,start+len);
      const seq=fwdSeq.split('').reverse().map(b=>RC[b]||b).join('');
      const tm=calcTmNearest(seq);
      const gc=calcGC(seq);
      if(tm<minTm||tm>maxTm) continue;
      if(gc<minGC||gc>maxGC) continue;
      const hairpin=checkHairpin(seq);
      const selfComp=checkSelfComp(seq);
      revCandidates.push({seq,start:start+1,end:start+len,len,tm,gc,hairpin,selfComp,strand:'-'});
    }
  }

  // Score and sort
  fwdCandidates.sort((a,b)=>scoreP(a)-scoreP(b));
  revCandidates.sort((a,b)=>scoreP(a)-scoreP(b));

  // Build pairs
  const pairs=[];
  const topFwd=fwdCandidates.slice(0,10);
  const topRev=revCandidates.slice(0,10);
  for(const f of topFwd) for(const r of topRev) {
    const prodSize=r.end-f.start+1;
    if(prodSize<prodMin||prodSize>prodMax) continue;
    const tmDiff=Math.abs(f.tm-r.tm);
    pairs.push({fwd:f,rev:r,prodSize,tmDiff,score:scoreP(f)+scoreP(r)+tmDiff*2});
  }
  pairs.sort((a,b)=>a.score-b.score);

  const el=document.getElementById('primer-result');
  el.style.display='block';

  if(!pairs.length&&(fwdCandidates.length||revCandidates.length)){
    el.innerHTML=`<div class="error-msg"><i class="ti ti-info-circle"></i>
      Found ${fwdCandidates.length} forward and ${revCandidates.length} reverse primer candidates but no valid pairs
      within product size ${prodMin}–${prodMax} bp. Try adjusting the product size range or Tm limits.
    </div>
    ${fwdCandidates.length?buildPrimerTable(fwdCandidates.slice(0,10),'Forward primer candidates'):''}
    ${revCandidates.length?buildPrimerTable(revCandidates.slice(0,10),'Reverse primer candidates'):''}`;
    return;
  }

  if(!pairs.length){
    el.innerHTML=`<div class="error-msg"><i class="ti ti-alert-circle"></i>
      No primer pairs found. The sequence may be too short, or the constraints too strict.
      Try: widening the Tm range, adjusting GC limits, or using a longer template.
    </div>`;
    return;
  }

  el.innerHTML=`
    ${statGrid([
      {v:fwdCandidates.length, l:'Fwd candidates'},
      {v:revCandidates.length, l:'Rev candidates'},
      {v:pairs.length, l:'Valid pairs'},
      {v:pairs[0].prodSize+' bp', l:'Best pair product'},
      {v:pairs[0].fwd.tm+'°C / '+pairs[0].rev.tm+'°C', l:'Best pair Tm (F/R)'},
    ])}
    ${buildPrimerPairsTable(pairs.slice(0,10))}
    ${buildPrimerTable(fwdCandidates.slice(0,5),'Top forward primers')}
    ${buildPrimerTable(revCandidates.slice(0,5),'Top reverse primers')}
  `;
  window._primerData={pairs,fwdCandidates,revCandidates};
}

function buildPrimerPairsTable(pairs) {
  return card(`Top primer pairs (${pairs.length})`, `
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="border-bottom:1px solid var(--border);">
        <th style="padding:6px 8px;text-align:left">#</th>
        <th style="padding:6px 8px;text-align:left">Forward primer 5'→3'</th>
        <th style="padding:6px 8px;text-align:left">Reverse primer 5'→3'</th>
        <th style="padding:6px 8px;text-align:right">Product</th>
        <th style="padding:6px 8px;text-align:right">Tm F/R</th>
        <th style="padding:6px 8px;text-align:right">ΔTm</th>
        <th style="padding:6px 8px;text-align:right">GC F/R</th>
      </tr></thead>
      <tbody>${pairs.map((p,i)=>`
        <tr style="border-bottom:1px solid var(--border);${i===0?'background:var(--accent-bg);':''}">
          <td style="padding:5px 8px;font-weight:700;color:var(--accent)">${i+1}${i===0?' ⭐':''}</td>
          <td style="padding:5px 8px;font-family:var(--font-mono);font-size:11px;">${p.fwd.seq}</td>
          <td style="padding:5px 8px;font-family:var(--font-mono);font-size:11px;">${p.rev.seq}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:600;">${p.prodSize} bp</td>
          <td style="padding:5px 8px;text-align:right;">${p.fwd.tm} / ${p.rev.tm}°C</td>
          <td style="padding:5px 8px;text-align:right;color:${p.tmDiff>5?'var(--red)':'var(--green)'};">${p.tmDiff.toFixed(1)}°C</td>
          <td style="padding:5px 8px;text-align:right;">${p.fwd.gc} / ${p.rev.gc}%</td>
        </tr>`).join('')}
      </tbody>
    </table></div>
  `, exportBtn('CSV','exportPrimersCSV()')+'  '+exportBtn('FASTA','exportPrimersFASTA()'));
}

function buildPrimerTable(primers, title) {
  return card(title,`
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="border-bottom:1px solid var(--border);">
        <th style="padding:5px 8px;text-align:left">Sequence 5'→3'</th>
        <th style="padding:5px 8px;text-align:right">Tm</th>
        <th style="padding:5px 8px;text-align:right">GC%</th>
        <th style="padding:5px 8px;text-align:right">Length</th>
        <th style="padding:5px 8px;text-align:right">Hairpin</th>
        <th style="padding:5px 8px;text-align:left">Position</th>
      </tr></thead>
      <tbody>${primers.map(p=>`
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:5px 8px;font-family:var(--font-mono);font-size:11px;">${p.seq}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:600;">${p.tm}°C</td>
          <td style="padding:5px 8px;text-align:right;">${p.gc}%</td>
          <td style="padding:5px 8px;text-align:right;">${p.len} bp</td>
          <td style="padding:5px 8px;text-align:right;color:${p.hairpin>3?'var(--red)':'var(--green)'};">${p.hairpin}</td>
          <td style="padding:5px 8px;font-family:var(--font-mono);font-size:11px;">${p.start}–${p.end}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>
  `);
}

function exportPrimersCSV(){
  if(!window._primerData) return;
  const rows=[['Pair','Type','Sequence','Tm','GC%','Length','Hairpin','SelfComp','Position','ProductSize']];
  window._primerData.pairs.slice(0,20).forEach((p,i)=>{
    rows.push([i+1,'Forward',p.fwd.seq,p.fwd.tm,p.fwd.gc,p.fwd.len,p.fwd.hairpin,p.fwd.selfComp,`${p.fwd.start}-${p.fwd.end}`,p.prodSize]);
    rows.push([i+1,'Reverse',p.rev.seq,p.rev.tm,p.rev.gc,p.rev.len,p.rev.hairpin,p.rev.selfComp,`${p.rev.start}-${p.rev.end}`,p.prodSize]);
  });
  downloadCSV(rows,'primers.csv');
}

function exportPrimersFASTA(){
  if(!window._primerData) return;
  const seqs=[];
  window._primerData.pairs.slice(0,10).forEach((p,i)=>{
    seqs.push({name:`Pair${i+1}_Fwd_${p.fwd.tm}C_${p.prodSize}bp`,seq:p.fwd.seq});
    seqs.push({name:`Pair${i+1}_Rev_${p.rev.tm}C_${p.prodSize}bp`,seq:p.rev.seq});
  });
  downloadFasta(seqs,'primers.fasta');
}

// ── Multiple Sequence Alignment ───────────────────────────────────────────────
function msaPanel() {
  const demo = window.sharedSeqs.length>=3
    ? window.sharedSeqs.slice(0,8).map(s=>`<div class="phylo-input-row"><input type="text" class="msa-name" value="${s.name}"><input type="text" class="msa-val" value="${s.seq.slice(0,200)}" style="font-family:var(--font-mono);font-size:11px;"></div>`).join('')
    : [['Human','ATGCGATCGATCGGCTATCGATCGATCGATCGATCG'],
       ['Chimpanzee','ATGCGATCGATCGGCTATCGATCGATCGATCGATCG'],
       ['Gorilla','ATGCGATCAATCGGCTATCGATCGGTCGATCGATCG'],
       ['Orangutan','ATGCGATCGATCGGCTATCGAGCGATCGATCGATCG'],
       ['Mouse','ATGCGATCGACCGGCTTTCGAGCGTTCGATCGATCG']]
      .map(s=>`<div class="phylo-input-row"><input type="text" class="msa-name" value="${s[0]}"><input type="text" class="msa-val" value="${s[1]}" style="font-family:var(--font-mono);font-size:11px;"></div>`).join('');

  return `
  <div class="tool-intro">
    Progressive multiple sequence alignment (ClustalW-style). Aligns 2–20 sequences simultaneously,
    showing conserved regions, variable sites, and gaps. Exports as FASTA, CLUSTAL, or colored HTML.
  </div>

  <div id="msa-rows">${demo}</div>
  <div style="display:flex;gap:8px;margin:10px 0 14px;flex-wrap:wrap;">
    <button class="btn btn-sm" onclick="addMSARow()"><i class="ti ti-plus"></i> Add row</button>
    <button class="btn btn-sm" onclick="removeMSARow()"><i class="ti ti-minus"></i> Remove last</button>
    <button class="btn btn-sm" onclick="loadMSAfromImport()"><i class="ti ti-download"></i> Load from File Import</button>
  </div>

  <div class="btn-row">
    <button class="btn btn-primary" id="msa-btn" onclick="runMSA()"><i class="ti ti-align-left"></i> Align sequences</button>
  </div>
  <div id="msa-result" style="display:none;"></div>`;
}

let _msaRowCount=5;
function addMSARow(){
  if(document.querySelectorAll('#msa-rows .phylo-input-row').length>=20){showToast('Max 20 sequences.','error');return;}
  _msaRowCount++;
  const div=document.createElement('div'); div.className='phylo-input-row';
  div.innerHTML=`<input type="text" class="msa-name" value="Seq${_msaRowCount}" placeholder="Name"><input type="text" class="msa-val" placeholder="Sequence…" style="font-family:var(--font-mono);font-size:11px;">`;
  document.getElementById('msa-rows').appendChild(div);
}
function removeMSARow(){
  const rows=document.querySelectorAll('#msa-rows .phylo-input-row');
  if(rows.length>2) rows[rows.length-1].remove();
}
function loadMSAfromImport(){
  if(!window.sharedSeqs.length){showToast('No sequences imported yet.','error');return;}
  const c=document.getElementById('msa-rows'); c.innerHTML='';
  window.sharedSeqs.slice(0,20).forEach(s=>{
    const div=document.createElement('div'); div.className='phylo-input-row';
    div.innerHTML=`<input type="text" class="msa-name" value="${s.name}"><input type="text" class="msa-val" value="${s.seq.slice(0,300)}" style="font-family:var(--font-mono);font-size:11px;">`;
    c.appendChild(div);
  });
  showToast(`Loaded ${Math.min(window.sharedSeqs.length,20)} sequences`,'success');
}

async function runMSA() {
  const nameEls=document.querySelectorAll('.msa-name');
  const seqEls=document.querySelectorAll('.msa-val');
  const seqs=[];
  nameEls.forEach((n,i)=>{
    const name=n.value.trim(), seq=seqEls[i].value.toUpperCase().replace(/\s/g,'');
    if(name&&seq.length>=4) seqs.push({name,seq});
  });
  if(seqs.length<2){showToast('Enter at least 2 sequences.','error');return;}
  if(seqs.length>20){showToast('Max 20 sequences.','error');return;}

  const btn=document.getElementById('msa-btn');
  btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Aligning…';
  btn.disabled=true;

  try {
    const result = await runInWorker('msa', {seqs});
    renderMSA(result, seqs);
    showToast('Alignment complete!','success');
  } catch(e) {
    showToast('Alignment error: '+e.message,'error');
  } finally {
    btn.innerHTML='<i class="ti ti-align-left"></i> Align sequences';
    btn.disabled=false;
  }
}

function renderMSA(result, inputSeqs) {
  const {aligned, length, avgIdentity, nSeqs} = result;
  const el=document.getElementById('msa-result');
  el.style.display='block';

  // Build column conservation track
  const conserved=[], variable=[];
  for(let col=0;col<length;col++){
    const bases=aligned.map(a=>a.seq[col]||'-');
    const nonGap=bases.filter(b=>b!=='-');
    const allSame=nonGap.length>0&&nonGap.every(b=>b===nonGap[0]);
    conserved.push(allSame&&nonGap.length===aligned.length);
    variable.push(nonGap.length<aligned.length);
  }

  const consTrack=conserved.map((c,i)=>
    `<span style="color:${c?'var(--green)':variable[i]?'var(--red)':'var(--text-3)'}">${c?'*':variable[i]?'·':':'}</span>`
  ).join('');

  const CHUNK=60;
  let alnHTML='';
  for(let start=0;start<length;start+=CHUNK){
    alnHTML+=`<div style="margin-bottom:14px;">`;
    alnHTML+=`<div style="font-size:10px;color:var(--text-3);padding-left:14ch;font-family:var(--font-mono);margin-bottom:2px;">${start+1}</div>`;
    aligned.forEach(seq=>{
      const chunk=seq.seq.slice(start,start+CHUNK);
      const colored=chunk.split('').map((b,i)=>{
        if(b==='-') return `<span style="color:var(--text-3)">-</span>`;
        const cls={A:'base-A',T:'base-T',C:'base-C',G:'base-G',U:'base-U'}[b]||'';
        const isConserved=conserved[start+i];
        return `<span class="${cls}" style="${isConserved?'font-weight:700;':'opacity:0.7;'}">${b}</span>`;
      }).join('');
      alnHTML+=`<div style="font-family:var(--font-mono);font-size:12px;line-height:1.8;">
        <span style="display:inline-block;width:14ch;color:var(--accent);font-weight:600;font-size:11px;overflow:hidden;white-space:nowrap;">${seq.name.slice(0,12)}</span>${colored}
      </div>`;
    });
    alnHTML+=`<div style="font-family:var(--font-mono);font-size:12px;line-height:1.8;padding-left:14ch;">${consTrack.slice(start,start+CHUNK)}</div>`;
    alnHTML+=`</div>`;
  }

  el.innerHTML=`
    ${statGrid([
      {v:nSeqs, l:'Sequences'},
      {v:length+' bp', l:'Alignment length'},
      {v:avgIdentity+'%', l:'Avg identity'},
      {v:conserved.filter(Boolean).length, l:'Conserved cols'},
      {v:conserved.filter((_,i)=>variable[i]).length, l:'Gap cols'},
    ])}
    ${card('Multiple sequence alignment', `
      <div style="overflow-x:auto;">${alnHTML}</div>
      <div class="legend-row">
        <div class="legend-item"><span style="color:var(--green);font-family:var(--font-mono);font-weight:700;">*</span> &nbsp;Fully conserved</div>
        <div class="legend-item"><span style="color:var(--text-3);font-family:var(--font-mono);">:</span> &nbsp;Conserved</div>
        <div class="legend-item"><span style="color:var(--red);font-family:var(--font-mono);">·</span> &nbsp;Gap present</div>
      </div>
    `, exportBtn('FASTA','exportMSAfasta()')+'  '+exportBtn('CLUSTAL','exportMSAclustal()'))}
  `;
  window._msaData={aligned,length,avgIdentity,conserved};
}

function exportMSAfasta(){
  if(!window._msaData) return;
  downloadFasta(window._msaData.aligned.map(s=>({name:s.name,seq:s.seq})),'alignment.fasta');
}
function exportMSAclustal(){
  if(!window._msaData) return;
  const{aligned,length}=window._msaData;
  let out='CLUSTAL W multiple sequence alignment\n\n';
  for(let i=0;i<length;i+=60){
    aligned.forEach(s=>{
      out+=s.name.padEnd(20)+s.seq.slice(i,i+60)+'\n';
    });
    out+='\n';
  }
  downloadText(out,'alignment.clustal');
}

// ── Smith-Waterman local alignment ─────────────────────────────────────────────
function swPanel() {
  return `
  <div class="tool-intro">
    <strong>Smith-Waterman</strong> local alignment — finds the best matching sub-region between
    two sequences, unlike Needleman-Wunsch which aligns the full length globally. Ideal for
    finding conserved domains, checking if a fragment matches a region in a larger sequence.
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div class="input-group"><label>Sequence A</label><textarea id="sw-a" rows="4" style="font-family:var(--font-mono);font-size:12px;" placeholder="Query sequence…">GCATGCUATCGATCG</textarea></div>
    <div class="input-group"><label>Sequence B</label><textarea id="sw-b" rows="4" style="font-family:var(--font-mono);font-size:12px;" placeholder="Target / database sequence…">GATTACAGCATGCUATCGATCGATCGATCGCGATCG</textarea></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
    <div class="input-group" style="margin:0;"><label>Match</label><input type="number" id="sw-match" value="2" style="height:36px;"></div>
    <div class="input-group" style="margin:0;"><label>Mismatch</label><input type="number" id="sw-mismatch" value="-1" style="height:36px;"></div>
    <div class="input-group" style="margin:0;"><label>Gap</label><input type="number" id="sw-gap" value="-2" style="height:36px;"></div>
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" id="sw-btn" onclick="runSW()"><i class="ti ti-arrows-horizontal"></i> Local align (S-W)</button>
    <button class="btn" onclick="document.getElementById('sw-a').value='GCATGCUATCGATCG';document.getElementById('sw-b').value='GATTACAGCATGCUATCGATCGATCGATCGCGATCG';runSW()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="sw-result" style="display:none;"></div>`;
}

async function runSW() {
  const a   = document.getElementById('sw-a').value.toUpperCase().replace(/\s/g,'');
  const b   = document.getElementById('sw-b').value.toUpperCase().replace(/\s/g,'');
  const ms  = parseInt(document.getElementById('sw-match').value)||2;
  const mm  = parseInt(document.getElementById('sw-mismatch').value)||-1;
  const gp  = parseInt(document.getElementById('sw-gap').value)||-2;

  if(!a||!b){showToast('Enter both sequences.','error');return;}
  if(a.length>500||b.length>1000){showToast('Max 500 × 1000 characters for local alignment.','error');return;}

  const btn=document.getElementById('sw-btn');
  btn.innerHTML='<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Aligning…';
  btn.disabled=true;

  try {
    const r = await runInWorker('sw',{a,b,ms,mm,gp});
    const faH=r.ra.split('').map((c,i)=>{
      const cl=r.cons[i]==='|'?'align-match':r.cons[i]==='-'?'align-gap':'align-mismatch';
      return `<span class="${cl}">${c}</span>`;
    }).join('');
    const fcH=r.cons.split('').map(c=>`<span class="${c==='|'?'align-match':c==='-'?'align-gap':'align-mismatch'}">${c}</span>`).join('');
    const fbH=r.rb.split('').map((c,i)=>{
      const cl=r.cons[i]==='|'?'align-match':r.cons[i]==='-'?'align-gap':'align-mismatch';
      return `<span class="${cl}">${c}</span>`;
    }).join('');

    const el=document.getElementById('sw-result');
    el.style.display='block';
    el.innerHTML=`
      ${statGrid([
        {v:r.score, l:'SW score'},
        {v:r.identity+'%', l:'Local identity'},
        {v:r.matches, l:'Matches'},
        {v:`A: ${r.startA}–${r.endA}`, l:'Match region A'},
        {v:`B: ${r.startB}–${r.endB}`, l:'Match region B'},
        {v:r.cons.length, l:'Aligned length'},
      ])}
      ${card('Local alignment',`
        <div class="align-block">
          <div>A: ${faH}</div>
          <div style="padding-left:22px;color:var(--text-3);">${fcH}</div>
          <div>B: ${fbH}</div>
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-top:8px;">
          Match found at A[${r.startA}–${r.endA}] vs B[${r.startB}–${r.endB}]
        </div>
        <div class="legend-row">
          <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Match</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Mismatch</div>
          <div class="legend-item"><div class="legend-dot" style="background:var(--text-3)"></div>Gap</div>
        </div>
      `, exportBtn('Text','exportSWtext()'))}
    `;
    window._swData={a,b,r};
    showToast('Local alignment complete!','success');
  } catch(e) {
    showToast('Error: '+e.message,'error');
  } finally {
    btn.innerHTML='<i class="ti ti-arrows-horizontal"></i> Local align (S-W)';
    btn.disabled=false;
  }
}

function exportSWtext(){
  if(!window._swData) return;
  const{a,b,r}=window._swData;
  downloadText(`BioViz Smith-Waterman Local Alignment
=====================================
Score:    ${r.score}
Identity: ${r.identity}%
Region A: ${r.startA}–${r.endA}
Region B: ${r.startB}–${r.endB}

A: ${r.ra}
   ${r.cons}
B: ${r.rb}`,'sw_alignment.txt');
}

// ── Sequence Annotation Builder ───────────────────────────────────────────────
function annotationPanel() {
  return `
  <div class="tool-intro">
    Build and export sequence annotations visually. Add features to your sequence, assign
    colors and strand, then export as <strong>GenBank</strong> or <strong>GFF3</strong> format —
    two of the most widely used annotation formats in bioinformatics.
  </div>

  <div class="input-group">
    <label>Sequence</label>
    ${seqTextarea('annot-seq',4,getSharedSeq('ATGCGATCGATCGGCTATCGATCGATCGATCGATCGATCGATCGATCGATCG'))}
  </div>

  <div class="card" style="margin-bottom:14px;">
    <div class="card-header">
      <div class="card-title">Annotations</div>
      <button class="btn btn-sm btn-primary" onclick="addAnnotRow()"><i class="ti ti-plus"></i> Add feature</button>
    </div>
    <div id="annot-rows" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;">
      <!-- rows added dynamically -->
    </div>
    <div style="font-size:11px;color:var(--text-3);">Click "Add feature" to start annotating, or import from GenBank via File Import.</div>
  </div>

  <div class="btn-row">
    <button class="btn btn-primary" onclick="runAnnotation()"><i class="ti ti-eye"></i> Preview</button>
    <button class="btn" onclick="loadAnnotDemo()"><i class="ti ti-flask"></i> Demo</button>
    <button class="btn" onclick="importAnnotFromGenBank()"><i class="ti ti-file-description"></i> Import GenBank</button>
  </div>

  <div id="annot-result" style="display:none;"></div>`;
}

let _annotRows=[];

function addAnnotRow(feat={name:'gene_1',start:1,end:100,strand:'+',type:'gene',color:'#2563eb',product:''}) {
  const id='annot-'+Date.now();
  const div=document.createElement('div');
  div.id=id;
  div.style.cssText='display:grid;grid-template-columns:2fr 1fr 1fr auto auto 2fr auto;gap:6px;align-items:center;';
  div.innerHTML=`
    <input type="text" placeholder="Feature name" value="${feat.name}" style="height:32px;font-size:12px;">
    <input type="number" placeholder="Start" value="${feat.start}" style="height:32px;font-size:12px;">
    <input type="number" placeholder="End" value="${feat.end}" style="height:32px;font-size:12px;">
    <select style="height:32px;font-size:12px;">
      <option value="+" ${feat.strand==='+'?'selected':''}>+</option>
      <option value="-" ${feat.strand==='-'?'selected':''}>−</option>
    </select>
    <select style="height:32px;font-size:12px;">
      ${['gene','CDS','exon','mRNA','rRNA','tRNA','repeat_region','misc_feature'].map(t=>`<option ${t===feat.type?'selected':''}>${t}</option>`).join('')}
    </select>
    <input type="text" placeholder="Product / note" value="${feat.product||''}" style="height:32px;font-size:12px;">
    <button onclick="this.parentElement.remove()" class="btn btn-sm" style="color:var(--red);padding:4px 8px;"><i class="ti ti-trash"></i></button>
  `;
  document.getElementById('annot-rows').appendChild(div);
}

function loadAnnotDemo(){
  document.getElementById('annot-seq').value='ATGCGATCGATCGGCTATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGGCTATCGGCGGCTATCGA';
  document.getElementById('annot-rows').innerHTML='';
  [
    {name:'promoter',start:1,end:15,strand:'+',type:'misc_feature',color:'#7c3aed',product:'Promoter region'},
    {name:'gene_A',start:16,end:45,strand:'+',type:'gene',color:'#2563eb',product:'Hypothetical protein A'},
    {name:'CDS_A',start:16,end:45,strand:'+',type:'CDS',color:'#16a34a',product:'Protein A'},
    {name:'repeat',start:46,end:60,strand:'+',type:'repeat_region',color:'#d97706',product:'Direct repeat'},
    {name:'gene_B',start:50,end:73,strand:'-',type:'gene',color:'#dc2626',product:'Gene B antisense'},
  ].forEach(addAnnotRow);
  runAnnotation();
}

function importAnnotFromGenBank(){
  const gb=window.sharedSeqs.find(s=>s.type==='genbank');
  if(!gb){showToast('No GenBank file imported yet.','error');return;}
  document.getElementById('annot-seq').value=gb.seq;
  document.getElementById('annot-rows').innerHTML='';
  const colors=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2'];
  gb.genbank.features.filter(f=>f.type==='gene'||f.type==='CDS').forEach((f,i)=>{
    const m=f.location.match(/(\d+)\.\.(\d+)/);
    if(!m) return;
    addAnnotRow({name:f.qualifiers.gene||f.type+'_'+i,start:parseInt(m[1]),end:parseInt(m[2]),
      strand:f.location.includes('complement')?'-':'+',type:f.type,
      color:colors[i%colors.length],product:f.qualifiers.product||''});
  });
  showToast(`Imported ${gb.genbank.features.length} features`,'success');
  runAnnotation();
}

function getAnnotations(){
  const rows=document.querySelectorAll('#annot-rows > div');
  return [...rows].map(div=>{
    const inputs=div.querySelectorAll('input,select');
    return{name:inputs[0].value.trim(),start:parseInt(inputs[1].value)||1,
      end:parseInt(inputs[2].value)||10,strand:inputs[3].value,
      type:inputs[4].value,product:inputs[5].value.trim(),
      color:'#2563eb'};
  }).filter(a=>a.name&&!isNaN(a.start)&&!isNaN(a.end));
}

function runAnnotation(){
  const seq=cleanDNA(document.getElementById('annot-seq').value);
  const annotations=getAnnotations();
  if(!seq){showToast('Enter a sequence.','error');return;}

  const colors=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#db2777','#65a30d'];
  const annColors=annotations.map((_,i)=>colors[i%colors.length]);

  // Build visual map SVG
  const W=640,PAD=30,trackW=W-PAD*2,H=Math.max(100,annotations.length*22+60);
  const toX=p=>PAD+(p/seq.length)*trackW;
  const LANE_H=20;
  const lanes=[];
  const laneAssign=annotations.map((a,ai)=>{
    const xs=toX(a.start),xe=toX(a.end);
    for(let l=0;l<20;l++){
      if(!lanes[l]) lanes[l]=[];
      if(!lanes[l].some(([s,e])=>xs<e+4&&xe>s-4)){lanes[l].push([xs,xe]);return l;}
    }
    return 0;
  });
  const maxLane=Math.max(...laneAssign,0);
  const svgH=(maxLane+1)*LANE_H+60;

  let svg=`<svg viewBox="0 0 ${W} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;border-radius:var(--radius);background:var(--surface-2);" id="annot-svg">`;
  const bbY=svgH-30;
  svg+=`<rect x="${PAD}" y="${bbY}" width="${trackW}" height="4" rx="2" fill="var(--border-md)"/>`;
  [0,.25,.5,.75,1].forEach(t=>{
    const x=PAD+t*trackW,pos=Math.round(t*seq.length);
    svg+=`<line x1="${x}" y1="${bbY+4}" x2="${x}" y2="${bbY+12}" stroke="var(--text-3)" stroke-width="1"/>`;
    svg+=`<text x="${x}" y="${bbY+22}" text-anchor="middle" fill="var(--text-3)" font-size="9">${pos}</text>`;
  });

  annotations.forEach((a,i)=>{
    const color=annColors[i];
    const xs=toX(a.start),xe=toX(a.end);
    const lane=laneAssign[i];
    const y=10+lane*LANE_H, h=14;
    const aw=Math.min(8,xe-xs);
    const pts=a.strand!=='-'
      ?`${xs},${y} ${xe-aw},${y} ${xe},${y+h/2} ${xe-aw},${y+h} ${xs},${y+h}`
      :`${xs+aw},${y} ${xe},${y} ${xe},${y+h} ${xs+aw},${y+h} ${xs},${y+h/2}`;
    svg+=`<polygon points="${pts}" fill="${color}" opacity="0.88"><title>${a.name} (${a.type}) ${a.start}–${a.end} ${a.strand}</title></polygon>`;
    if(xe-xs>25) svg+=`<text x="${(xs+xe)/2}" y="${y+h/2+4}" text-anchor="middle" fill="white" font-size="9" font-weight="700" pointer-events="none">${a.name.slice(0,12)}</text>`;
  });
  svg+='</svg>';

  const el=document.getElementById('annot-result');
  el.style.display='block';
  el.innerHTML=`
    ${statGrid([
      {v:seq.length.toLocaleString()+' bp', l:'Sequence length'},
      {v:annotations.length, l:'Features'},
      {v:annotations.filter(a=>a.strand==='+').length, l:'+ strand'},
      {v:annotations.filter(a=>a.strand==='-').length, l:'− strand'},
    ])}
    ${card('Feature map', svg, exportBtn('SVG','exportAnnotSVG()'))}
    ${card('Feature table', `
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="padding:5px 8px;text-align:left">Name</th>
          <th style="padding:5px 8px;text-align:left">Type</th>
          <th style="padding:5px 8px;text-align:right">Start</th>
          <th style="padding:5px 8px;text-align:right">End</th>
          <th style="padding:5px 8px;text-align:center">Strand</th>
          <th style="padding:5px 8px;text-align:left">Product</th>
        </tr></thead>
        <tbody>${annotations.map((a,i)=>`
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:5px 8px;font-weight:700;color:${annColors[i]}">${a.name}</td>
            <td style="padding:5px 8px;">${a.type}</td>
            <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono)">${a.start}</td>
            <td style="padding:5px 8px;text-align:right;font-family:var(--font-mono)">${a.end}</td>
            <td style="padding:5px 8px;text-align:center;">${a.strand}</td>
            <td style="padding:5px 8px;color:var(--text-2)">${a.product||'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    `, exportBtn('GenBank','exportAnnotGenBank()')+'  '+exportBtn('GFF3','exportAnnotGFF3()')+'  '+exportBtn('CSV','exportAnnotCSV()'))}
  `;
  window._annotData={seq,annotations,annColors};
}

function exportAnnotSVG(){
  const el=document.getElementById('annot-svg');
  if(el) downloadSVG(el,'annotation_map.svg');
}

function exportAnnotGenBank(){
  if(!window._annotData) return;
  const{seq,annotations}=window._annotData;
  const now=new Date();
  const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const date=`${now.getDate()}-${months[now.getMonth()]}-${now.getFullYear()}`;

  let gb=`LOCUS       sequence        ${seq.length} bp    DNA              ${date}\n`;
  gb+=`DEFINITION  Annotated sequence from BioViz.\n`;
  gb+=`ACCESSION   unknown\n`;
  gb+=`VERSION     unknown\n`;
  gb+=`FEATURES             Location/Qualifiers\n`;
  annotations.forEach(a=>{
    const loc=a.strand==='-'?`complement(${a.start}..${a.end})`:`${a.start}..${a.end}`;
    gb+=`     ${a.type.padEnd(16)}${loc}\n`;
    gb+=`                     /gene="${a.name}"\n`;
    if(a.product) gb+=`                     /product="${a.product}"\n`;
  });
  gb+=`ORIGIN\n`;
  for(let i=0;i<seq.length;i+=60){
    const lineNum=String(i+1).padStart(9,' ');
    const chunk=seq.slice(i,i+60).toLowerCase();
    const spaced=chunk.match(/.{1,10}/g)?.join(' ')||chunk;
    gb+=`${lineNum} ${spaced}\n`;
  }
  gb+='//\n';
  downloadText(gb,'annotation.gb');
}

function exportAnnotGFF3(){
  if(!window._annotData) return;
  const{annotations}=window._annotData;
  let gff='##gff-version 3\n';
  annotations.forEach((a,i)=>{
    const attrs=`ID=${a.name};Name=${a.name}${a.product?`;product=${a.product}`:''}`;
    gff+=`seq\tBioViz\t${a.type}\t${a.start}\t${a.end}\t.\t${a.strand}\t.\t${attrs}\n`;
  });
  downloadText(gff,'annotation.gff3');
}

function exportAnnotCSV(){
  if(!window._annotData) return;
  downloadCSV([['Name','Type','Start','End','Strand','Product'],
    ...window._annotData.annotations.map(a=>[a.name,a.type,a.start,a.end,a.strand,a.product])
  ],'annotation.csv');
}
