// bioworker.js — runs in a separate thread, never blocks the UI
// All heavy algorithms live here: ORF finder, NJ tree, batch analysis, MSA

// ── Codon table (must be self-contained — workers have no DOM access) ─────────
const CODON_TABLE = {
  TTT:'Phe',TTC:'Phe',TTA:'Leu',TTG:'Leu',CTT:'Leu',CTC:'Leu',CTA:'Leu',CTG:'Leu',
  ATT:'Ile',ATC:'Ile',ATA:'Ile',ATG:'Met',GTT:'Val',GTC:'Val',GTA:'Val',GTG:'Val',
  TCT:'Ser',TCC:'Ser',TCA:'Ser',TCG:'Ser',CCT:'Pro',CCC:'Pro',CCA:'Pro',CCG:'Pro',
  ACT:'Thr',ACC:'Thr',ACA:'Thr',ACG:'Thr',GCT:'Ala',GCC:'Ala',GCA:'Ala',GCG:'Ala',
  TAT:'Tyr',TAC:'Tyr',TAA:'*',TAG:'*',CAT:'His',CAC:'His',CAA:'Gln',CAG:'Gln',
  AAT:'Asn',AAC:'Asn',AAA:'Lys',AAG:'Lys',GAT:'Asp',GAC:'Asp',GAA:'Glu',GAG:'Glu',
  TGT:'Cys',TGC:'Cys',TGA:'*',TGG:'Trp',CGT:'Arg',CGC:'Arg',CGA:'Arg',CGG:'Arg',
  AGT:'Ser',AGC:'Ser',AGA:'Arg',AGG:'Arg',GGT:'Gly',GGC:'Gly',GGA:'Gly',GGG:'Gly'
};

const AA3TO1 = {Ala:'A',Arg:'R',Asn:'N',Asp:'D',Cys:'C',Gln:'Q',Glu:'E',Gly:'G',
  His:'H',Ile:'I',Leu:'L',Lys:'K',Met:'M',Phe:'F',Pro:'P',Ser:'S',Thr:'T',Trp:'W',Tyr:'Y',Val:'V'};

const RC_MAP = {A:'T',T:'A',G:'C',C:'G',N:'N'};

// ── Message router ─────────────────────────────────────────────────────────────
self.onmessage = function(e) {
  const { id, type, data } = e.data;
  try {
    let result;
    switch(type) {
      case 'orf':       result = workerFindORFs(data.seq, data.minAA, data.allFrames); break;
      case 'phylo':     result = workerNJ(data.taxa, data.seqs, data.method); break;
      case 'batch':     result = workerBatch(data.seqs, data.checks, data.motifPat, data.enzymes); break;
      case 'align':     result = workerNW(data.a, data.b, data.ms, data.mm, data.gp); break;
      case 'msa':       result = workerMSA(data.seqs); break;
      case 'sw':        result = workerSW(data.a, data.b, data.ms, data.mm, data.gp); break;
      default: throw new Error('Unknown task type: ' + type);
    }
    self.postMessage({ id, status:'ok', result });
  } catch(err) {
    self.postMessage({ id, status:'error', error: err.message });
  }
};

// ── ORF Finder ────────────────────────────────────────────────────────────────
function workerFindORFs(seq, minAA, allFrames) {
  const STOP = new Set(['TAA','TAG','TGA']);
  const results = [];
  const strands = allFrames ? [[seq,'+'],[revCompStr(seq),'-']] : [[seq,'+']];
  strands.forEach(([s,strand]) => {
    for (let frame=0; frame<3; frame++) {
      let inORF=false, start=-1;
      for (let i=frame; i<s.length-2; i+=3) {
        const codon = s.slice(i,i+3);
        if (!inORF && codon==='ATG') { inORF=true; start=i; }
        else if (inORF && STOP.has(codon)) {
          const lenAA = Math.floor((i-start)/3);
          if (lenAA >= minAA) {
            const dna = s.slice(start, i+3);
            const gStart = strand==='+' ? start : seq.length-(i+3);
            const gEnd   = strand==='+' ? i+3   : seq.length-start;
            results.push({
              strand, frame: strand==='+'?frame+1:-(frame+1),
              start:gStart+1, end:gEnd, lenBP:dna.length, lenAA,
              protein: translateStr(dna), stopCodon: codon
            });
          }
          inORF=false; start=-1;
        }
      }
    }
  });
  return results.sort((a,b) => b.lenAA-a.lenAA);
}

function revCompStr(s) { return s.split('').reverse().map(b=>RC_MAP[b]||b).join(''); }

function translateStr(dna) {
  let p='';
  for (let i=0; i<dna.length-2; i+=3) {
    const aa = CODON_TABLE[dna.slice(i,i+3)];
    if (!aa||aa==='*') break;
    p += AA3TO1[aa] || aa.slice(0,1);
  }
  return p || '?';
}

// ── Needleman-Wunsch ──────────────────────────────────────────────────────────
function workerNW(a, b, ms=1, mm=-1, gp=-2) {
  const n=a.length, m=b.length;
  const dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=0;i<=n;i++) dp[i][0]=i*gp;
  for(let j=0;j<=m;j++) dp[0][j]=j*gp;
  for(let i=1;i<=n;i++) for(let j=1;j<=m;j++)
    dp[i][j]=Math.max(dp[i-1][j-1]+(a[i-1]===b[j-1]?ms:mm),dp[i-1][j]+gp,dp[i][j-1]+gp);
  let i=n,j=m,ra='',rb='',cons='';
  while(i>0||j>0){
    if(i>0&&j>0&&dp[i][j]===dp[i-1][j-1]+(a[i-1]===b[j-1]?ms:mm)){
      ra=a[i-1]+ra;rb=b[j-1]+rb;cons=(a[i-1]===b[j-1]?'|':'.')+cons;i--;j--;
    } else if(i>0&&dp[i][j]===dp[i-1][j]+gp){ra=a[i-1]+ra;rb='-'+rb;cons='-'+cons;i--;}
    else{ra='-'+ra;rb=b[j-1]+rb;cons='-'+cons;j--;}
  }
  const matches=[...cons].filter(c=>c==='|').length;
  const mismatches=[...cons].filter(c=>c==='.').length;
  const gaps=[...cons].filter(c=>c==='-').length;
  return{ra,rb,cons,score:dp[n][m],matches,mismatches,gaps,
    identity:(matches/cons.length*100).toFixed(1),
    similarity:((matches+mismatches)/cons.length*100).toFixed(1)};
}

// ── Smith-Waterman local alignment ────────────────────────────────────────────
function workerSW(a, b, ms=2, mm=-1, gp=-2) {
  const n=a.length, m=b.length;
  const dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  let maxScore=0, maxI=0, maxJ=0;
  for(let i=1;i<=n;i++) for(let j=1;j<=m;j++){
    dp[i][j]=Math.max(0,
      dp[i-1][j-1]+(a[i-1]===b[j-1]?ms:mm),
      dp[i-1][j]+gp, dp[i][j-1]+gp);
    if(dp[i][j]>maxScore){maxScore=dp[i][j];maxI=i;maxJ=j;}
  }
  // Traceback
  let i=maxI,j=maxJ,ra='',rb='',cons='';
  while(i>0&&j>0&&dp[i][j]>0){
    if(dp[i][j]===dp[i-1][j-1]+(a[i-1]===b[j-1]?ms:mm)){
      ra=a[i-1]+ra;rb=b[j-1]+rb;cons=(a[i-1]===b[j-1]?'|':'.')+cons;i--;j--;
    } else if(dp[i][j]===dp[i-1][j]+gp){ra=a[i-1]+ra;rb='-'+rb;cons='-'+cons;i--;}
    else{ra='-'+ra;rb=b[j-1]+rb;cons='-'+cons;j--;}
  }
  const startA=i, startB=j;
  const matches=[...cons].filter(c=>c==='|').length;
  return{ra,rb,cons,score:maxScore,matches,
    identity:cons.length?(matches/cons.length*100).toFixed(1):'0',
    startA:startA+1,startB:startB+1,
    endA:maxI,endB:maxJ};
}

// ── Multiple Sequence Alignment (progressive, ClustalW-style) ─────────────────
function workerMSA(seqs) {
  if (seqs.length < 2) return { aligned: seqs.map(s=>({name:s.name,seq:s.seq})), score:0 };
  if (seqs.length === 2) {
    const r = workerNW(seqs[0].seq, seqs[1].seq);
    return { aligned:[{name:seqs[0].name,seq:r.ra},{name:seqs[1].name,seq:r.rb}],
      score:r.score, identity:r.identity };
  }

  // Build pairwise distance matrix
  const n = seqs.length;
  const D = Array.from({length:n},()=>new Array(n).fill(0));
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
    const r = workerNW(seqs[i].seq.slice(0,300), seqs[j].seq.slice(0,300));
    const dist = 1 - parseFloat(r.identity)/100;
    D[i][j] = D[j][i] = dist;
  }

  // Guide tree: UPGMA (simpler than NJ, good enough for MSA guide)
  const clusters = seqs.map((s,i) => ({seqs:[i], dist:D}));
  const order = [];
  const remaining = seqs.map((_,i)=>i);

  while (remaining.length > 1) {
    let minD=Infinity, mi=0, mj=1;
    for(let a=0;a<remaining.length;a++) for(let b=a+1;b<remaining.length;b++){
      if(D[remaining[a]][remaining[b]]<minD){minD=D[remaining[a]][remaining[b]];mi=a;mj=b;}
    }
    order.push([remaining[mi],remaining[mj]]);
    // merge: average distances
    const newIdx = remaining[mi];
    remaining.splice(mj,1);
    for(const k of remaining){
      if(k===newIdx) continue;
      D[newIdx][k]=D[k][newIdx]=(D[remaining[mi]||newIdx][k]+D[remaining[mj]||newIdx][k])/2;
    }
    remaining.splice(remaining.indexOf(newIdx)+1,1,'merged');
  }

  // Progressive alignment following guide tree order
  let aligned = [{name:seqs[order[0][0]].name, seq:seqs[order[0][0]].seq},
                 {name:seqs[order[0][1]].name, seq:seqs[order[0][1]].seq}];
  const r0 = workerNW(aligned[0].seq, aligned[1].seq);
  aligned[0].seq = r0.ra; aligned[1].seq = r0.rb;

  for(let k=1;k<order.length;k++){
    const newSeq = seqs[order[k][1]];
    // Align new sequence against consensus
    const consensus = buildConsensus(aligned.map(a=>a.seq));
    const r = workerNW(consensus, newSeq.seq);
    // Apply gaps from consensus alignment to all existing sequences
    const gapMask = r.ra;
    aligned = aligned.map(a => ({name:a.name, seq:applyGapMask(a.seq, gapMask)}));
    aligned.push({name:newSeq.name, seq:r.rb});
  }

  // Calculate pairwise identity from alignment
  const len = aligned[0].seq.length;
  let totalMatches=0, totalCols=0;
  for(let col=0;col<len;col++){
    const bases = aligned.map(a=>a.seq[col]||'-').filter(b=>b!=='-');
    if(bases.length>1){
      totalCols++;
      const mode = bases.sort().find((b,i,a)=>a.indexOf(b)!==i||i===a.length-1);
      totalMatches += bases.filter(b=>b===mode).length/bases.length;
    }
  }

  return {
    aligned,
    length: len,
    avgIdentity: totalCols?(totalMatches/totalCols*100).toFixed(1):'0',
    nSeqs: seqs.length
  };
}

function buildConsensus(seqs) {
  const len = Math.max(...seqs.map(s=>s.length));
  let cons='';
  for(let i=0;i<len;i++){
    const cnt={};
    seqs.forEach(s=>{ const b=s[i]||'-'; if(b!=='-') cnt[b]=(cnt[b]||0)+1; });
    const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
    cons+=best?best[0]:'-';
  }
  return cons;
}

function applyGapMask(seq, mask) {
  let result='', si=0;
  for(let i=0;i<mask.length;i++){
    if(mask[i]==='-') result+='-';
    else result+=seq[si++]||'-';
  }
  return result;
}

// ── Neighbor-joining ──────────────────────────────────────────────────────────
function pDist(a,b){const n=Math.min(a.length,b.length);if(!n)return 1;let d=0;for(let i=0;i<n;i++)if(a[i]!==b[i])d++;return d/n;}
function jcDist(a,b){const p=pDist(a,b);return p>=0.75?2:-0.75*Math.log(1-4/3*p);}

function workerNJ(taxa, seqs, method) {
  const distFn = method==='jc' ? jcDist : pDist;
  const D = taxa.map((_,i)=>taxa.map((_,j)=>i===j?0:distFn(seqs[i],seqs[j])));
  const meanDist = D.flat().filter(v=>v>0).reduce((s,v)=>s+v,0)/(taxa.length*(taxa.length-1));

  let labels=[...taxa], nodes=labels.map(l=>({name:l,children:[],bl:0})), n=labels.length;
  let d=D.map(r=>[...r]);

  while(n>2){
    const rowSums=d.map((row,i)=>row.reduce((s,v,j)=>i!==j?s+v:s,0));
    let minQ=Infinity,mi=0,mj=1;
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
      const q=(n-2)*d[i][j]-rowSums[i]-rowSums[j];
      if(q<minQ){minQ=q;mi=i;mj=j;}
    }
    const dij=d[mi][mj];
    const bli=dij/2+(rowSums[mi]-rowSums[mj])/(2*(n-2));
    const blj=dij-bli;
    const newNode={name:`(${labels[mi]},${labels[mj]})`,
      children:[{...nodes[mi],bl:Math.max(0,bli)},{...nodes[mj],bl:Math.max(0,blj)}],bl:0};
    const keep=[...Array(n).keys()].filter(k=>k!==mi&&k!==mj);
    const newRow=keep.map(k=>(d[mi][k]+d[mj][k]-dij)/2);
    const newD=keep.map((i,ri)=>keep.map((j,rj)=>d[i][j]));
    newD.forEach((r,ri)=>r.push(newRow[ri]));
    newD.push([...newRow,0]);
    labels=keep.map(i=>labels[i]); labels.push(newNode.name);
    nodes=keep.map(i=>nodes[i]); nodes.push(newNode);
    d=newD; n=labels.length;
  }
  const tree={name:'root',children:[{...nodes[0],bl:d[0][1]/2},{...nodes[1],bl:d[0][1]/2}],bl:0};
  return {tree, D, meanDist};
}

// ── Batch analysis ─────────────────────────────────────────────────────────────
function workerBatch(seqs, checks, motifPat, enzymes) {
  const STOP=new Set(['TAA','TAG','TGA']);
  const IUPAC={N:'[ACGTU]',R:'[AG]',Y:'[CT]',W:'[AT]',S:'[GC]',K:'[GT]',M:'[AC]',B:'[CGT]',D:'[AGT]',H:'[ACT]',V:'[ACG]'};
  const RE_IUPAC={N:'[ACGT]',R:'[AG]',Y:'[CT]',W:'[AT]',S:'[GC]',K:'[GT]',M:'[AC]'};
  const MW_T={A:89.09,R:174.20,N:132.12,D:133.10,C:121.16,Q:146.15,E:147.13,G:75.03,H:155.16,I:131.17,L:131.17,K:146.19,M:149.21,F:165.19,P:115.13,S:105.09,T:119.12,W:204.23,Y:181.19,V:117.15};
  const PKA={D:3.9,E:4.1,C:8.3,Y:10.1,H:6.0,K:10.5,R:12.5};

  const total = seqs.length;
  return seqs.map((s, idx) => {
    self.postMessage({id:'progress', pct:Math.round(idx/total*100), label:`${s.name} (${idx+1}/${total})`});
    const seq = s.seq.toUpperCase().replace(/[^ACGTU]/g,'');
    const row = {name:s.name, length:seq.length};

    if(checks.gc){
      const cnt={A:0,T:0,G:0,C:0,U:0};
      for(const b of seq) if(b in cnt) cnt[b]++;
      const isRNA=cnt.U>cnt.T, N4=isRNA?cnt.U:cnt.T;
      row.gc={length:seq.length, gc_pct:seq.length?((cnt.G+cnt.C)/seq.length*100).toFixed(1):'0',
        at_pct:seq.length?((cnt.A+N4)/seq.length*100).toFixed(1):'0',A:cnt.A,C:cnt.C,G:cnt.G,T:N4};
    }

    if(checks.orf){
      const s2=seq.replace(/[^ACGT]/g,'');
      let longest=null;
      for(let frame=0;frame<3;frame++){
        let inORF=false,start=-1;
        for(let i=frame;i<s2.length-2;i+=3){
          const c=s2.slice(i,i+3);
          if(!inORF&&c==='ATG'){inORF=true;start=i;}
          else if(inORF&&STOP.has(c)){
            const len=Math.floor((i-start)/3);
            if(!longest||len>longest.lenAA) longest={start:start+1,end:i+3,lenAA:len,lenBP:i+3-start};
            inORF=false;
          }
        }
      }
      row.orf=longest||{start:'—',end:'—',lenAA:0,lenBP:0};
    }

    if(checks.trans){
      const s2=seq.replace(/[^ACGT]/g,'');
      let prot='';
      for(let i=0;i<s2.length-2;i+=3){
        const aa=CODON_TABLE[s2.slice(i,i+3)]; if(!aa||aa==='*') break;
        prot+=AA3TO1[aa]||'?';
      }
      row.trans={protein:prot||'—',length:prot.length};
    }

    if(checks.revcomp){
      const s2=seq.replace(/[^ACGTN]/g,'');
      const rc=s2.split('').reverse().map(b=>RC_MAP[b]||b).join('');
      const cnt={A:0,T:0,G:0,C:0}; s2.split('').forEach(b=>{if(b in cnt)cnt[b]++;});
      const n2=cnt.A+cnt.T+cnt.G+cnt.C;
      const tm=n2<14?2*(cnt.A+cnt.T)+4*(cnt.G+cnt.C):(64.9+41*(cnt.G+cnt.C-16.4)/n2).toFixed(1);
      row.revcomp={rc,tm:tm+'°C'};
    }

    if(checks.motif&&motifPat){
      try{
        const re=new RegExp(motifPat.toUpperCase().split('').map(c=>IUPAC[c]||c).join(''),'gi');
        const hits=[]; let m2;
        while((m2=re.exec(seq))!==null){hits.push(m2.index+1);re.lastIndex=m2.index+1;}
        row.motif={hits:hits.length,positions:hits.slice(0,5).join(';')+(hits.length>5?'…':'')};
      }catch(e){row.motif={hits:0,positions:'Invalid pattern'};}
    }

    if(checks.re&&enzymes){
      row.re={};
      // Import RESTRICTION_ENZYMES data inline
      const ENZYMES=[
        {name:'EcoRI',site:'GAATTC'},{name:'BamHI',site:'GGATCC'},{name:'HindIII',site:'AAGCTT'},
        {name:'SalI',site:'GTCGAC'},{name:'XhoI',site:'CTCGAG'},{name:'NcoI',site:'CCATGG'},
        {name:'XbaI',site:'TCTAGA'},{name:'SmaI',site:'CCCGGG'},{name:'KpnI',site:'GGTACC'},
        {name:'SacI',site:'GAGCTC'},{name:'EcoRV',site:'GATATC'},{name:'PstI',site:'CTGCAG'},
        {name:'SphI',site:'GCATGC'},{name:'ClaI',site:'ATCGAT'},{name:'NheI',site:'GCTAGC'},
        {name:'MluI',site:'ACGCGT'},{name:'ApaI',site:'GGGCCC'},{name:'NotI',site:'GCGGCCGC'},
        {name:'AscI',site:'GGCGCGCC'},{name:'PacI',site:'TTAATTAA'},{name:'BglII',site:'AGATCT'},
        {name:'AgeI',site:'ACCGGT'},{name:'MspI',site:'CCGG'},{name:'TaqI',site:'TCGA'},
        {name:'HaeIII',site:'GGCC'},{name:'AluI',site:'AGCT'},{name:'RsaI',site:'GTAC'},
      ];
      enzymes.forEach(name=>{
        const e=ENZYMES.find(e=>e.name===name); if(!e) return;
        const re=new RegExp(e.site.split('').map(c=>RE_IUPAC[c]||c).join(''),'gi');
        let n2=0,m2; while((m2=re.exec(seq))!==null){n2++;re.lastIndex=m2.index+1;}
        row.re[name]=n2;
      });
    }

    if(checks.prot){
      const s2=seq.replace(/[^ACDEFGHIKLMNPQRSTVWY]/g,'');
      if(s2.length){
        const mw=(s2.split('').reduce((t,a)=>t+(MW_T[a]||110),0)-(s2.length-1)*18.02)/1000;
        const cnt={}; s2.split('').forEach(a=>cnt[a]=(cnt[a]||0)+1);
        let pi='14.00';
        for(let pH=0;pH<=14;pH+=0.01){
          let charge=1/(1+Math.pow(10,pH-8.0))-1/(1+Math.pow(10,3.1-pH));
          ['R','K','H'].forEach(a=>{if(cnt[a])charge+=cnt[a]/(1+Math.pow(10,pH-PKA[a]));});
          ['D','E','C','Y'].forEach(a=>{if(cnt[a])charge-=cnt[a]/(1+Math.pow(10,PKA[a]-pH));});
          if(charge<0){pi=pH.toFixed(2);break;}
        }
        row.prot={mw:mw.toFixed(2)+' kDa',pi,length:s2.length};
      } else row.prot={mw:'—',pi:'—',length:0};
    }

    if(checks.codon){
      const s2=seq.replace(/[^ACGT]/g,'');
      const counts={};
      Object.keys(CODON_TABLE).forEach(c=>counts[c]=0);
      for(let i=0;i<s2.length-2;i+=3){const c=s2.slice(i,i+3);if(c in counts)counts[c]++;}
      const total2=Object.values(counts).reduce((a,b)=>a+b,0);
      let gc3=0,tot3=0;
      for(let i=2;i<s2.length;i+=3){const b=s2[i];tot3++;if(b==='G'||b==='C')gc3++;}
      const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
      row.codon={gc3_pct:tot3?(gc3/tot3*100).toFixed(1):'0',
        top_codon:top?top[0]:'—',top_aa:top?CODON_TABLE[top[0]]||'?':'—',
        top_count:top?top[1]:0,total_codons:total2};
    }

    return row;
  });
}
