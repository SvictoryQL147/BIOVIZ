function alignPanel() {
  return `
  <div class="tool-intro">Global pairwise alignment using <strong>Needleman-Wunsch</strong> dynamic programming. Configure match, mismatch and gap scores. Works on DNA, RNA, or protein. Max 200 characters per sequence.</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div class="input-group">
      <label>Sequence A</label>
      <textarea id="align-a" rows="3" style="font-family:var(--font-mono);font-size:12px;" placeholder="Sequence A…">GCATGCU</textarea>
    </div>
    <div class="input-group">
      <label>Sequence B</label>
      <textarea id="align-b" rows="3" style="font-family:var(--font-mono);font-size:12px;" placeholder="Sequence B…">GATTACA</textarea>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
    <div class="input-group" style="margin:0"><label>Match</label><input type="number" id="a-match" value="1" style="height:36px;"></div>
    <div class="input-group" style="margin:0"><label>Mismatch</label><input type="number" id="a-mismatch" value="-1" style="height:36px;"></div>
    <div class="input-group" style="margin:0"><label>Gap</label><input type="number" id="a-gap" value="-2" style="height:36px;"></div>
  </div>
  <div class="btn-row">
    <button class="btn btn-primary" onclick="runAlign()"><i class="ti ti-arrows-horizontal"></i> Align</button>
    <button class="btn" onclick="document.getElementById('align-a').value='GCATGCU';document.getElementById('align-b').value='GATTACA';runAlign()"><i class="ti ti-flask"></i> Demo</button>
  </div>
  <div id="align-result" style="display:none;"></div>`;
}

function needlemanWunsch(a, b, ms=1, mm=-1, gp=-2) {
  const n=a.length, m=b.length;
  const dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=0;i<=n;i++) dp[i][0]=i*gp;
  for(let j=0;j<=m;j++) dp[0][j]=j*gp;
  for(let i=1;i<=n;i++) for(let j=1;j<=m;j++)
    dp[i][j]=Math.max(dp[i-1][j-1]+(a[i-1]===b[j-1]?ms:mm), dp[i-1][j]+gp, dp[i][j-1]+gp);
  let i=n,j=m,ra='',rb='',cons='';
  while(i>0||j>0){
    if(i>0&&j>0&&dp[i][j]===dp[i-1][j-1]+(a[i-1]===b[j-1]?ms:mm)){
      ra=a[i-1]+ra;rb=b[j-1]+rb;cons=(a[i-1]===b[j-1]?'|':'.')+cons;i--;j--;
    } else if(i>0&&dp[i][j]===dp[i-1][j]+gp){ra=a[i-1]+ra;rb='-'+rb;cons='-'+cons;i--;}
    else{ra='-'+ra;rb=b[j-1]+rb;cons='-'+cons;j--;}
  }
  const matches=([...cons].filter(c=>c==='|').length);
  const mismatches=([...cons].filter(c=>c==='.').length);
  const gaps=([...cons].filter(c=>c==='-').length);
  return {ra,rb,cons,score:dp[n][m],matches,mismatches,gaps,
    identity:(matches/cons.length*100).toFixed(1),
    similarity:((matches+mismatches)/cons.length*100).toFixed(1)};
}

function runAlign() {
  const a   = document.getElementById('align-a').value.toUpperCase().replace(/\s/g,'');
  const b   = document.getElementById('align-b').value.toUpperCase().replace(/\s/g,'');
  const ms  = parseInt(document.getElementById('a-match').value)||1;
  const mm  = parseInt(document.getElementById('a-mismatch').value)||-1;
  const gp  = parseInt(document.getElementById('a-gap').value)||-2;

  if (!a||!b) { showToast('Enter both sequences.','error'); return; }
  if (a.length>200||b.length>200) { showToast('Max 200 characters per sequence.','error'); return; }

  const r=needlemanWunsch(a,b,ms,mm,gp);

  const faH=r.ra.split('').map((c,i)=>{
    const cl=r.cons[i]==='|'?'align-match':r.cons[i]==='-'?'align-gap':'align-mismatch';
    return `<span class="${cl}">${c}</span>`;
  }).join('');
  const fcH=r.cons.split('').map(c=>{
    const cl=c==='|'?'align-match':c==='-'?'align-gap':'align-mismatch';
    return `<span class="${cl}">${c}</span>`;
  }).join('');
  const fbH=r.rb.split('').map((c,i)=>{
    const cl=r.cons[i]==='|'?'align-match':r.cons[i]==='-'?'align-gap':'align-mismatch';
    return `<span class="${cl}">${c}</span>`;
  }).join('');

  const el=document.getElementById('align-result');
  el.style.display='block';
  el.innerHTML=`
    ${statGrid([
      {v:r.score, l:'Alignment score'},
      {v:r.identity+'%', l:'Identity'},
      {v:r.similarity+'%', l:'Similarity'},
      {v:r.matches, l:'Matches'},
      {v:r.mismatches, l:'Mismatches'},
      {v:r.gaps, l:'Gaps'},
      {v:r.cons.length, l:'Aligned length'},
    ])}
    ${card('Global Alignment', `
      <div class="align-block">
        <div>A: ${faH}</div>
        <div style="padding-left:22px;color:var(--text-3);">${fcH}</div>
        <div>B: ${fbH}</div>
      </div>
      <div class="legend-row">
        <div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>Match</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>Mismatch</div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--text-3)"></div>Gap</div>
      </div>`,
      exportBtn('Text','exportAlignment()')
    )}
  `;
  window._alignData={a,b,r};
}

function exportAlignment(){
  if(!window._alignData) return;
  const {a,b,r}=window._alignData;
  const txt=`BioViz Pairwise Alignment
==========================
Score:      ${r.score}
Identity:   ${r.identity}%
Similarity: ${r.similarity}%
Matches:    ${r.matches}
Mismatches: ${r.mismatches}
Gaps:       ${r.gaps}

A: ${r.ra}
   ${r.cons}
B: ${r.rb}`;
  downloadText(txt,'alignment.txt');
}
