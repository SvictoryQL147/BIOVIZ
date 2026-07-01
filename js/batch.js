// ── Batch Analysis Panel ──────────────────────────────────────────────────────
function batchPanel() {
  return `
  <div class="tool-intro">
    Run multiple analyses across all imported sequences at once. Import a multi-sequence FASTA
    first using <strong>File Import</strong>, then select which analyses to run and click
    <strong>Run Batch</strong>. Results download as a single unified CSV or per-tool FASTAs.
  </div>

  <!-- Sequence source -->
  <div class="card" style="margin-bottom:14px;">
    <div class="card-header"><div class="card-title">Sequences</div></div>
    <div id="batch-seq-status"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      <button class="btn btn-primary" onclick="switchTab('fileimport')"><i class="ti ti-upload"></i> Go to File Import</button>
      <button class="btn" onclick="loadBatchPaste()"><i class="ti ti-clipboard"></i> Paste FASTA here</button>
      <button class="btn" onclick="loadBatchDemo()"><i class="ti ti-flask"></i> Load demo (6 sequences)</button>
    </div>
    <div id="batch-paste-area" style="display:none;margin-top:10px;">
      <textarea id="batch-paste-input" rows="6" placeholder=">Seq1&#10;ATGCGATCG…&#10;>Seq2&#10;GCTAGCTA…" style="font-family:var(--font-mono);font-size:12px;"></textarea>
      <button class="btn btn-primary" style="margin-top:6px;" onclick="importBatchPaste()"><i class="ti ti-check"></i> Import</button>
    </div>
  </div>

  <!-- Analysis selection -->
  <div class="card" style="margin-bottom:14px;">
    <div class="card-header"><div class="card-title">Select analyses to run</div>
      <div class="card-actions">
        <button class="btn btn-sm" onclick="setBatchAll(true)">All</button>
        <button class="btn btn-sm" onclick="setBatchAll(false)">None</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;">
      ${[
        ['batch-gc',      'ti-chart-pie',       'GC & Composition',     'GC%, AT%, base counts per sequence'],
        ['batch-orf',     'ti-scan',            'ORF Finder',           'Longest ORF per sequence'],
        ['batch-trans',   'ti-arrow-right',     'Translation',          'Frame +1 protein per sequence'],
        ['batch-revcomp', 'ti-refresh',         'Reverse Complement',   'RC + Tm for each sequence'],
        ['batch-motif',   'ti-search',          'Motif Search',         'Hit count per sequence for a pattern'],
        ['batch-re',      'ti-cut',             'Restriction Sites',    'Cut count per enzyme per sequence'],
        ['batch-prot',    'ti-atom',            'Protein Properties',   'MW, pI, length for protein sequences'],
        ['batch-codon',   'ti-list-numbers',    'Codon Usage',          'GC3 and most frequent codon per seq'],
      ].map(([id,icon,label,desc])=>`
        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--surface-2);border-radius:var(--radius);border:1px solid var(--border);cursor:pointer;">
          <input type="checkbox" id="${id}" checked style="margin-top:2px;flex-shrink:0;">
          <div>
            <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px;">
              <i class="ti ${icon}" style="color:var(--accent)"></i>${label}
            </div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${desc}</div>
          </div>
        </label>`).join('')}
    </div>
  </div>

  <!-- Motif input (shown when batch-motif is checked) -->
  <div id="batch-motif-input" class="card" style="margin-bottom:14px;">
    <div class="card-header"><div class="card-title">Motif Search settings</div></div>
    <div class="input-group" style="margin:0;">
      <label>Pattern (IUPAC codes supported)</label>
      <input type="text" id="batch-motif-pat" value="GAATTC" placeholder="e.g. GAATTC or RAATTY" style="height:36px;font-family:var(--font-mono);">
    </div>
  </div>

  <!-- Restriction enzyme quick select -->
  <div id="batch-re-input" class="card" style="margin-bottom:14px;">
    <div class="card-header"><div class="card-title">Restriction enzyme filter</div></div>
    <div style="font-size:12px;color:var(--text-2);margin-bottom:8px;">Select enzymes to include in the batch report:</div>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
      <button class="btn btn-sm" onclick="setBatchEnzymes('common')">Common 6-cutters</button>
      <button class="btn btn-sm" onclick="setBatchEnzymes('all')">All 30</button>
      <button class="btn btn-sm" onclick="setBatchEnzymes('none')">None</button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;" id="batch-enzyme-list">
      ${RESTRICTION_ENZYMES.filter(e=>e.site.length>=6).map(e=>`
        <label style="font-size:11px;padding:3px 8px;background:var(--surface-2);border-radius:100px;border:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:4px;">
          <input type="checkbox" class="batch-enz-chk" value="${e.name}" checked>
          <span style="font-weight:600;color:var(--accent)">${e.name}</span>
        </label>`).join('')}
    </div>
  </div>

  <!-- Run -->
  <div class="btn-row">
    <button class="btn btn-primary" id="batch-run-btn" onclick="runBatch()">
      <i class="ti ti-player-play"></i> Run Batch
    </button>
  </div>

  <!-- Progress -->
  <div id="batch-progress" style="display:none;margin-bottom:16px;">
    <div style="font-size:13px;color:var(--text-2);margin-bottom:6px;" id="batch-progress-label">Running…</div>
    <div style="background:var(--surface-2);border-radius:100px;height:8px;overflow:hidden;border:1px solid var(--border);">
      <div id="batch-progress-bar" style="height:100%;width:0%;background:var(--accent);border-radius:100px;transition:width 0.3s;"></div>
    </div>
  </div>

  <!-- Results -->
  <div id="batch-result" style="display:none;"></div>`;
}

// ── Setup helpers ─────────────────────────────────────────────────────────────
function updateBatchSeqStatus() {
  const el = document.getElementById('batch-seq-status');
  if (!el) return;
  const n = window.sharedSeqs.length;
  if (!n) {
    el.innerHTML = `<div class="error-msg"><i class="ti ti-info-circle"></i>No sequences imported yet. Use File Import or paste FASTA below.</div>`;
  } else {
    el.innerHTML = `<div class="success-msg"><i class="ti ti-check"></i>
      <strong>${n} sequence${n>1?'s':''} ready</strong> &nbsp;·&nbsp;
      ${window.sharedSeqs.map(s=>`${s.name} (${s.seq.length} bp)`).join(' · ')}
    </div>`;
  }
}

function loadBatchPaste() {
  const area = document.getElementById('batch-paste-area');
  if (area) area.style.display = area.style.display==='none' ? 'block' : 'none';
}

function importBatchPaste() {
  const text = document.getElementById('batch-paste-input').value.trim();
  if (!text) { showToast('Paste a FASTA sequence first.','error'); return; }
  const seqs = text.startsWith('>') ? parseFasta(text) : parseFasta(`>Pasted\n${text}`);
  if (!seqs.length) { showToast('No valid sequences found.','error'); return; }
  seqs.forEach(s => addSharedSeq(s));
  document.getElementById('batch-paste-area').style.display = 'none';
  updateBatchSeqStatus();
  showToast(`Imported ${seqs.length} sequence(s)`,'success');
}

function loadBatchDemo() {
  const demos = [
    {name:'BRCA1_exon11', seq:'ATGCGATCGATCGGCTATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGGCTATCGGCGGCTATCGA'},
    {name:'TP53_CDS',     seq:'ATGGAGGAGCCGCAGTCAGATCCTAGCGTTGAATCTCGGGCTTCTACGAGGGAGCTTGATCACAGCCCCTCCTGGCCCCTGTCATCTTCGGATCTGAGCGGGCGGCGGGGAGCAGCCTCTGGCATTCTGGGAGCTTCATCTGGACCTGGGTCTTCAGTGAACCATTGTTCAATATCGTCCGGGG'},
    {name:'EGFR_frag',    seq:'ATGCGACCCTCCGGGACGGCCGGGGCAGCGCTCCTGGCGCTGCTGGCTGCGCTCTGCCCGGCGAGTCGGGCTCTGGAGGAAAAGAAAGTTTGCCAAGGCACGAGTAACAAGCTCACGCAGTTGGGCACTTTTGAAGATCATTTTCTCAGCCCCA'},
    {name:'MYC_frag',     seq:'ATGCCCCTCAACGTTAGCTTCACCAACAGGAACTATGACCTCGACTACGACTCGGTGCAGCCGTATTTCTACTGCGACGAGGAGGAGAACTTCTACCAGCAGCAGCAGCAGACGGAGGAGCAGCAGCAGAAGCAGCGG'},
    {name:'KRAS_exon2',   seq:'ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGATCCAACAATAGAGGATTCCTACAGGAAGCAAGTAG'},
    {name:'Random_ctrl',  seq:'GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCT'},
  ];
  demos.forEach(s => addSharedSeq({...s, type:'fasta'}));
  updateBatchSeqStatus();
  showToast('Loaded 6 demo sequences','success');
}

function setBatchAll(val) {
  ['batch-gc','batch-orf','batch-trans','batch-revcomp','batch-motif','batch-re','batch-prot','batch-codon']
    .forEach(id => { const el=document.getElementById(id); if(el) el.checked=val; });
}

function setBatchEnzymes(preset) {
  document.querySelectorAll('.batch-enz-chk').forEach(c => {
    if (preset==='all')    c.checked=true;
    if (preset==='none')   c.checked=false;
    if (preset==='common') {
      const e=RESTRICTION_ENZYMES.find(e=>e.name===c.value);
      c.checked=e?e.site.length>=6:false;
    }
  });
}

// ── Core batch runner ─────────────────────────────────────────────────────────
function runBatch() {
  updateBatchSeqStatus();
  const seqs = window.sharedSeqs;
  if (!seqs.length) { showToast('Import sequences first.','error'); return; }

  const checks = {
    gc:      document.getElementById('batch-gc')?.checked,
    orf:     document.getElementById('batch-orf')?.checked,
    trans:   document.getElementById('batch-trans')?.checked,
    revcomp: document.getElementById('batch-revcomp')?.checked,
    motif:   document.getElementById('batch-motif')?.checked,
    re:      document.getElementById('batch-re')?.checked,
    prot:    document.getElementById('batch-prot')?.checked,
    codon:   document.getElementById('batch-codon')?.checked,
  };

  if (!Object.values(checks).some(Boolean)) { showToast('Select at least one analysis.','error'); return; }

  const motifPat = document.getElementById('batch-motif-pat')?.value.trim() || 'GAATTC';
  const enzymes  = [...document.querySelectorAll('.batch-enz-chk:checked')].map(c=>c.value);

  // UI: loading state
  const btn = document.getElementById('batch-run-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Running…';
  document.getElementById('batch-progress').style.display = 'block';
  document.getElementById('batch-result').style.display   = 'none';

  // Run async so UI updates
  setTimeout(() => {
    try {
      const results = runBatchAnalysis(seqs, checks, motifPat, enzymes);
      renderBatchResults(results, checks, motifPat, enzymes);
      showToast(`Batch complete — ${seqs.length} sequences × ${Object.values(checks).filter(Boolean).length} analyses`,'success');
    } catch(e) {
      showToast('Batch error: '+e.message,'error');
      console.error(e);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-player-play"></i> Run Batch';
      document.getElementById('batch-progress').style.display = 'none';
    }
  }, 60);
}

function setProgress(pct, label) {
  const bar = document.getElementById('batch-progress-bar');
  const lbl = document.getElementById('batch-progress-label');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = label;
}

// ── Individual analysis runners ───────────────────────────────────────────────
function batchRunGC(seq) {
  const s = seq.toUpperCase().replace(/[^ACGTU]/g,'');
  const cnt={A:0,T:0,G:0,C:0,U:0};
  for(const b of s) if(b in cnt) cnt[b]++;
  const n=s.length, isRNA=cnt.U>cnt.T;
  return {
    length: n,
    gc_pct: n?(((cnt.G+cnt.C)/n)*100).toFixed(1):'0',
    at_pct: n?((( cnt.A+(isRNA?cnt.U:cnt.T))/n)*100).toFixed(1):'0',
    A:cnt.A, C:cnt.C, G:cnt.G, T:isRNA?cnt.U:cnt.T,
    type: isRNA?'RNA':'DNA'
  };
}

function batchRunORF(seq) {
  const s = seq.toUpperCase().replace(/[^ACGT]/g,'');
  const STOP = new Set(['TAA','TAG','TGA']);
  let longest = null;
  for(let frame=0;frame<3;frame++){
    let inORF=false,start=-1;
    for(let i=frame;i<s.length-2;i+=3){
      const c=s.slice(i,i+3);
      if(!inORF&&c==='ATG'){inORF=true;start=i;}
      else if(inORF&&STOP.has(c)){
        const len=Math.floor((i-start)/3);
        if(!longest||len>longest.lenAA) longest={start:start+1,end:i+3,lenAA:len,lenBP:i+3-start};
        inORF=false;
      }
    }
  }
  return longest || {start:'—',end:'—',lenAA:0,lenBP:0};
}

function batchRunTranslation(seq) {
  const s = seq.toUpperCase().replace(/[^ACGT]/g,'');
  const MAP={Ala:'A',Arg:'R',Asn:'N',Asp:'D',Cys:'C',Gln:'Q',Glu:'E',Gly:'G',His:'H',
    Ile:'I',Leu:'L',Lys:'K',Met:'M',Phe:'F',Pro:'P',Ser:'S',Thr:'T',Trp:'W',Tyr:'Y',Val:'V'};
  let prot='';
  for(let i=0;i<s.length-2;i+=3){
    const aa=CODON_TABLE[s.slice(i,i+3)];
    if(!aa||aa==='*') break;
    prot+=MAP[aa]||'?';
  }
  return {protein:prot||'—', length:prot.length};
}

function batchRunRevComp(seq) {
  const s = seq.toUpperCase().replace(/[^ACGTN]/g,'');
  const CM={A:'T',T:'A',G:'C',C:'G',N:'N'};
  const rc=s.split('').reverse().map(b=>CM[b]||b).join('');
  const cnt={A:0,T:0,G:0,C:0};
  s.split('').forEach(b=>{if(b in cnt)cnt[b]++;});
  const n=cnt.A+cnt.T+cnt.G+cnt.C;
  const tm=n<14?2*(cnt.A+cnt.T)+4*(cnt.G+cnt.C):(64.9+41*(cnt.G+cnt.C-16.4)/n).toFixed(1);
  return {rc, tm:tm+'°C'};
}

function batchRunMotif(seq, pat) {
  if(!pat) return {hits:0,positions:'—'};
  const IUPAC_M={N:'[ACGTU]',R:'[AG]',Y:'[CT]',W:'[AT]',S:'[GC]',K:'[GT]',M:'[AC]',B:'[CGT]',D:'[AGT]',H:'[ACT]',V:'[ACG]'};
  let re;
  try{ re=new RegExp(pat.toUpperCase().split('').map(c=>IUPAC_M[c]||c).join(''),'gi'); }
  catch(e){ return {hits:0,positions:'Invalid pattern'}; }
  const hits=[]; let m;
  while((m=re.exec(seq))!==null){ hits.push(m.index+1); re.lastIndex=m.index+1; }
  return {hits:hits.length, positions:hits.slice(0,5).join(';')+(hits.length>5?'…':'')};
}

function batchRunRestriction(seq, enzymes) {
  const IUPAC_M={N:'[ACGT]',R:'[AG]',Y:'[CT]',W:'[AT]',S:'[GC]',K:'[GT]',M:'[AC]'};
  const results={};
  enzymes.forEach(name=>{
    const e=RESTRICTION_ENZYMES.find(e=>e.name===name); if(!e) return;
    const re=new RegExp(e.site.split('').map(c=>IUPAC_M[c]||c).join(''),'gi');
    let n=0,m; while((m=re.exec(seq))!==null){n++;re.lastIndex=m.index+1;}
    results[name]=n;
  });
  return results;
}

function batchRunProtProp(seq) {
  const MW_T={A:89.09,R:174.20,N:132.12,D:133.10,C:121.16,Q:146.15,E:147.13,G:75.03,H:155.16,I:131.17,L:131.17,K:146.19,M:149.21,F:165.19,P:115.13,S:105.09,T:119.12,W:204.23,Y:181.19,V:117.15};
  const PKA={D:3.9,E:4.1,C:8.3,Y:10.1,H:6.0,K:10.5,R:12.5};
  const s=seq.toUpperCase().replace(/[^ACDEFGHIKLMNPQRSTVWY]/g,'');
  if(!s.length) return {mw:'—',pi:'—',length:0};
  const mw=(s.split('').reduce((t,a)=>t+(MW_T[a]||110),0)-(s.length-1)*18.02)/1000;
  const cnt={};
  s.split('').forEach(a=>cnt[a]=(cnt[a]||0)+1);
  let pi='14.00';
  for(let pH=0;pH<=14;pH+=0.01){
    let charge=1/(1+Math.pow(10,pH-8.0))-1/(1+Math.pow(10,3.1-pH));
    ['R','K','H'].forEach(a=>{if(cnt[a])charge+=cnt[a]/(1+Math.pow(10,pH-PKA[a]));});
    ['D','E','C','Y'].forEach(a=>{if(cnt[a])charge-=cnt[a]/(1+Math.pow(10,PKA[a]-pH));});
    if(charge<0){pi=pH.toFixed(2);break;}
  }
  return {mw:mw.toFixed(2)+' kDa', pi, length:s.length};
}

function batchRunCodon(seq) {
  const s=seq.toUpperCase().replace(/[^ACGT]/g,'');
  const counts={};
  Object.keys(CODON_TABLE).forEach(c=>counts[c]=0);
  for(let i=0;i<s.length-2;i+=3){const c=s.slice(i,i+3);if(c in counts)counts[c]++;}
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  // GC3 = GC at 3rd codon position
  let gc3=0,total3=0;
  for(let i=2;i<s.length;i+=3){const b=s[i];total3++;if(b==='G'||b==='C')gc3++;}
  const topCodon=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  return {
    gc3_pct:total3?(gc3/total3*100).toFixed(1):'0',
    top_codon:topCodon?topCodon[0]:'—',
    top_aa:topCodon?CODON_TABLE[topCodon[0]]||'?':'—',
    top_count:topCodon?topCodon[1]:0,
    total_codons:total
  };
}

// ── Master runner ─────────────────────────────────────────────────────────────
function runBatchAnalysis(seqs, checks, motifPat, enzymes) {
  const total = seqs.length;
  const results = seqs.map((s, idx) => {
    setProgress(Math.round((idx/total)*100), `Processing ${s.name} (${idx+1}/${total})…`);
    const row = { name: s.name, length: s.seq.length };
    if (checks.gc)      row.gc      = batchRunGC(s.seq);
    if (checks.orf)     row.orf     = batchRunORF(s.seq);
    if (checks.trans)   row.trans   = batchRunTranslation(s.seq);
    if (checks.revcomp) row.revcomp = batchRunRevComp(s.seq);
    if (checks.motif)   row.motif   = batchRunMotif(s.seq, motifPat);
    if (checks.re)      row.re      = batchRunRestriction(s.seq, enzymes);
    if (checks.prot)    row.prot    = batchRunProtProp(s.seq);
    if (checks.codon)   row.codon   = batchRunCodon(s.seq);
    return row;
  });
  setProgress(100,'Complete!');
  return results;
}

// ── Render results ─────────────────────────────────────────────────────────────
function renderBatchResults(results, checks, motifPat, enzymes) {
  const el = document.getElementById('batch-result');
  el.style.display = 'block';

  let html = statGrid([
    {v:results.length, l:'Sequences processed'},
    {v:Object.values(checks).filter(Boolean).length, l:'Analyses run'},
    {v:results.length*Object.values(checks).filter(Boolean).length, l:'Total computations'},
    {v:results.reduce((s,r)=>s+r.length,0).toLocaleString(), l:'Total bases analyzed'},
  ]);

  // Summary table
  html += buildBatchSummaryTable(results, checks, motifPat, enzymes);

  // Per-analysis detail sections
  if (checks.gc)      html += buildGCSection(results);
  if (checks.orf)     html += buildORFSection(results);
  if (checks.trans)   html += buildTransSection(results);
  if (checks.re && enzymes.length) html += buildRESection(results, enzymes);
  if (checks.prot)    html += buildProtSection(results);
  if (checks.codon)   html += buildCodonSection(results);

  el.innerHTML = html;
  window._batchResults = {results, checks, motifPat, enzymes};
}

function buildBatchSummaryTable(results, checks, motifPat, enzymes) {
  const cols = [['Name','name'],['Length (bp)','length']];
  if (checks.gc)      cols.push(['GC%','gc.gc_pct'],['AT%','gc.at_pct']);
  if (checks.orf)     cols.push(['Longest ORF (aa)','orf.lenAA'],['ORF start','orf.start']);
  if (checks.trans)   cols.push(['Protein len (aa)','trans.length']);
  if (checks.revcomp) cols.push(['Tm','revcomp.tm']);
  if (checks.motif)   cols.push([`"${motifPat}" hits`,'motif.hits']);
  if (checks.prot)    cols.push(['MW','prot.mw'],['pI','prot.pi']);
  if (checks.codon)   cols.push(['GC3%','codon.gc3_pct'],['Top codon','codon.top_codon']);

  const getVal=(row,path)=>{
    const parts=path.split('.');
    let v=row;
    for(const p of parts){if(v===undefined||v===null)return '—';v=v[p];}
    return v??'—';
  };

  const thead=`<tr style="border-bottom:1px solid var(--border);">
    ${cols.map(([label])=>`<th style="padding:6px 10px;text-align:left;font-size:11px;font-weight:700;color:var(--text-3);white-space:nowrap;">${label}</th>`).join('')}
  </tr>`;

  const tbody=results.map((row,i)=>`
    <tr style="border-bottom:1px solid var(--border);">
      ${cols.map(([,path],ci)=>{
        const v=getVal(row,path);
        const isName=ci===0;
        const isNum=!isNaN(parseFloat(v))&&path!=='name';
        return `<td style="padding:5px 10px;font-size:12px;${isName?'font-weight:700;color:var(--accent);':''}${isNum?'text-align:right;font-family:var(--font-mono);':''}">${v}</td>`;
      }).join('')}
    </tr>`).join('');

  return card('Summary table',`
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  `, exportBtn('CSV','exportBatchCSV()')+'  '+exportBtn('JSON','exportBatchJSON()'));
}

function buildGCSection(results) {
  return card('GC Content comparison', `
    <div class="chart-wrap" style="height:200px;"><canvas id="batch-gc-chart"></canvas></div>
    <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
      ${results.map(r=>`<div style="text-align:center;font-size:11px;padding:6px 10px;background:var(--surface-2);border-radius:var(--radius);border:1px solid var(--border);">
        <div style="font-weight:700;color:var(--accent)">${r.name}</div>
        <div style="font-size:13px;font-weight:700;">${r.gc?.gc_pct||0}%</div>
        <div style="color:var(--text-3)">GC</div>
      </div>`).join('')}
    </div>
  `);
}

function buildORFSection(results) {
  const rows=results.map(r=>`
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:5px 10px;font-weight:700;color:var(--accent)">${r.name}</td>
      <td style="padding:5px 10px;font-family:var(--font-mono);text-align:right;">${r.orf?.lenAA||0} aa</td>
      <td style="padding:5px 10px;font-family:var(--font-mono);text-align:right;">${r.orf?.lenBP||0} bp</td>
      <td style="padding:5px 10px;font-family:var(--font-mono);">${r.orf?.start||'—'} – ${r.orf?.end||'—'}</td>
    </tr>`).join('');
  return card('ORF Finder results',`
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="border-bottom:1px solid var(--border);">
        <th style="padding:6px 10px;text-align:left">Sequence</th>
        <th style="padding:6px 10px;text-align:right">Longest ORF</th>
        <th style="padding:6px 10px;text-align:right">Length (bp)</th>
        <th style="padding:6px 10px;text-align:left">Position</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `, exportBtn('FASTA','exportBatchORFfasta()'));
}

function buildTransSection(results) {
  return card('Translation results',`
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${results.map(r=>`
        <div style="padding:10px 12px;background:var(--surface-2);border-radius:var(--radius);border:1px solid var(--border);">
          <div style="font-weight:700;color:var(--accent);font-size:12px;margin-bottom:4px;">${r.name} — ${r.trans?.length||0} aa</div>
          <div style="font-family:var(--font-mono);font-size:11px;word-break:break-all;color:var(--text-2);">${r.trans?.protein||'—'}</div>
        </div>`).join('')}
    </div>
  `, exportBtn('FASTA','exportBatchTransFasta()'));
}

function buildRESection(results, enzymes) {
  const thead=`<tr style="border-bottom:1px solid var(--border);">
    <th style="padding:6px 10px;text-align:left;font-size:11px">Sequence</th>
    ${enzymes.map(e=>`<th style="padding:6px 8px;text-align:center;font-size:11px;font-family:var(--font-mono);">${e}</th>`).join('')}
  </tr>`;
  const tbody=results.map(r=>`
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:5px 10px;font-weight:700;color:var(--accent);font-size:12px;">${r.name}</td>
      ${enzymes.map(e=>{
        const n=r.re?.[e]||0;
        return `<td style="padding:5px 8px;text-align:center;font-size:12px;font-family:var(--font-mono);font-weight:${n>0?'700':'400'};color:${n>0?'var(--accent)':'var(--text-3)'};">${n||'—'}</td>`;
      }).join('')}
    </tr>`).join('');
  return card('Restriction site counts',`
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>${thead}</thead><tbody>${tbody}</tbody>
      </table>
    </div>
    <div style="font-size:11px;color:var(--text-3);margin-top:8px;">Numbers = cut count. — = no cut.</div>
  `, exportBtn('CSV','exportBatchREcsv()'));
}

function buildProtSection(results) {
  const rows=results.map(r=>`
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:5px 10px;font-weight:700;color:var(--accent)">${r.name}</td>
      <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">${r.prot?.length||'—'}</td>
      <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">${r.prot?.mw||'—'}</td>
      <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">${r.prot?.pi||'—'}</td>
    </tr>`).join('');
  return card('Protein properties',`
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="border-bottom:1px solid var(--border);">
        <th style="padding:6px 10px;text-align:left">Sequence</th>
        <th style="padding:6px 10px;text-align:right">Length (aa)</th>
        <th style="padding:6px 10px;text-align:right">MW</th>
        <th style="padding:6px 10px;text-align:right">pI</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);
}

function buildCodonSection(results) {
  const rows=results.map(r=>`
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:5px 10px;font-weight:700;color:var(--accent)">${r.name}</td>
      <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">${r.codon?.total_codons||0}</td>
      <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono)">${r.codon?.gc3_pct||0}%</td>
      <td style="padding:5px 10px;text-align:center;font-family:var(--font-mono);font-weight:700;">${r.codon?.top_codon||'—'}</td>
      <td style="padding:5px 10px;text-align:center;">${r.codon?.top_aa||'—'}</td>
      <td style="padding:5px 10px;text-align:right;">${r.codon?.top_count||0}</td>
    </tr>`).join('');
  return card('Codon usage summary',`
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="border-bottom:1px solid var(--border);">
        <th style="padding:6px 10px;text-align:left">Sequence</th>
        <th style="padding:6px 10px;text-align:right">Codons</th>
        <th style="padding:6px 10px;text-align:right">GC3%</th>
        <th style="padding:6px 10px;text-align:center">Top codon</th>
        <th style="padding:6px 10px;text-align:center">AA</th>
        <th style="padding:6px 10px;text-align:right">Count</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `, exportBtn('CSV','exportBatchCodonCSV()'));
}

// ── Chart rendering (called after DOM is ready) ────────────────────────────────
document.addEventListener('batchChartsReady', () => {
  if (!window._batchResults) return;
  const {results, checks} = window._batchResults;
  if (checks.gc) {
    const ctx = document.getElementById('batch-gc-chart')?.getContext('2d');
    if (ctx) {
      window._charts.batchGC = new Chart(ctx, {
        type:'bar',
        data:{
          labels: results.map(r=>r.name),
          datasets:[
            {label:'GC%', data:results.map(r=>parseFloat(r.gc?.gc_pct)||0), backgroundColor:'#2563eb', borderRadius:4},
            {label:'AT%', data:results.map(r=>parseFloat(r.gc?.at_pct)||0), backgroundColor:'#16a34a', borderRadius:4},
          ]
        },
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{position:'top',labels:{color:'#888',font:{size:11}}}},
          scales:{x:{ticks:{color:'#888',maxRotation:30}},y:{max:100,ticks:{color:'#888'},title:{display:true,text:'%',color:'#888'}}}}
      });
    }
  }
});

// Trigger chart rendering after DOM update
const _origRender = renderBatchResults;
// Charts need DOM to exist first — use MutationObserver to fire after innerHTML set
function renderBatchResults(results, checks, motifPat, enzymes) {
  _origRender(results, checks, motifPat, enzymes);
  setTimeout(()=>document.dispatchEvent(new Event('batchChartsReady')), 80);
}

// ── Exports ───────────────────────────────────────────────────────────────────
function exportBatchCSV() {
  if (!window._batchResults) return;
  const {results, checks, motifPat, enzymes} = window._batchResults;
  const headers = ['Name','Length_bp'];
  if (checks.gc)      headers.push('GC_pct','AT_pct','A','C','G','T');
  if (checks.orf)     headers.push('Longest_ORF_aa','ORF_start','ORF_end');
  if (checks.trans)   headers.push('Protein_length_aa','Protein_seq');
  if (checks.revcomp) headers.push('Tm','RevComp');
  if (checks.motif)   headers.push(`${motifPat}_hits`,`${motifPat}_positions`);
  if (checks.re)      enzymes.forEach(e=>headers.push(`${e}_cuts`));
  if (checks.prot)    headers.push('MW_kDa','pI','Protein_length_aa');
  if (checks.codon)   headers.push('GC3_pct','Top_codon','Top_AA','Top_count','Total_codons');

  const rows = results.map(r => {
    const row = [r.name, r.length];
    if (checks.gc)      row.push(r.gc?.gc_pct||'',r.gc?.at_pct||'',r.gc?.A||'',r.gc?.C||'',r.gc?.G||'',r.gc?.T||'');
    if (checks.orf)     row.push(r.orf?.lenAA||'',r.orf?.start||'',r.orf?.end||'');
    if (checks.trans)   row.push(r.trans?.length||'',r.trans?.protein||'');
    if (checks.revcomp) row.push(r.revcomp?.tm||'',r.revcomp?.rc||'');
    if (checks.motif)   row.push(r.motif?.hits||0,r.motif?.positions||'');
    if (checks.re)      enzymes.forEach(e=>row.push(r.re?.[e]||0));
    if (checks.prot)    row.push(r.prot?.mw||'',r.prot?.pi||'',r.prot?.length||'');
    if (checks.codon)   row.push(r.codon?.gc3_pct||'',r.codon?.top_codon||'',r.codon?.top_aa||'',r.codon?.top_count||'',r.codon?.total_codons||'');
    return row;
  });
  downloadCSV([headers,...rows], 'bioviz_batch_results.csv');
}

function exportBatchJSON() {
  if (!window._batchResults) return;
  downloadText(JSON.stringify(window._batchResults.results, null, 2), 'bioviz_batch_results.json', 'application/json');
}

function exportBatchORFfasta() {
  if (!window._batchResults) return;
  const seqs = window._batchResults.results
    .filter(r=>r.orf&&r.orf.lenAA>0)
    .map(r=>({name:`${r.name}_ORF_${r.orf.start}-${r.orf.end}_${r.orf.lenAA}aa`, seq:window.sharedSeqs.find(s=>s.name===r.name)?.seq.slice(r.orf.start-1,r.orf.end)||''}));
  if(!seqs.length){showToast('No ORFs found to export.','error');return;}
  downloadFasta(seqs,'batch_orfs.fasta');
}

function exportBatchTransFasta() {
  if (!window._batchResults) return;
  const seqs = window._batchResults.results
    .filter(r=>r.trans&&r.trans.protein&&r.trans.protein!=='—')
    .map(r=>({name:`${r.name}_protein`, seq:r.trans.protein}));
  if(!seqs.length){showToast('No proteins to export.','error');return;}
  downloadFasta(seqs,'batch_proteins.fasta');
}

function exportBatchREcsv() {
  if (!window._batchResults) return;
  const {results,enzymes} = window._batchResults;
  downloadCSV([['Sequence',...enzymes],
    ...results.map(r=>[r.name,...enzymes.map(e=>r.re?.[e]||0)])
  ],'batch_restriction_sites.csv');
}

function exportBatchCodonCSV() {
  if (!window._batchResults) return;
  downloadCSV([['Sequence','Total_codons','GC3_pct','Top_codon','Top_AA','Top_count'],
    ...window._batchResults.results.map(r=>[
      r.name, r.codon?.total_codons||0, r.codon?.gc3_pct||0,
      r.codon?.top_codon||'', r.codon?.top_aa||'', r.codon?.top_count||0
    ])
  ],'batch_codon_usage.csv');
}
