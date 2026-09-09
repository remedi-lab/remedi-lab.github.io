# REMEDI Lab Website

Official website for **REMEDI Lab** (*REthinking MEntal health through Clinical and Data Intelligence*), based at the [Euler Institute](https://www.euler.usi.ch) of the [Università della Svizzera italiana (USI)](https://www.usi.ch) in Lugano, Switzerland.

The site is built with a modern academic split-screen layout modeled after [usi-nlp.github.io](https://usi-nlp.github.io), featuring typewriter tagline rotation, data-driven team and publication archives, responsive mobile navigation, and GitHub Pages Jekyll compatibility.

---

## Quick Start

### Option A: Instant Node Preview (Zero Setup)

Build the static site and run the preview server:

```bash
npm run build
npm run serve
```

Open [http://localhost:4000](http://localhost:4000) in your browser.

### Option B: Jekyll / Ruby (Standard GitHub Pages)

```bash
bundle install
bundle exec jekyll serve
```

Open [http://localhost:4000](http://localhost:4000) in your browser.

---

## Directory Structure

```text
├── _config.yml               # Jekyll site settings & metadata
├── Gemfile                   # Ruby gems for GitHub Pages
├── package.json              # Node build/serve helper scripts
├── index.html                # Home page (split hero, mission, news)
├── team.html                 # Team page
├── research.html             # Research pillars & collaborative projects
├── publications.html         # Collapsible publications archive
├── contact.html              # "Work with us!" / Join Us & location
├── 404.html                  # Error page
├── _data/                    # YAML data collections
│   ├── team.yml              # Heads, advisory board, partners, researchers, alumni
│   ├── projects.yml          # Active & past research projects
│   └── publications/         # Individual publication YAML files
├── _includes/                # Modular layout components
│   ├── head.html             # HTML head with fonts and metadata
│   ├── nav.html              # Fixed vertical sidebar navigation
│   ├── scripts.html          # JavaScript vendor scripts
│   ├── team.html             # Team layout section
│   ├── research.html         # Research layout section
│   ├── publications.html     # Publications layout section
│   ├── contact.html          # Contact / Join Us accordion section
│   └── components/           # Reusable cards (member, publication)
├── _layouts/                 # Jekyll layouts (front, team, research, etc.)
├── styles/                   # SASS and CSS stylesheets
│   ├── css/main.scss         # Main entry point stylesheet
│   └── _sass/                # SCSS partials (_base.scss, _mixins.scss)
├── js/                       # Client-side scripts (TxtRotate typewriter, etc.)
└── resources/                # Static assets (USI logo, icons, portraits)
```

---

## Adding Content

### 1. Adding a Lab Member
Add an entry in `_data/team.yml`:

```yaml
- first_name: FirstName
  last_name: LastName
  role: PhD student              # e.g., Head & Co-founder, Postdoctoral Researcher, PhD student, Master student
  affiliation: USI
  img: portrait.jpg             # place file in resources/img/lab_members/
  is_alumni: false
  website: https://...
  google_scholar: https://...
  github: https://...
```

### 2. Adding a Publication
Create a new file in `_data/publications/<author>-<year>-<venue>.yml`:

```yaml
- title: "Paper Title"
  authors:
    - name: "Federico Ravenda"
      remedi-lab: true          # bolded in author list
    - name: "Collaborator Name"
      remedi-lab: false
  year: 2026
  journal: "Conference or Journal Name"
  link: "https://arxiv.org/abs/..."
  code: "https://github.com/..."
  dataset: "https://huggingface.co/..."
  note: "Oral Presentation"
```

### 3. Adding a Research Project
Add an entry in `_data/projects.yml`:

```yaml
- title: "Project Name"
  active: true
  img: "icon.svg"               # place file in resources/img/projects/
  link: "research.html"
  funding:
    - "Funding Agency / Grant Name"
  people:
    - name: "Member Name"
      role: "Affiliation"
  description: >
    Project description and methodology.
```

---

## GitHub Pages Deployment

1. Push this repository to GitHub (e.g. repository name `remedi-website` or `<username>.github.io`).
2. Go to **Settings** > **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch** (branch `main`, folder `/ (root)`).
4. GitHub Pages will automatically build and host the Jekyll site at `https://<org>.github.io/<repo>` or your custom domain.
