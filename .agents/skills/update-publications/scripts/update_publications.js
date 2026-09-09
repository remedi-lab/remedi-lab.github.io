#!/usr/bin/env node

/**
 * update_publications.js
 * 
 * REMEDI Lab Publication Catalog Engine
 * Fetches, deduplicates, and enriches publications for Andrea Raballo & Antonietta Mira,
 * maps code repositories & datasets, flags REMEDI Lab authors, writes YAML files,
 * and rebuilds the static website.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const PUBS_DIR = path.join(PROJECT_ROOT, '_data/publications');
const TEAM_FILE = path.join(PROJECT_ROOT, '_data/team.yml');
const DATA_CACHE_FILE = path.join(__dirname, '../data/openalex_works.json');

// Parse CLI arguments
const args = process.argv.slice(2);
const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'all'; // 'all' (default) or 'joint'
const dryRun = args.includes('--dry-run');
const noBuild = args.includes('--no-build');

console.log(`[update-publications] Mode: ${mode} | Dry run: ${dryRun} | Skip build: ${noBuild}`);

// Known supplementary repositories, datasets, and project links mapped by keyword / title
const SUPPLEMENTARY_CATALOG = {
  'personalitydbench': {
    code: 'https://github.com/Fede-stack/PersonalityDBench',
    dataset: 'https://github.com/Fede-stack/PersonalityDBench',
    note: 'Main Conference'
  },
  'tony': {
    code: 'https://github.com/Fede-stack/TONYpy',
    project: 'https://tony.github.io',
    note: 'Oral Presentation, System Demonstrations'
  },
  'adaptive rag': {
    code: 'https://github.com/Fede-stack/Adaptive-RAG-for-Psychological-Assessment',
    note: 'Long Paper, Main Conference'
  },
  'schizophrenia spectrum disorders': {
    code: 'https://github.com/Fede-stack/LLMs-vs-LIPs',
    note: '79(9), 599 (2025)'
  },
  'social media text into predictive tools': {
    code: 'https://github.com/Fede-stack/Predicting-Survey-Responses-using-Textual-Data-from-Social-Media',
    note: 'Open Access'
  },
  'rethinking psychometrics through llms': {
    code: 'https://github.com/Fede-stack/Exploiting-semantic-structure-in-psychological-questionnaire',
    note: '15(1), 37313 (2025)'
  },
  'seed-driven approach to topic modelling': {
    code: 'https://github.com/Fede-stack/SSBM-Self-supervised-Seed-driven-Bayesian-Modeling',
    note: 'Journal of Intelligent Information Systems (2024)'
  },
  'nonparametric dimensionality reduction': {
    code: 'https://github.com/Fede-stack/Adaptive-nonparametric-dimensionality-reduction',
    note: 'Nature Scientific Reports'
  },
  'navigating through the hidden embedding space': {
    code: 'https://github.com/Fede-stack/SteeringBDI-II',
    note: 'ACM Conference'
  },
  'changing geometry of grammar': {
    code: 'https://github.com/Fede-stack/The-LLMs-Changing-Geometry-of-Grammar',
    note: 'arXiv Preprint'
  },
  'posts to patterns': {
    code: 'https://github.com/Fede-stack/BULUSI-CLPsych',
    note: 'Workshop Paper'
  },
  'gradient of methodologies': {
    note: 'Workshop Paper'
  },
  'tailoring adaptive-zero-shot retrieval': {
    note: 'ACM Conference'
  }
};

// Helper: load team members to identify remedi-lab authors
function loadTeamMembers() {
  const names = new Set();
  names.add('andrea raballo');
  names.add('antonietta mira');
  names.add('federico ravenda');
  names.add('volodymyr karpenko');
  names.add('daniele montagnani');
  names.add('giulia guicciardi');
  names.add('syed mujtaba haider');
  names.add('hubert pawlusinski');
  names.add('ziqing dong');
  names.add('luigi tisci');
  names.add('cristina fernández-simal bernard');
  names.add('erica trofimov');
  names.add('sofia irene ravenda');
  names.add('s.i. ravenda');

  if (fs.existsSync(TEAM_FILE)) {
    const lines = fs.readFileSync(TEAM_FILE, 'utf8').split('\n');
    let curFirst = '';
    lines.forEach(l => {
      const fMatch = l.match(/first_name:\s*(.+)$/);
      if (fMatch) curFirst = fMatch[1].trim();
      const lMatch = l.match(/last_name:\s*(.+)$/);
      if (lMatch && curFirst) {
        names.add(`${curFirst.toLowerCase()} ${lMatch[1].trim().toLowerCase()}`);
      }
    });
  }

  return names;
}

// Title normalizer for robust deduplication
function normalizeTitle(t) {
  if (!t) return '';
  return t.toLowerCase()
    .replace(/\(.*?\)/g, '') // remove parenthesized acronyms like (LLMs)
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if an author is a REMEDI lab member
function isRemediMember(name, teamSet) {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  for (const t of teamSet) {
    if (clean === t || clean.includes(t) || t.includes(clean)) return true;
    const parts = t.split(' ');
    const lastName = parts[parts.length - 1];
    if (parts.length > 1 && clean.endsWith(lastName) && clean[0] === parts[0][0]) {
      return true; // e.g. "S.I. Ravenda" matching "Sofia Irene Ravenda"
    }
  }
  return false;
}

// Helper: safe YAML string serializer
function toYaml(pub) {
  let lines = [];
  lines.push(`- title: "${pub.title.replace(/"/g, '\\"')}"`);
  lines.push(`  authors:`);
  (pub.authors || []).forEach(a => {
    lines.push(`    - name: "${a.name.replace(/"/g, '\\"')}"`);
    lines.push(`      remedi-lab: ${!!a['remedi-lab']}`);
  });
  lines.push(`  year: ${pub.year}`);
  lines.push(`  journal: "${(pub.journal || '').replace(/"/g, '\\"')}"`);
  if (pub.link) lines.push(`  link: "${pub.link}"`);
  if (pub.code) lines.push(`  code: "${pub.code}"`);
  if (pub.dataset) lines.push(`  dataset: "${pub.dataset}"`);
  if (pub.project) lines.push(`  project: "${pub.project}"`);
  if (pub.slides) lines.push(`  slides: "${pub.slides}"`);
  if (pub.award) lines.push(`  award: "${pub.award}"`);
  if (pub.note) lines.push(`  note: "${pub.note.replace(/"/g, '\\"')}"`);
  return lines.join('\n') + '\n';
}

// Curated master publications list with full peer-reviewed links, DOIs, code repos, and datasets
const CURATED_JOINT_PUBLICATIONS = [
  {
    slug: 'ravenda-2026-acl1',
    title: 'TONY: an open-source TOolkit for Nlp in psYchology',
    year: 2026,
    journal: 'Proceedings of the 64th Annual Meeting of the Association for Computational Linguistics (ACL 2026)',
    link: 'https://doi.org/10.18653/v1/2026.acl-demo.65',
    code: 'https://github.com/Fede-stack/TONYpy',
    project: 'https://tony.github.io',
    note: 'Oral Presentation, System Demonstrations',
    authors: [
      { name: 'Federico Ravenda' },
      { name: 'Sofia Irene Ravenda' },
      { name: 'Volodymyr Karpenko' },
      { name: 'Daniele Montagnani' },
      { name: 'Andrea Raballo' },
      { name: 'Antonietta Mira' }
    ]
  },
  {
    slug: 'ravenda-2026-acl2',
    title: 'PersonalityDBench: A Dataset for Personality Disorders - from Modeling to Controlled Generation',
    year: 2026,
    journal: 'Proceedings of the 64th Annual Meeting of the Association for Computational Linguistics (ACL 2026)',
    link: 'https://doi.org/10.18653/v1/2026.acl-long.1395',
    code: 'https://github.com/Fede-stack/PersonalityDBench',
    dataset: 'https://github.com/Fede-stack/PersonalityDBench',
    note: 'Long Paper, Main Conference',
    authors: [
      { name: 'Federico Ravenda' },
      { name: 'Seyed Ali Bahrainian' },
      { name: 'Daniele Montagnani' },
      { name: 'Antonietta Mira' },
      { name: 'Andrea Raballo' }
    ]
  },
  {
    slug: 'ravenda-2026-sac',
    title: 'Navigating through the hidden embedding space: steering LLMs to improve mental health assessment',
    year: 2026,
    journal: 'Proceedings of the 41st ACM/SIGAPP Symposium on Applied Computing (SAC 2026)',
    link: 'https://doi.org/10.1145/3748522.3779887',
    code: 'https://github.com/Fede-stack/SteeringBDI-II',
    note: 'ACM Conference',
    authors: [
      { name: 'Federico Ravenda' },
      { name: 'Seyed Ali Bahrainian' },
      { name: 'Andrea Raballo' },
      { name: 'Antonietta Mira' }
    ]
  },
  {
    slug: 'ravenda-2026-clpsych',
    title: 'P2P - from Posts to Patterns: An LLM Ensemble Approach to Mental Health Dynamics Detection',
    year: 2026,
    journal: 'Proceedings of the 10th Workshop on Computational Linguistics and Clinical Psychology (CLPsych @ NAACL 2026)',
    link: 'https://doi.org/10.18653/v1/2026.clpsych-1.39',
    code: 'https://github.com/Fede-stack/BULUSI-CLPsych',
    note: 'Workshop Paper',
    authors: [
      { name: 'Federico Ravenda' },
      { name: 'Volodymyr Karpenko' },
      { name: 'Antonietta Mira' },
      { name: 'Andrea Raballo' }
    ]
  },
  {
    slug: 'vallisa-2026-grammar',
    title: 'The Changing Geometry of Grammar: Dimensionality and Neighborhood Reorganization across Transformer Layers',
    year: 2026,
    journal: 'arXiv Preprint',
    link: 'https://doi.org/10.48550/arxiv.2608.25166',
    code: 'https://github.com/Fede-stack/The-LLMs-Changing-Geometry-of-Grammar',
    note: 'arXiv:2608.25166 (cs.CL)',
    authors: [
      { name: 'Samuele Vallisa' },
      { name: 'Federico Ravenda' },
      { name: 'Claudio Palominos' },
      { name: 'Rui He' },
      { name: 'Andrea Raballo' },
      { name: 'Antonietta Mira' },
      { name: 'Philipp Homan' },
      { name: 'Wolfram Hinzen' }
    ]
  },
  {
    slug: 'ravenda-2025-acl',
    title: 'Are LLMs Effective Psychological Assessors? Leveraging Adaptive RAG for Interpretable Mental Health Screening',
    year: 2025,
    journal: 'Proceedings of the Association for Computational Linguistics (ACL 2025)',
    link: 'https://doi.org/10.18653/v1/2025.acl-long.440',
    code: 'https://github.com/Fede-stack/Adaptive-RAG-for-Psychological-Assessment',
    note: 'Long Paper, Main Conference',
    authors: [
      { name: 'Federico Ravenda' },
      { name: 'Seyed Ali Bahrainian' },
      { name: 'Andrea Raballo' },
      { name: 'Antonietta Mira' },
      { name: 'Noriko Kando' }
    ]
  },
  {
    slug: 'ravenda-2025-scirep',
    title: 'Rethinking psychometrics through LLMs: how item semantics shape measurement and prediction in psychological questionnaires',
    year: 2025,
    journal: 'Nature Scientific Reports',
    link: 'https://doi.org/10.1038/s41598-025-21289-8',
    code: 'https://github.com/Fede-stack/Exploiting-semantic-structure-in-psychological-questionnaire',
    note: '15(1), 37313 (2025)',
    authors: [
      { name: 'Federico Ravenda' },
      { name: 'Antonio Preti' },
      { name: 'Michele Poletti' },
      { name: 'Antonietta Mira' },
      { name: 'Andrea Raballo' }
    ]
  },
  {
    slug: 'raballo-2025-pcn',
    title: 'Diagnosing schizophrenia spectrum disorders: Large language models (LLMs) vs. leading international psychiatrists (LIPs)',
    year: 2025,
    journal: 'Psychiatry and Clinical Neurosciences',
    link: 'https://doi.org/10.1111/pcn.13864',
    code: 'https://github.com/Fede-stack/LLMs-vs-LIPs',
    note: '79(9), 599 (2025)',
    authors: [
      { name: 'Andrea Raballo' },
      { name: 'Federico Ravenda' },
      { name: 'Antonietta Mira' }
    ]
  },
  {
    slug: 'ravenda-2025-plos',
    title: 'Transforming Social Media Text into Predictive Tools for Depression through AI: A test-case study on the Beck Depression Inventory-II',
    year: 2025,
    journal: 'PLOS Digital Health',
    link: 'https://doi.org/10.1371/journal.pdig.0000848',
    code: 'https://github.com/Fede-stack/Predicting-Survey-Responses-using-Textual-Data-from-Social-Media',
    note: 'Open Access',
    authors: [
      { name: 'Federico Ravenda' },
      { name: 'Antonio Preti' },
      { name: 'Michele Poletti' },
      { name: 'Antonietta Mira' },
      { name: 'Fábio Crestani' },
      { name: 'Andrea Raballo' }
    ]
  },
  {
    slug: 'ravenda-2025-sac',
    title: 'Tailoring adaptive-zero-shot retrieval and probabilistic modelling for psychometric data',
    year: 2025,
    journal: 'Proceedings of the 40th ACM/SIGAPP Symposium on Applied Computing (SAC 2025)',
    link: 'https://doi.org/10.1145/3672608.3707922',
    note: 'ACM Conference',
    authors: [
      { name: 'Federico Ravenda' },
      { name: 'Seyed Ali Bahrainian' },
      { name: 'Noriko Kando' },
      { name: 'Antonietta Mira' },
      { name: 'Andrea Raballo' },
      { name: 'Fabio Crestani' }
    ]
  },
  {
    slug: 'ravenda-2025-clpsych',
    title: 'From Evidence Mining to Meta-Prediction: a Gradient of Methodologies for Task-Specific Challenges in Psychological Assessment',
    year: 2025,
    journal: 'Proceedings of the 10th Workshop on Computational Linguistics and Clinical Psychology (CLPsych @ NAACL 2025)',
    link: 'https://doi.org/10.18653/v1/2025.clpsych-1.20',
    note: 'Workshop Paper',
    authors: [
      { name: 'Federico Ravenda' },
      { name: 'F.Z. Kara-Isitt' },
      { name: 'S. Swift' },
      { name: 'Antonietta Mira' },
      { name: 'Andrea Raballo' }
    ]
  },
  {
    slug: 'ravenda-2024-jiis',
    title: 'A self-supervised seed-driven approach to topic modelling and clustering',
    year: 2024,
    journal: 'Journal of Intelligent Information Systems',
    link: 'https://doi.org/10.1007/s10844-024-00891-8',
    code: 'https://github.com/Fede-stack/SSBM-Self-supervised-Seed-driven-Bayesian-Modeling',
    note: 'Springer Nature (2024)',
    authors: [
      { name: 'Federico Ravenda' },
      { name: 'Seyed Ali Bahrainian' },
      { name: 'Andrea Raballo' },
      { name: 'Antonietta Mira' },
      { name: 'Fábio Crestani' }
    ]
  }
];

// Curated master books authored or edited by REMEDI Lab co-founders
const CURATED_MASTER_BOOKS = [
  {
    slug: 'agresti-2026-foundations-of-bayesian',
    title: 'Foundations of Bayesian Statistics for Data Scientists',
    year: 2026,
    journal: 'Chapman and Hall/CRC',
    link: 'https://doi.org/10.1201/9781003715924',
    note: 'Book',
    _type: 'book',
    authors: [
      { name: 'Alan Agresti' },
      { name: 'Maria Kateri' },
      { name: 'Ranjini Grove' },
      { name: 'Antonietta Mira' }
    ]
  },
  {
    slug: 'stanghellini-2019-oxford-handbook',
    title: 'The Oxford Handbook of Phenomenological Psychopathology',
    year: 2019,
    journal: 'Oxford University Press',
    link: 'https://doi.org/10.1093/oxfordhb/9780198803157.001.0001',
    note: 'Book (Edited Volume)',
    _type: 'book',
    authors: [
      { name: 'Giovanni Stanghellini' },
      { name: 'Matthew Broome' },
      { name: 'Andrea Raballo' },
      { name: 'Anthony Vincent Fernandez' },
      { name: 'Paolo Fusar-Poli' },
      { name: 'René Rosfort' }
    ]
  },
  {
    slug: 'comparelli-2022-thinking-through',
    title: 'Thinking through the Schizophrenia Spectrum: Nosological Scenarios and Perspectives beyond Psychosis',
    year: 2022,
    journal: 'Frontiers Research Topics (eBook)',
    link: 'https://doi.org/10.3389/978-2-88974-556-2',
    note: 'eBook (Edited Volume)',
    _type: 'book',
    authors: [
      { name: 'Anna Comparelli' },
      { name: 'Andrea Raballo' },
      { name: 'Antonio Preti' },
      { name: 'Stephen J. Wood' },
      { name: 'Patrick McGorry' }
    ]
  },
  {
    slug: 'mira-2020-pandemia-dati',
    title: 'La pandemia dei dati. Ecco il vaccino',
    year: 2020,
    journal: 'Mondadori Università',
    link: 'https://www.mondadoristore.it/pandemia-dei-dati-Ecco-Armando-Massarenti-Antonietta-Mira/ea978886184825/',
    note: 'Book',
    _type: 'book',
    authors: [
      { name: 'Armando Massarenti' },
      { name: 'Antonietta Mira' }
    ]
  },
  {
    slug: 'mira-2012-mate-magica',
    title: 'Mate-magica. I giochi di prestigio di Luca Pacioli',
    year: 2012,
    journal: 'Aboca Edizioni',
    link: 'https://www.abocamuseum.it/it/editoria/mate-magica/',
    note: 'Book',
    _type: 'book',
    authors: [
      { name: 'Antonietta Mira' },
      { name: 'Vanni Bossi' },
      { name: 'Francesco Arlati' }
    ]
  },
  {
    slug: 'delisi-2009-dismorfofobia',
    title: 'Dismorfofobia. Quando vedersi brutti è patologia',
    year: 2009,
    journal: "L'Asino d'oro edizioni",
    link: 'https://www.lasinodoroedizioni.it/',
    note: 'Book',
    _type: 'book',
    authors: [
      { name: 'D. De Lisi' },
      { name: 'E. Gebhardt' },
      { name: 'L. Giorgini' },
      { name: 'Andrea Raballo' }
    ]
  }
];

// DOIs or title identifiers of chapters that belong to authored books and should NOT be listed as individual chapters
const CHAPTER_TO_BOOK_SUPPRESSIONS = [
  '10.1201/9781003715924', // Chapters of Foundations of Bayesian Statistics for Data Scientists
  'bayesian mcmc posterior computation and diagnostics'
];

// Known container books and publishers for chapters contributed to edited volumes
const KNOWN_CHAPTER_CONTAINERS = {
  '10.1007/978-3-030-51366-5_100': {
    container: 'Tasman’s Psychiatry',
    publisher: 'Springer International Publishing'
  },
  '10.1007/978-3-030-42825-9_100-1': {
    container: 'Tasman’s Psychiatry',
    publisher: 'Springer International Publishing'
  },
  '10.1007/978-3-319-75124-5_6': {
    container: 'Hallucinations in Psychoses and Affective Disorders',
    publisher: 'Springer International Publishing'
  },
  '10.1093/med/9780199548590.003.0019': {
    container: 'Hallucinations: The Science of Idiosyncratic Perception',
    publisher: 'Oxford University Press'
  },
  '10.1093/oso/9780199214655.003.0013': {
    container: 'Bayesian Statistics 8',
    publisher: 'Oxford University Press'
  },
  '10.1016/s0169-7161(05)25014-9': {
    container: 'Handbook of Statistics (Vol. 25: Bayesian Thinking: Modeling and Computation)',
    publisher: 'Elsevier'
  },
  '10.1007/978-3-0348-7943-9_17': {
    container: 'Seminar on Stochastic Analysis, Random Fields and Applications IV',
    publisher: 'Birkhäuser Basel'
  },
  '10.1007/978-1-4613-0217-9_2': {
    container: 'Applied Bayesian Statistical Studies in Biology and Medicine',
    publisher: 'Springer US'
  },
  '10.1093/oso/9780198523567.003.0049': {
    container: 'Bayesian Statistics 5',
    publisher: 'Oxford University Press'
  },
  '10.1007/978-3-031-64431-3_19': {
    container: 'Methodological and Applied Statistics and Demography III',
    publisher: 'Springer Nature Switzerland'
  },
  '10.1007/978-3-031-64431-3_20': {
    container: 'Methodological and Applied Statistics and Demography III',
    publisher: 'Springer Nature Switzerland'
  },
  '10.4324/9781315885605-15': {
    container: 'The Assessment of Psychosis: A Practical Guide',
    publisher: 'Routledge'
  }
};

const EXCLUDED_TYPES = new Set(['erratum', 'paratext', 'peer-review', 'supplementary-materials']);

// Convert OpenAlex work into publication object
function openalexToPub(w) {
  if (w.is_retracted) return null;
  if (EXCLUDED_TYPES.has(w.type)) return null;

  const rawTitle = w.title || w.display_name;
  if (!rawTitle || rawTitle.trim().length < 5) return null;

  const year = w.publication_year;
  if (!year || typeof year !== 'number' || year < 1990) return null;

  const authors = (w.authorships || []).map(a => ({
    name: (a.author?.display_name || a.raw_author_name || '').trim()
  })).filter(a => a.name.length > 0 && a.name !== 'Unknown Author');

  if (authors.length === 0) return null;

  let link = w.doi || w.ids?.doi || w.primary_location?.landing_page_url || w.primary_location?.pdf_url || '';
  if (link && !link.startsWith('http')) {
    link = `https://doi.org/${link}`;
  }

  // 1. Check if this is an individual chapter from an authored book (suppress in favor of full book)
  const normTitle = normalizeTitle(rawTitle);
  const doiLower = (link || '').toLowerCase();
  for (const sup of CHAPTER_TO_BOOK_SUPPRESSIONS) {
    if (doiLower.includes(sup) || normTitle.includes(sup)) {
      // Suppress individual chapter from authored book so only full book is cited
      return null;
    }
  }

  let journal = w.primary_location?.source?.display_name || '';
  let note = '';

  if (w.type === 'book-chapter') {
    // 2. Check if this chapter belongs to an edited collection with known container metadata
    let matchedContainer = null;
    for (const [d, info] of Object.entries(KNOWN_CHAPTER_CONTAINERS)) {
      if (doiLower.includes(d.toLowerCase())) {
        matchedContainer = info;
        break;
      }
    }
    if (matchedContainer) {
      journal = `In: ${matchedContainer.container}. ${matchedContainer.publisher}`;
    } else if (w.primary_location?.raw_source_name) {
      journal = `In: ${w.primary_location.raw_source_name}`;
    } else if (journal) {
      journal = `In: ${journal}`;
    } else {
      journal = 'Book Chapter';
    }
  } else if (w.type === 'book' || w.type === 'monograph') {
    journal = journal || w.primary_location?.raw_source_name || 'Book';
    note = 'Book';
  } else if (journal === 'arXiv (Cornell University)') {
    journal = 'arXiv Preprint';
  } else if (!journal && w.type === 'preprint') {
    journal = 'Preprint';
  }

  return {
    title: rawTitle.trim(),
    year,
    journal: journal.trim(),
    link: link.trim(),
    code: '',
    dataset: '',
    project: '',
    note,
    authors,
    _type: w.type
  };
}

function loadOpenAlexDatabase() {
  if (!fs.existsSync(DATA_CACHE_FILE)) {
    console.warn(`[update-publications] Cache file ${DATA_CACHE_FILE} not found.`);
    return [];
  }
  try {
    const raw = fs.readFileSync(DATA_CACHE_FILE, 'utf8');
    const data = JSON.parse(raw);
    console.log(`[update-publications] Loaded ${data.length} cached works from ${path.basename(DATA_CACHE_FILE)}`);
    return data;
  } catch (err) {
    console.error(`[update-publications] Error reading cache file:`, err.message);
    return [];
  }
}

function hasAuthor(authors, targetName) {
  const normTarget = targetName.toLowerCase();
  return (authors || []).some(a => {
    const n = (a.name || '').toLowerCase();
    return n.includes(normTarget);
  });
}

function main() {
  const teamSet = loadTeamMembers();
  console.log(`[update-publications] Loaded ${teamSet.size} lab member identifiers for attribution.`);

  const pubMap = new Map();

  // 1. Load curated joint publications and master books (highest priority)
  CURATED_JOINT_PUBLICATIONS.forEach(p => {
    const norm = normalizeTitle(p.title);
    pubMap.set(norm, { ...p, _priority: 100 });
  });

  CURATED_MASTER_BOOKS.forEach(b => {
    const hasRaballo = hasAuthor(b.authors, 'raballo');
    const hasMira = hasAuthor(b.authors, 'mira');
    if (mode === 'joint' && (!hasRaballo || !hasMira)) return;
    const norm = normalizeTitle(b.title);
    pubMap.set(norm, { ...b, _priority: 100 });
  });

  // 2. Load OpenAlex works
  const rawWorks = loadOpenAlexDatabase();
  let added = 0;
  let merged = 0;

  rawWorks.forEach(w => {
    const pub = openalexToPub(w);
    if (!pub) return;

    // Check author inclusion based on mode
    const hasRaballo = hasAuthor(pub.authors, 'raballo');
    const hasMira = hasAuthor(pub.authors, 'mira');

    if (mode === 'joint') {
      if (!hasRaballo || !hasMira) return;
    } else {
      // mode === 'all': Include if Raballo OR Mira OR any REMEDI member
      const hasAnyMember = hasRaballo || hasMira || pub.authors.some(a => isRemediMember(a.name, teamSet));
      if (!hasAnyMember) return;
    }

    const norm = normalizeTitle(pub.title);
    if (pubMap.has(norm)) {
      const existing = pubMap.get(norm);
      // If existing is preprint and new is published article, update venue & link
      if (existing._type === 'preprint' && pub._type === 'article' && existing._priority < 50) {
        existing.journal = pub.journal;
        if (pub.link) existing.link = pub.link;
        existing._type = 'article';
      }
      if (!existing.link && pub.link) existing.link = pub.link;
      merged++;
    } else {
      pub._priority = pub._type === 'preprint' ? 10 : 20;
      pubMap.set(norm, pub);
      added++;
    }
  });

  console.log(`[update-publications] Catalog populated: ${added} added from OpenAlex, ${merged} merged with curated.`);

  // 3. Post-process: apply remedi-lab, supplementary catalog, and slugs
  const finalList = [];
  const seenSlugs = new Set();

  pubMap.forEach((pub, norm) => {
    // Apply remedi-lab flag
    pub.authors = (pub.authors || []).map(a => ({
      name: a.name,
      'remedi-lab': isRemediMember(a.name, teamSet)
    }));

    // Match supplementary materials
    for (const [kw, supp] of Object.entries(SUPPLEMENTARY_CATALOG)) {
      if (norm.includes(kw)) {
        if (!pub.code && supp.code) pub.code = supp.code;
        if (!pub.dataset && supp.dataset) pub.dataset = supp.dataset;
        if (!pub.project && supp.project) pub.project = supp.project;
        if (!pub.note && supp.note) pub.note = supp.note;
      }
    }

    // Generate unique slug
    if (!pub.slug) {
      const firstAuthor = (pub.authors[0]?.name || 'pub').toLowerCase().replace(/[^a-z]/g, '');
      const titleLead = norm.split(' ').slice(0, 3).join('-');
      const baseSlug = `${firstAuthor}-${pub.year}-${titleLead}`.slice(0, 45);
      let s = baseSlug;
      let counter = 1;
      while (seenSlugs.has(s)) {
        s = `${baseSlug}-${counter++}`;
      }
      pub.slug = s;
    }
    seenSlugs.add(pub.slug);

    finalList.push(pub);
  });

  // Sort by year descending, then title
  finalList.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));

  console.log(`[update-publications] Total unique publications to write: ${finalList.length}`);

  if (dryRun) {
    console.log(`[Dry Run] Previewing first 5 publications:`);
    finalList.slice(0, 5).forEach(p => {
      console.log(`\n=== ${p.slug}.yml ===\n${toYaml(p)}`);
    });
    return;
  }

  // Ensure _data/publications directory exists
  if (!fs.existsSync(PUBS_DIR)) {
    fs.mkdirSync(PUBS_DIR, { recursive: true });
  } else {
    // Clean old files to prevent orphans
    const oldFiles = fs.readdirSync(PUBS_DIR).filter(f => f.endsWith('.yml'));
    oldFiles.forEach(f => fs.unlinkSync(path.join(PUBS_DIR, f)));
    console.log(`[update-publications] Cleaned ${oldFiles.length} old publication files.`);
  }

  // Write new YAML files
  finalList.forEach(pub => {
    const filePath = path.join(PUBS_DIR, `${pub.slug}.yml`);
    fs.writeFileSync(filePath, toYaml(pub), 'utf8');
  });

  console.log(`\n[update-publications] Successfully written ${finalList.length} publication YAML files.`);

  // Rebuild static website
  if (!noBuild) {
    console.log('\n[update-publications] Rebuilding static site with node scripts/build.js...');
    try {
      execSync('node scripts/build.js', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      console.log('[update-publications] Build succeeded!');
    } catch (err) {
      console.error('[update-publications] Build failed:', err.message);
      process.exit(1);
    }
  }
}

main();
