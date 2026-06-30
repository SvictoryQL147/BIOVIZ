// ── Codon Table ───────────────────────────────────────────────────────────────
const CODON_TABLE = {
  TTT:'Phe',TTC:'Phe',TTA:'Leu',TTG:'Leu',
  CTT:'Leu',CTC:'Leu',CTA:'Leu',CTG:'Leu',
  ATT:'Ile',ATC:'Ile',ATA:'Ile',ATG:'Met',
  GTT:'Val',GTC:'Val',GTA:'Val',GTG:'Val',
  TCT:'Ser',TCC:'Ser',TCA:'Ser',TCG:'Ser',
  CCT:'Pro',CCC:'Pro',CCA:'Pro',CCG:'Pro',
  ACT:'Thr',ACC:'Thr',ACA:'Thr',ACG:'Thr',
  GCT:'Ala',GCC:'Ala',GCA:'Ala',GCG:'Ala',
  TAT:'Tyr',TAC:'Tyr',TAA:'*',TAG:'*',
  CAT:'His',CAC:'His',CAA:'Gln',CAG:'Gln',
  AAT:'Asn',AAC:'Asn',AAA:'Lys',AAG:'Lys',
  GAT:'Asp',GAC:'Asp',GAA:'Glu',GAG:'Glu',
  TGT:'Cys',TGC:'Cys',TGA:'*',TGG:'Trp',
  CGT:'Arg',CGC:'Arg',CGA:'Arg',CGG:'Arg',
  AGT:'Ser',AGC:'Ser',AGA:'Arg',AGG:'Arg',
  GGT:'Gly',GGC:'Gly',GGA:'Gly',GGG:'Gly'
};

const AA_CLASS = {
  Ala:'nonpolar',Val:'nonpolar',Ile:'nonpolar',Leu:'nonpolar',
  Met:'nonpolar',Phe:'nonpolar',Trp:'nonpolar',Pro:'nonpolar',Gly:'nonpolar',
  Ser:'polar',Thr:'polar',Cys:'polar',Tyr:'polar',Asn:'polar',Gln:'polar',
  Arg:'charged-pos',Lys:'charged-pos',His:'charged-pos',
  Asp:'charged-neg',Glu:'charged-neg'
};

// ── IUPAC Ambiguity Codes ──────────────────────────────────────────────────────
const IUPAC = {
  N:'[ACGTU]',R:'[AG]',Y:'[CT]',W:'[AT]',
  S:'[GC]',K:'[GT]',M:'[AC]',
  B:'[CGT]',D:'[AGT]',H:'[ACT]',V:'[ACG]'
};

// ── Restriction Enzymes ────────────────────────────────────────────────────────
// Format: { name, site (5'→3' recognition), cut (position after which cut occurs on top strand) }
const RESTRICTION_ENZYMES = [
  { name:'EcoRI',   site:'GAATTC',  cut:1, description:'Leaves 5\' AATT overhang' },
  { name:'BamHI',   site:'GGATCC',  cut:1, description:'Leaves 5\' GATC overhang' },
  { name:'HindIII', site:'AAGCTT',  cut:1, description:'Leaves 5\' AGCT overhang' },
  { name:'SalI',    site:'GTCGAC',  cut:1, description:'Leaves 5\' TCGA overhang' },
  { name:'XhoI',    site:'CTCGAG',  cut:1, description:'Leaves 5\' TCGA overhang' },
  { name:'NcoI',    site:'CCATGG',  cut:1, description:'Leaves 5\' CATG overhang' },
  { name:'XbaI',    site:'TCTAGA',  cut:1, description:'Leaves 5\' CTAG overhang' },
  { name:'SmaI',    site:'CCCGGG',  cut:3, description:'Blunt end cutter' },
  { name:'KpnI',    site:'GGTACC',  cut:5, description:'Leaves 3\' GTAC overhang' },
  { name:'SacI',    site:'GAGCTC',  cut:5, description:'Leaves 3\' AGCT overhang' },
  { name:'EcoRV',   site:'GATATC',  cut:3, description:'Blunt end cutter' },
  { name:'PstI',    site:'CTGCAG',  cut:5, description:'Leaves 3\' ACGT overhang' },
  { name:'SphI',    site:'GCATGC',  cut:5, description:'Leaves 3\' CATG overhang' },
  { name:'ClaI',    site:'ATCGAT',  cut:2, description:'Leaves 5\' CG overhang' },
  { name:'NheI',    site:'GCTAGC',  cut:1, description:'Leaves 5\' CTAG overhang' },
  { name:'MluI',    site:'ACGCGT',  cut:1, description:'Leaves 5\' CGCG overhang' },
  { name:'ApaI',    site:'GGGCCC',  cut:5, description:'Leaves 3\' GGCC overhang' },
  { name:'NotI',    site:'GCGGCCGC',cut:2, description:'8-cutter; leaves 5\' GGCC overhang' },
  { name:'AscI',    site:'GGCGCGCC',cut:2, description:'8-cutter; rare cutter' },
  { name:'PacI',    site:'TTAATTAA',cut:3, description:'8-cutter; AT-rich' },
  { name:'SfiI',    site:'GGCCNNNNNGGCC', cut:8, description:'Degenerate 13-mer' },
  { name:'HpaI',    site:'GTTAAC',  cut:3, description:'Blunt end cutter' },
  { name:'BglII',   site:'AGATCT',  cut:1, description:'Leaves 5\' GATC overhang' },
  { name:'AvrII',   site:'CCTAGG',  cut:1, description:'Leaves 5\' CTAG overhang' },
  { name:'AgeI',    site:'ACCGGT',  cut:1, description:'Leaves 5\' CCGG overhang' },
  { name:'MspI',    site:'CCGG',    cut:1, description:'4-cutter; frequent' },
  { name:'TaqI',    site:'TCGA',    cut:1, description:'4-cutter; heat stable' },
  { name:'HaeIII',  site:'GGCC',    cut:2, description:'4-cutter; blunt end' },
  { name:'AluI',    site:'AGCT',    cut:2, description:'4-cutter; blunt end' },
  { name:'RsaI',    site:'GTAC',    cut:2, description:'4-cutter; blunt end' },
];

// ── Enzyme IUPAC pattern expansion ────────────────────────────────────────────
function enzymeToRegex(site) {
  return site.split('').map(c => IUPAC[c] || c).join('');
}

// ── Demo sequences ─────────────────────────────────────────────────────────────
const DEMO_SEQS = {
  short:   'ATGCGATCGATCGGCTATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGGCTATCGGCGGCTATCGA',
  coding:  'ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG',
  lambda:  'ATGCGAATTCATTAAAGGATCCGCATCGATCGATATCAAAGCTTGGTACCCTGCAGGTCGACGAGCTCGCGGCCGCAAAGCTTGGATCC',
  multi:   'ATGCGATCGATCGGCTATCGATCGATCGATCGATCG',
};

// Extra demo sequences
DEMO_SEQS.lambda = 'ATGCGAATTCATTAAAGGATCCGCATCGATCGATATCAAAGCTTGGTACCCTGCAGGTCGACGAGCTCGCGGCCGCAAAGCTTGGATCC';
