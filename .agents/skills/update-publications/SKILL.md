---
name: update-publications
description: >-
  Fetches, deduplicates, and formats academic publications for REMEDI Lab co-founders Andrea Raballo and Antonietta Mira from open scholarly sources (OpenAlex, Crossref, arXiv), enriches each entry with paper links, code repositories, and datasets, writes YAML files into _data/publications/, and rebuilds the static website.
---

# Update Publications Skill

This skill automates maintaining the REMEDI Lab publication catalog. It ensures all joint works of lab heads **Andrea Raballo** and **Antonietta Mira** (and affiliated REMEDI Lab researchers) are captured, accurately cited, deduplicated, linked to open-access PDFs and peer-reviewed DOIs, and connected to code repositories and datasets.

## Workflow Overview

```
1. Query Scholarly Sources (OpenAlex, Crossref, arXiv)
               │
               ▼
2. Deduplicate Records (Merge Preprints with Journal/Conference Volumes)
               │
               ▼
3. Enrich with Links (DOIs, OpenAccess PDFs, GitHub Repos, Datasets)
               │
               ▼
4. Attribute REMEDI Lab Members (remedi-lab: true from _data/team.yml)
               │
               ▼
5. Output YAML Files (_data/publications/<slug>.yml)
               │
               ▼
6. Rebuild Static Site (node scripts/build.js)
```

## Quick Run

To update the publication catalog automatically:

```bash
npm run update-publications
# or directly:
node .agents/skills/update-publications/scripts/update_publications.js
```

### CLI Options

The update script supports the following command-line flags:

- `--mode <all|joint>`:
  - `all` (default): Includes all career publications where **either** Andrea Raballo or Antonietta Mira (or any REMEDI Lab member) is an author.
  - `joint`: Only includes publications co-authored jointly by **both** Andrea Raballo and Antonietta Mira.
- `--no-build`: Skips rebuilding `_site/` after generating YAML files.
- `--dry-run`: Fetches and displays changes without writing files to `_data/publications/`.

## Publication File Schema

Every publication is stored as an individual YAML file under `_data/publications/` following the naming convention:
`<primary-author-slug>-<year>-<venue-shortname>.yml` (e.g. `ravenda-2026-acl1.yml`).

```yaml
- title: "Publication Title"
  authors:
    - name: "Federico Ravenda"
      remedi-lab: true
    - name: "Seyed Ali Bahrainian"
      remedi-lab: false
    - name: "Antonietta Mira"
      remedi-lab: true
    - name: "Andrea Raballo"
      remedi-lab: true
  year: 2026
  journal: "Proceedings of the 64th Annual Meeting of the Association for Computational Linguistics (ACL 2026)"
  link: "https://doi.org/10.18653/v1/2026.acl-long.1395"
  code: "https://github.com/Fede-stack/PersonalityDBench"      # optional
  dataset: "https://github.com/Fede-stack/PersonalityDBench"   # optional
  project: "https://tony.github.io"                           # optional
  note: "Main Conference"                                      # optional
```

See [references/schema.md](./references/schema.md) for full field definitions.

## Deduplication & Book Resolution Rules

1. **DOI Collision**: If two records share the exact same DOI, they are merged immediately into one record.
2. **Authored Books vs. Book Chapters**: When lab members co-author a complete textbook or monograph (e.g. *Foundations of Bayesian Statistics for Data Scientists*), scholarly APIs often generate individual chapter DOIs (e.g. `10.1201/9781003715924-6`). The engine automatically suppresses chapter-level DOIs and attributes the **full book** (e.g. `10.1201/9781003715924`) with the publisher as the venue and a dedicated "Book" action button.
3. **Contributed Chapters in Edited Volumes**: For legitimate book chapters in edited volumes (e.g. *Tasman's Psychiatry*), the engine never outputs a generic `"Book Chapter"` label; it resolves and formats the container as `In: <Book Title>. <Publisher>`.
4. **Preprint vs. Published Proceeding/Journal**: When an arXiv preprint matches an accepted conference or journal article, the peer-reviewed venue is retained as primary.
5. **Title Normalization**: Titles are stripped of case differences, extra whitespace, subtitle punctuation, and bracket qualifiers for fuzzy deduplication.

## Lab Member Attribution

The skill checks each author name against `_data/team.yml`. Any author matching a current or former lab member receives:
```yaml
remedi-lab: true
```
This renders their name in bold across all publication views.
