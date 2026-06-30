function translatePanel() {
  return `
  <div class="tool-intro">Translate a DNA coding sequence into protein using the standard genetic code. All three forward reading frames (+1, +2, +3) are shown. Hover amino acid boxes to see full names.</div>
  <div class="input-group">
    <label>DNA coding sequence</label>
    ${seqTextarea('trans-seq', 4, DEMO_SEQS.coding)}
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runTranslate()"><i class="ti ti-arrow-right"></i> Translate</button>
    <button class="btn" onclick="document.getElementById('trans-seq').value=DEMO_SEQS.coding;runTranslate()"><i class="ti ti-flask"></i> Demo</button>
    <button class="btn" onclick="document.getElementById('trans-seq').value='';document.getElementById('trans-result').style.display='none'"><i class="ti ti-trash"></i> Clear</button>
  </div>
  <div id="trans-result" style="display:none;"></div>`;
}

function translateSeq(dna) {
  const s = dna.toUpperCase().replace(/[^ACGT]/g,'');
  const prot = [];
  for (let i=0; i<s.length-2; i+=3) {
    const codon = s.slice(i,i+3);
    prot.push({ codon, aa: CODON_TABLE[codon]||'?' });
  }
  return prot;
}

function aaBoxHTML(entry) {
  if (entry.aa==='*') return `<div class="aa-box aa-stop" data-name="Stop (${entry.codon})">■</div>`;
  const cls = AA_CLASS[entry.aa] ? 'aa-'+AA_CLASS[entry.aa] : 'aa-special';
  return `<div class="aa-box ${cls}" data-name="${entry.aa} (${entry.codon})">${entry.aa.slice(0,1)}</div>`;
}

function runTranslate() {
  const raw = cleanSeq(document.getElementById('trans-seq').value, 'ACGT');
  if (!raw || raw.length < 3) { showToast('Enter a DNA sequence of at least 3 bases.', 'error'); return; }

  const el = document.getElementById('trans-result');
  el.style.display = 'block';

  let html = '';
  const allProteins = [];

  for (let frame=0; frame<3; frame++) {
    const prot = translateSeq(raw.slice(frame));
    const seq1 = prot.map(e=>e.aa==='*'?'*': (Object.keys(AA_CLASS).includes(e.aa)?e.aa.slice(0,1):'?')).join('');
    const firstStop = seq1.indexOf('*');
    const orfLen = firstStop>=0 ? firstStop : seq1.length;

    // Build one-letter protein up to first stop
    const proteinStr = prot.slice(0, firstStop>=0?firstStop:prot.length).map(e=>{
      const map={Ala:'A',Arg:'R',Asn:'N',Asp:'D',Cys:'C',Gln:'Q',Glu:'E',Gly:'G',His:'H',
        Ile:'I',Leu:'L',Lys:'K',Met:'M',Phe:'F',Pro:'P',Ser:'S',Thr:'T',Trp:'W',Tyr:'Y',Val:'V'};
      return map[e.aa]||e.aa.slice(0,1);
    }).join('');

    allProteins.push({ frame:frame+1, protein:proteinStr, length:orfLen });

    html += card(`Reading Frame +${frame+1} <span style="font-weight:400;color:var(--text-3);font-size:11px;">· ${orfLen} aa before first stop</span>`,`
      <div class="protein-vis">${prot.map(aaBoxHTML).join('')}</div>
      <div style="margin-top:8px;font-family:var(--font-mono);font-size:11px;color:var(--text-3);word-break:break-all;">${proteinStr}</div>
    `, exportBtn('FASTA',`exportTranslation(${frame+1})`));
  }

  html += `<div class="legend-row" style="padding-bottom:8px;">
    <div class="legend-item"><div class="legend-dot" style="background:#dbeafe;border:1px solid #93c5fd"></div>Nonpolar</div>
    <div class="legend-item"><div class="legend-dot" style="background:#dcfce7;border:1px solid #86efac"></div>Polar</div>
    <div class="legend-item"><div class="legend-dot" style="background:#fee2e2;border:1px solid #fca5a5"></div>+Charged</div>
    <div class="legend-item"><div class="legend-dot" style="background:#fce7f3;border:1px solid #f9a8d4"></div>−Charged</div>
    <div class="legend-item"><div class="legend-dot" style="background:#fef3c7;border:1px solid #fcd34d"></div>Special</div>
    <div class="legend-item"><div class="legend-dot" style="background:#fee2e2;border:1px solid #f87171"></div>Stop</div>
  </div>`;

  el.innerHTML = html;
  window._transData = { dna: raw, proteins: allProteins };
}

function exportTranslation(frame) {
  if (!window._transData) return;
  const p = window._transData.proteins.find(p=>p.frame===frame);
  if (!p) return;
  downloadFasta([{ name:`Frame_+${frame}`, seq: p.protein }], `translation_frame${frame}.fasta`);
}
