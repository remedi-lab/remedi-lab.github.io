# REMEDI Lab Publication Schema Reference

This reference document outlines the YAML file structure and all supported attributes for entries stored under `_data/publications/`.

## File Naming Convention

```
_data/publications/<first-author-lastname>-<year>-<venue-slug>.yml
```

Examples:
- `ravenda-2026-acl1.yml`
- `raballo-2025-pcn.yml`
- `ravenda-2025-plos.yml`
- `ravenda-2024-jiis.yml`

## Data Attributes

| Key | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `title` | string | **Yes** | Full official title of the paper | `"TONY: an open-source TOolkit for Nlp in psYchology"` |
| `authors` | list | **Yes** | Ordered list of authors | (see below) |
| `authors[].name` | string | **Yes** | Full author name | `"Andrea Raballo"` |
| `authors[].remedi-lab` | boolean | **Yes** | If `true`, name is rendered in bold on the website | `true` |
| `year` | integer | **Yes** | 4-digit publication year | `2026` |
| `journal` | string | **Yes** | Name of the journal, conference, workshop, or repository | `"PLOS Digital Health"` |
| `link` | string | **Yes** | URL to the official paper or landing page (preferably DOI URL) | `"https://doi.org/10.1371/journal.pdig.0000848"` |
| `code` | string | No | URL to the open-source code repository | `"https://github.com/Fede-stack/TONYpy"` |
| `dataset` | string | No | URL to the public dataset or benchmark | `"https://github.com/Fede-stack/PersonalityDBench"` |
| `project` | string | No | URL to an interactive project website or demo | `"https://tony.github.io"` |
| `slides` | string | No | URL to presentation slides | `"https://..."` |
| `note` | string | No | Supplemental citation details (volume, pages, conference track) | `"Long Paper, Main Conference"` |
| `award` | string | No | Distinction or award received | `"Best Paper Award"` |

## Rendered UI Buttons

Whenever any of the following fields are defined with a non-empty URL, a button is automatically rendered in the publication card:

- `link`: `<a class="btn btn-primary"><i class="fa fa-external-link"></i> Paper</a>`
- `code`: `<a class="btn btn-primary"><i class="fa fa-code"></i> Code</a>`
- `dataset`: `<a class="btn btn-primary"><i class="fa fa-database"></i> Dataset</a>`
- `project`: `<a class="btn btn-primary"><i class="fa fa-globe"></i> Project</a>`
- `slides`: `<a class="btn btn-primary"><i class="fa fa-desktop"></i> Slides</a>`
