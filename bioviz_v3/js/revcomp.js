function revcompPanel() {
  return `
  <div class="tool-intro">Computes the reverse complement of a DNA sequence — the antisense strand read 5'→3'. Also shows the complement (without reversal) and approximate melting temperature.</div>
  <div class="input-group">
    <label>DNA sequence (5' → 3')</label>
    ${seqTextarea('rc-seq', 4, DEMO_SEQS.multi)}
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runRevComp()"><i class="ti ti-refresh"></i> Compute</button>
    <button class="btn" onclick="document.getElementById('rc-seq').value=DEMO_SEQS.multi;runRevComp()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="rc-result" style="display:none;"></div>`;
}

const COMP_MAP = {A:'T',T:'A',G:'C',C:'G',N:'N',R:'Y',Y:'R',W:'W',S:'S',K:'M',M:'K',B:'V',V:'B',D:'H',H:'D'};
function complement(b) { return COMP_MAP[b] || b; }
function revCompStr(seq) { return seq.split('').reverse().map(complement).join(''); }

function calcTm(seq) {
  // Wallace rule for short (<14 nt), nearest-neighbor simplified for longer
  const cnt = {A:0,T:0,G:0,C:0};
  seq.split('').forEach(b => { if(b in cnt) cnt[b]++; });
  const n = cnt.A+cnt.T+cnt.G+cnt.C;
  if (!n) return '—';
  if (n < 14) return `${2*(cnt.A+cnt.T) + 4*(cnt.G+cnt.C)} °C (Wallace)`;
  // Simplified: 64.9 + 41*(GC-16.4)/N
  const tm = (64.9 + 41*(cnt.G+cnt.C-16.4)/n).toFixed(1);
  return `${tm} °C`;
}

function runRevComp() {
  const raw = cleanDNA(document.getElementById('rc-seq').value);
  if (!raw.length) { showToast('Enter a sequence.','error'); return; }

  const rc   = revCompStr(raw);
  const comp = raw.split('').map(complement).join('');
  const cnt  = {A:0,T:0,G:0,C:0};
  raw.split('').forEach(b=>{ if(b in cnt) cnt[b]++; });
  const gc   = ((cnt.G+cnt.C)/raw.length*100).toFixed(1);
  const tm   = calcTm(raw);

  // Double-strand view chunked at 60 bp
  const CHUNK=60;
  let ds = '';
  for(let i=0;i<raw.length;i+=CHUNK){
    const r=raw.slice(i,i+CHUNK), c=comp.slice(i,i+CHUNK);
    const pos=String(i+1).padStart(5,' ');
    ds+=`<div style="margin-bottom:8px;font-size:11px;">
      <span style="color:var(--text-3)">${pos}</span> 5' ${colorSeq(r,r.length)} 3'<br>
      <span style="color:var(--text-3)">${' '.repeat(pos.length)}</span>    ${r.split('').map(()=>'|').join('')}<br>
      <span style="color:var(--text-3)">${String(i+c.length).padStart(pos.length,' ')}</span> 3' ${colorSeq(c,c.length)} 5'
    </div>`;
  }

  const el = document.getElementById('rc-result');
  el.style.display='block';
  el.innerHTML=`
    ${statGrid([
      {v:raw.length+' bp', l:'Length'},
      {v:gc+'%', l:'GC content'},
      {v:tm, l:'Approx. Tm'},
      {v:cnt.A+'/'+cnt.T+'/'+cnt.G+'/'+cnt.C, l:'A/T/G/C'},
    ])}
    ${card("Original 5'→3'", `<div class="seq-display">${colorSeq(raw)}</div>`,
      exportBtn('FASTA','exportRC("orig")'))}
    ${card("Reverse complement 5'→3'", `<div class="seq-display">${colorSeq(rc)}</div>`,
      exportBtn('FASTA','exportRC("rc")'))}
    ${card('Double-stranded view', `<div class="seq-display" style="overflow-x:auto;white-space:nowrap;">${ds}</div>`,
      exportBtn('Text','exportRC("ds")'))}
  `;
  window._rcData={raw,rc,comp,ds};
}

function exportRC(type){
  if(!window._rcData) return;
  const {raw,rc} = window._rcData;
  if(type==='orig') downloadFasta([{name:'original',seq:raw}],'original.fasta');
  else if(type==='rc') downloadFasta([{name:'reverse_complement',seq:rc}],'reverse_complement.fasta');
  else downloadText(`Original:          5'-${raw}-3'\nRevComp:           5'-${rc}-3'`,'sequences.txt');
}
