function aboutPanel() {
  return `
  <div class="about-hero">
    <h2>🧬 BioViz</h2>
    <p>A free, browser-based bioinformatics toolkit. No install, no login, no servers — every calculation runs on your own device.</p>
  </div>

  <div class="feature-grid">
    <div class="feature-card"><i class="ti ti-shield-check"></i><h4>100% private</h4><p>Sequences never leave your browser. No tracking, no upload, no account needed.</p></div>
    <div class="feature-card"><i class="ti ti-bolt"></i><h4>Instant results</h4><p>All algorithms run client-side in JavaScript — no waiting on a server queue.</p></div>
    <div class="feature-card"><i class="ti ti-download"></i><h4>Export everything</h4><p>CSV, FASTA, PNG, SVG, Newick, VCF, BED — every result can be downloaded.</p></div>
    <div class="feature-card"><i class="ti ti-device-mobile"></i><h4>Works everywhere</h4><p>Responsive layout for desktop, tablet, and mobile.</p></div>
  </div>

  ${card('Quick start', `
    <ol style="padding-left:20px;font-size:13px;color:var(--text-2);line-height:1.9;">
      <li>Pick a tool from the sidebar (or search using the search box at the top of the sidebar)</li>
      <li>Paste a DNA, RNA, or protein sequence — or import a FASTA/GenBank file from <strong>File Import</strong></li>
      <li>Click the primary action button (Analyze, Translate, Search, etc.)</li>
      <li>Use the export buttons on each result card to download CSV, FASTA, PNG, or SVG</li>
      <li>Click the share icon in the top bar to copy a direct link to the current tool</li>
    </ol>
  `)}

  ${card('Tool reference', `
    <div style="display:flex;flex-direction:column;gap:10px;font-size:13px;">
      <div><strong>GC &amp; Composition</strong> — base frequency, GC%, AT%, colored sequence display</div>
      <div><strong>Translation</strong> — DNA → protein in all 3 forward reading frames</div>
      <div><strong>ORF Finder</strong> — finds all ATG…stop open reading frames across 6 frames</div>
      <div><strong>Codon Usage</strong> — frequency table of all 64 codons grouped by amino acid</div>
      <div><strong>Motif Search</strong> — exact or IUPAC degenerate pattern matching (N,R,Y,W,S…)</div>
      <div><strong>Restriction Sites</strong> — 30 enzymes, linear cut map, non-cutter list</div>
      <div><strong>Protein Properties</strong> — molecular weight, pI, hydrophobicity, AA composition</div>
      <div><strong>Mutation Simulator</strong> — substitution/insertion/deletion with effect classification</div>
      <div><strong>SNP Visualizer</strong> — compare two sequences, Ti/Tv ratio, VCF export</div>
      <div><strong>Genome Browser</strong> — zoomable, scrollable annotated sequence view</div>
      <div><strong>Pairwise Alignment</strong> — Needleman-Wunsch global alignment</div>
      <div><strong>Dot Plot</strong> — sliding-window sequence similarity matrix</div>
      <div><strong>Phylogenetic Tree</strong> — neighbor-joining tree with Newick export</div>
      <div><strong>Reverse Complement</strong> — antisense strand + melting temperature</div>
    </div>
  `)}

  ${card('Algorithms used', `
    <div style="font-size:13px;color:var(--text-2);line-height:1.8;">
      <strong>Phylogenetic tree:</strong> Neighbor-joining (Saitou &amp; Nei, 1987) with p-distance or Jukes-Cantor correction.<br>
      <strong>Pairwise alignment:</strong> Needleman-Wunsch global dynamic programming, O(n×m).<br>
      <strong>Restriction mapping:</strong> IUPAC-aware regex matching across 30 common enzymes.<br>
      <strong>Hydrophobicity:</strong> Kyte-Doolittle scale, sliding window of 9 residues.<br>
      <strong>Isoelectric point:</strong> Iterative charge calculation across pH 0–14 using standard pKa values.
    </div>
  `)}

  ${card('Privacy & data', `
    <div style="font-size:13px;color:var(--text-2);line-height:1.8;">
      BioViz performs all computation locally in your browser using JavaScript. No sequence data, file uploads,
      or analysis results are ever transmitted to any server. This tool can be used completely offline once loaded.
    </div>
  `)}

  <div style="text-align:center;padding:20px 0;color:var(--text-3);font-size:12px;">
    BioViz v2.1 · Open source · <a href="https://github.com/SvictoryQL147/BIOVIZ" target="_blank" style="color:var(--accent)">View on GitHub</a>
  </div>`;
}
