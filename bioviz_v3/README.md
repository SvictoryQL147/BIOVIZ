# 🧬 BioViz — Free Online Bioinformatics Tools

A complete, browser-based bioinformatics toolkit. **No install. No login. No data ever leaves your browser.**

## ✅ Public-ready checklist

- [x] Zero `alert()` calls — proper toast notifications + inline error messages everywhere
- [x] Export buttons on every tool — CSV, FASTA, PNG, SVG, Newick, VCF, BED
- [x] Loading states on heavy operations (phylogenetic tree build)
- [x] Mobile-responsive layout with slide-out sidebar
- [x] About / How-to-use page with quick start guide and algorithm references
- [x] Dark / light theme toggle (persisted via localStorage)
- [x] Shareable URLs (`?tool=gc`) for every tool
- [x] Tool search/filter in sidebar
- [x] SEO meta tags (Open Graph, description, keywords)
- [x] Privacy banner — builds user trust
- [x] Deploy configs for Netlify, Vercel, GitHub Pages

## Tools (16 total)

| Category | Tools |
|---|---|
| **Import** | FASTA / GenBank file upload with drag-and-drop |
| **Sequence** | GC & Composition, Translation, ORF Finder, Codon Usage, Motif Search, Restriction Mapping |
| **Protein** | Molecular Weight, pI, Hydrophobicity, AA Composition |
| **Variation** | Mutation Simulator, SNP Visualizer, Genome Browser |
| **Comparative** | Pairwise Alignment (NW), Dot Plot, Phylogenetic Tree (NJ) |
| **Utilities** | Reverse Complement, About/Help |

## Run locally

```bash
python3 -m http.server 8080
# Open: http://localhost:8080
```

## Deploy in 2 minutes

**Netlify:** Drag the folder to [netlify.com/drop](https://netlify.com/drop)

**GitHub Pages:**
```bash
git init && git add . && git commit -m "BioViz public launch"
gh repo create bioviz --public --push --source=.
# Settings → Pages → Source: GitHub Actions
```

**Vercel:**
```bash
npx vercel
```

## Tech stack

Vanilla JavaScript, zero frameworks, zero build step. Chart.js for charts. Pure SVG for trees, dot plots, and maps (fully exportable, no canvas-to-image conversion needed). All algorithms run client-side — verified with 16/16 panels passing automated integration tests.

## Algorithms

- **Phylogenetic tree:** Neighbor-joining (Saitou & Nei 1987), p-distance or Jukes-Cantor correction, Newick export
- **Alignment:** Needleman-Wunsch O(n×m) dynamic programming
- **ORF Finder:** All 6 reading frames, configurable minimum length
- **Restriction mapping:** 30 enzymes, IUPAC degenerate recognition sequences
- **Protein pI:** Iterative charge calculation across pH 0–14
- **Hydrophobicity:** Kyte-Doolittle scale, 9-residue sliding window

## License

MIT — free to use, fork, and deploy.
