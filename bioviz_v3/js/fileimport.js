function fileimportPanel() {
  return `
  <div class="tool-intro">
    Upload <strong>.fasta / .fa / .fna</strong> files for DNA/RNA sequences, or <strong>.gb / .gbk</strong> GenBank files
    to extract genes, CDS, annotations and translations. Imported sequences are shared across all tools.
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
    ${card('FASTA / FA / FNA', `
      <p style="font-size:12px;color:var(--text-2);margin-bottom:12px;">Multi-sequence FASTA files supported. Each <code>&gt;header</code> block becomes a separate sequence.</p>
      <label class="upload-zone" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="handleFastaDrop(event,this)">
        <i class="ti ti-file-type-txt"></i>
        <span>Drop .fasta / .fa / .fna here</span>
        <small>or click to browse</small>
        <input type="file" accept=".fasta,.fa,.fna,.txt" style="display:none" onchange="loadFastaFile(this)">
      </label>
      <button class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="this.previousElementSibling.previousElementSibling.querySelector('input').click()">
        <i class="ti ti-upload"></i> Choose FASTA file
      </button>
    `)}
    ${card('GenBank / GBK', `
      <p style="font-size:12px;color:var(--text-2);margin-bottom:12px;">Parses LOCUS, DEFINITION, FEATURES (gene, CDS, protein) and ORIGIN sequence.</p>
      <label class="upload-zone" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="handleGbDrop(event,this)">
        <i class="ti ti-file-description"></i>
        <span>Drop .gb / .gbk here</span>
        <small>or click to browse</small>
        <input type="file" accept=".gb,.gbk,.txt" style="display:none" onchange="loadGbFile(this)">
      </label>
      <button class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="this.previousElementSibling.previousElementSibling.querySelector('input').click()">
        <i class="ti ti-upload"></i> Choose GenBank file
      </button>
    `)}
  </div>
  <div id="import-result"></div>
  ${card('Or paste sequences manually', `
    <textarea id="paste-seq" rows="5" placeholder=">Seq1&#10;ATGCGATCGATCG&#10;>Seq2&#10;GCTAGCTAGCTA" style="font-family:var(--font-mono);font-size:12px;"></textarea>
    <div class="btn-row" style="margin-top:8px;">
      <button class="btn btn-primary" onclick="parsePasted()"><i class="ti ti-check"></i> Parse &amp; Import</button>
      <button class="btn" onclick="clearImported()"><i class="ti ti-trash"></i> Clear all</button>
    </div>
  `)}
  <div id="imported-list" style="margin-top:16px;"></div>`;
}

function parseFasta(text) {
  const seqs = []; let current = null;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('>')) {
      if (current) seqs.push(current);
      current = { name: t.slice(1).split(/\s+/)[0], header: t.slice(1), seq: '', type: 'fasta' };
    } else if (current) current.seq += t.toUpperCase().replace(/[^ACGTURYNWSKMBDHV]/g,'');
  }
  if (current) seqs.push(current);
  return seqs;
}

function parseGenBank(text) {
  const lines = text.split(/\r?\n/);
  const result = { name:'', definition:'', accession:'', organism:'', features:[], seq:'' };
  let inFeatures=false, inOrigin=false, currentFeature=null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (line.startsWith('LOCUS'))      result.name       = line.split(/\s+/)[1]||'Unknown';
    if (line.startsWith('DEFINITION')) result.definition = trimmed.replace('DEFINITION','').trim();
    if (line.startsWith('ACCESSION'))  result.accession  = trimmed.split(/\s+/)[1]||'';
    if (line.startsWith('  ORGANISM')) result.organism   = trimmed.replace('ORGANISM','').trim();
    if (line.startsWith('FEATURES'))   { inFeatures=true; inOrigin=false; continue; }
    if (line.startsWith('ORIGIN'))     { inFeatures=false; inOrigin=true; continue; }
    if (line.startsWith('//'))          inOrigin=false;
    if (inOrigin) result.seq += trimmed.replace(/[^acgturyn]/gi,'').toUpperCase();
    if (inFeatures) {
      if (/^     \S/.test(line)) {
        if (currentFeature) result.features.push(currentFeature);
        const parts = trimmed.split(/\s+/);
        currentFeature = { type:parts[0], location:parts.slice(1).join(' '), qualifiers:{} };
      } else if (currentFeature && /^                     \//.test(line)) {
        const m = trimmed.match(/^\/(\w+)="?([^"]*)"?$/);
        if (m) currentFeature.qualifiers[m[1]] = m[2];
        else { const k=trimmed.match(/^\/(\w+)/); if(k) currentFeature.qualifiers[k[1]]=true; }
      }
    }
  }
  if (currentFeature) result.features.push(currentFeature);
  return result;
}

function handleFastaDrop(e, zone) {
  e.preventDefault(); zone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) readAndParseFasta(file);
}
function handleGbDrop(e, zone) {
  e.preventDefault(); zone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) readAndParseGb(file);
}
function loadFastaFile(input) { if (input.files[0]) readAndParseFasta(input.files[0]); }
function loadGbFile(input)    { if (input.files[0]) readAndParseGb(input.files[0]); }

function readAndParseFasta(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const seqs = parseFasta(e.target.result);
    if (!seqs.length) { showToast('No valid sequences found in file.', 'error'); return; }
    seqs.forEach(s => addSharedSeq(s));
    showToast(`Imported ${seqs.length} sequence(s) from ${file.name}`, 'success');
    renderImportedList();
  };
  reader.readAsText(file);
}

function readAndParseGb(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const gb = parseGenBank(e.target.result);
    addSharedSeq({ name:gb.name||file.name, header:gb.definition, seq:gb.seq, type:'genbank', genbank:gb });
    showToast(`Imported GenBank: ${gb.name} (${gb.seq.length} bp, ${gb.features.length} features)`, 'success');
    if (gb.features.length) renderGbFeatures(gb);
    renderImportedList();
  };
  reader.readAsText(file);
}

function parsePasted() {
  const text = document.getElementById('paste-seq').value;
  if (!text.trim()) { showToast('Paste a sequence first.', 'error'); return; }
  const seqs = parseFasta(text.trim().startsWith('>') ? text : `>Pasted\n${text}`);
  seqs.forEach(s => addSharedSeq(s));
  showToast(`Imported ${seqs.length} sequence(s)`, 'success');
  renderImportedList();
}

function addSharedSeq(s) {
  if (!window.sharedSeqs.find(x => x.name===s.name && x.seq===s.seq))
    window.sharedSeqs.push(s);
}
function clearImported() {
  window.sharedSeqs = [];
  renderImportedList();
  showToast('All imported sequences cleared.', 'info');
}
function removeSharedSeq(i) { window.sharedSeqs.splice(i,1); renderImportedList(); }

function renderImportedList() {
  const el = document.getElementById('imported-list');
  if (!el || !window.sharedSeqs.length) { if(el) el.innerHTML=''; return; }
  el.innerHTML = card(`Imported sequences (${window.sharedSeqs.length})`, `
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${window.sharedSeqs.map((s,i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--surface-2);border-radius:var(--radius);border:1px solid var(--border);">
          <div>
            <span style="font-weight:600;font-size:13px;">${s.name}</span>
            <span style="font-size:11px;color:var(--text-3);margin-left:8px;">${s.seq.length.toLocaleString()} bp</span>
            <span style="font-size:10px;background:var(--accent-bg);color:var(--accent);padding:1px 7px;border-radius:100px;margin-left:6px;">${s.type||'fasta'}</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm" onclick="downloadFasta([window.sharedSeqs[${i}]],'${s.name}.fasta')"><i class="ti ti-download"></i></button>
            <button class="btn btn-sm" onclick="removeSharedSeq(${i})" style="color:var(--red)"><i class="ti ti-trash"></i></button>
          </div>
        </div>`).join('')}
    </div>
  `, exportBtn('All as FASTA','downloadFasta(window.sharedSeqs,"sequences.fasta")'));
}

function renderGbFeatures(gb) {
  const el = document.getElementById('import-result');
  if (!el) return;
  const genes = gb.features.filter(f=>f.type==='gene'||f.type==='CDS');
  if (!genes.length) return;
  el.innerHTML = card('GenBank features', `
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="border-bottom:1px solid var(--border);">
        <th style="padding:5px 8px;text-align:left">Type</th>
        <th style="padding:5px 8px;text-align:left">Location</th>
        <th style="padding:5px 8px;text-align:left">Gene</th>
        <th style="padding:5px 8px;text-align:left">Product</th>
      </tr></thead>
      <tbody>${genes.map(f=>`
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:5px 8px;font-weight:600;color:var(--accent)">${f.type}</td>
          <td style="padding:5px 8px;font-family:var(--font-mono);font-size:11px;">${f.location}</td>
          <td style="padding:5px 8px;">${f.qualifiers.gene||'—'}</td>
          <td style="padding:5px 8px;">${f.qualifiers.product||f.qualifiers.protein_id||'—'}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>
  `, exportBtn('CSV','exportGBfeatures()'));
  window._gbFeatures = genes;
}

function exportGBfeatures() {
  if (!window._gbFeatures) return;
  downloadCSV(
    [['Type','Location','Gene','Product'],
     ...window._gbFeatures.map(f=>[f.type,f.location,f.qualifiers.gene||'',f.qualifiers.product||''])],
    'genbank_features.csv'
  );
}
