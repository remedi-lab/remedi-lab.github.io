const fs = require('fs');
const path = require('path');

// Helper to parse simple YAML files
function parseYaml(str) {
  const lines = str.split('\n');
  const result = [];
  let currentTop = null;
  let currentKey = null;
  let currentSubObj = null;
  let inMultiline = false;

  for (let rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = rawLine.search(/\S/);

    if (rawLine.startsWith('- ')) {
      currentTop = {};
      result.push(currentTop);
      currentKey = null;
      currentSubObj = null;
      inMultiline = false;
      const content = rawLine.slice(2).trim();
      if (content.includes(':')) {
        const idx = content.indexOf(':');
        const k = content.slice(0, idx).trim();
        const v = content.slice(idx + 1).trim();
        currentTop[k] = parseVal(v);
      }
    } else if (currentTop) {
      if (trimmed.startsWith('- ')) {
        inMultiline = false;
        const itemContent = trimmed.slice(2).trim();
        if (currentKey) {
          if (!Array.isArray(currentTop[currentKey])) {
            currentTop[currentKey] = [];
          }
          if (itemContent.includes(':')) {
            const idx = itemContent.indexOf(':');
            const subK = itemContent.slice(0, idx).trim();
            const subV = itemContent.slice(idx + 1).trim();
            currentSubObj = { [subK]: parseVal(subV) };
            currentTop[currentKey].push(currentSubObj);
          } else {
            currentSubObj = null;
            currentTop[currentKey].push(parseVal(itemContent));
          }
        }
      } else if (trimmed.includes(':') && !inMultiline) {
        const idx = trimmed.indexOf(':');
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();

        if (currentSubObj && indent >= 6) {
          currentSubObj[k] = parseVal(v);
        } else {
          currentSubObj = null;
          currentKey = k;
          if (v === '>' || v === '|') {
            inMultiline = true;
            currentTop[k] = '';
          } else if (v === '') {
            currentTop[k] = '';
          } else {
            currentTop[k] = parseVal(v);
          }
        }
      } else if (inMultiline && currentKey) {
        if (currentTop[currentKey]) {
          currentTop[currentKey] += ' ' + trimmed;
        } else {
          currentTop[currentKey] = trimmed;
        }
      }
    }
  }

  function parseVal(v) {
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v === 'null' || v === '~' || v === '') return '';
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    return v;
  }

  return result;
}

function parseAuthorsPub(str) {
  const lines = str.split('\n');
  const pub = { authors: [] };
  let inAuthors = false;
  let currentAuthor = null;

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('- ')) trimmed = trimmed.slice(2).trim();

    if (trimmed.startsWith('title:')) {
      inAuthors = false;
      pub.title = trimmed.replace(/^title:\s*/, '').replace(/^["\']|["\']$/g, '').replace(/\\"/g, '"');
    } else if (trimmed.startsWith('authors:')) {
      inAuthors = true;
    } else if (trimmed.startsWith('year:')) {
      inAuthors = false;
      pub.year = parseInt(trimmed.replace(/^year:\s*/, ''), 10);
    } else if (trimmed.startsWith('journal:')) {
      inAuthors = false;
      pub.journal = trimmed.replace(/^journal:\s*/, '').replace(/^["\']|["\']$/g, '').replace(/\\"/g, '"');
    } else if (trimmed.startsWith('link:')) {
      inAuthors = false;
      pub.link = trimmed.replace(/^link:\s*/, '').replace(/^["\']|["\']$/g, '');
    } else if (trimmed.startsWith('code:')) {
      inAuthors = false;
      pub.code = trimmed.replace(/^code:\s*/, '').replace(/^["\']|["\']$/g, '');
    } else if (trimmed.startsWith('dataset:')) {
      inAuthors = false;
      pub.dataset = trimmed.replace(/^dataset:\s*/, '').replace(/^["\']|["\']$/g, '');
    } else if (trimmed.startsWith('project:')) {
      inAuthors = false;
      pub.project = trimmed.replace(/^project:\s*/, '').replace(/^["\']|["\']$/g, '');
    } else if (trimmed.startsWith('slides:')) {
      inAuthors = false;
      pub.slides = trimmed.replace(/^slides:\s*/, '').replace(/^["\']|["\']$/g, '');
    } else if (trimmed.startsWith('award:')) {
      inAuthors = false;
      pub.award = trimmed.replace(/^award:\s*/, '').replace(/^["\']|["\']$/g, '').replace(/\\"/g, '"');
    } else if (trimmed.startsWith('note:')) {
      inAuthors = false;
      pub.note = trimmed.replace(/^note:\s*/, '').replace(/^["\']|["\']$/g, '').replace(/\\"/g, '"');
    } else if (inAuthors) {
      if (trimmed.startsWith('name:')) {
        currentAuthor = { name: trimmed.replace(/^name:\s*/, '').replace(/^["\']|["\']$/g, '') };
        pub.authors.push(currentAuthor);
      } else if (trimmed.startsWith('remedi-lab:')) {
        if (currentAuthor) {
          currentAuthor['remedi-lab'] = trimmed.includes('true');
        }
      }
    }
  }
  return pub;
}

// Calculate base URL (e.g. for GitHub Pages project sites like /remedi_website)
const baseUrl = process.env.BASE_URL !== undefined
  ? process.env.BASE_URL
  : (process.env.GITHUB_REPOSITORY && !process.env.GITHUB_REPOSITORY.endsWith('.github.io')
      ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}`
      : '');

const outDir = path.join(process.cwd(), '_site');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Copy assets
['styles', 'js', 'resources'].forEach(dir => {
  fs.cpSync(dir, path.join(outDir, dir), { recursive: true });
});

// Load team
const team = parseYaml(fs.readFileSync('_data/team.yml', 'utf8'));

// Load projects
const projects = parseYaml(fs.readFileSync('_data/projects.yml', 'utf8'));

// Load publications
const pubFiles = fs.readdirSync('_data/publications').filter(f => f.endsWith('.yml'));
const publications = [];
pubFiles.forEach(f => {
  const content = fs.readFileSync(path.join('_data/publications', f), 'utf8');
  const pub = parseAuthorsPub(content);
  if (pub.title) publications.push(pub);
});

// Sort publications newest first
publications.sort((a, b) => (b.year || 0) - (a.year || 0));

// Components renderers
function renderMember(m) {
  const hasImg = typeof m.img === 'string' && m.img.trim().length > 0;
  const imgRel = hasImg ? `resources/img/lab_members/${m.img.trim()}` : 'resources/img/lab_members/profile_placeholder.png';
  const imgSrc = `${baseUrl ? baseUrl + '/' : ''}${imgRel}`;
  let socials = '';
  if (typeof m.website === 'string' && m.website.trim()) socials += `<div><a href="${m.website.trim()}" target="_blank" rel="noopener" class="btn btn-primary" title="Website"><i class="fa fa-link wow bounceIn" aria-hidden="true"></i></a></div>`;
  if (typeof m.usi_directory === 'string' && m.usi_directory.trim()) socials += `<div><a href="${m.usi_directory.trim()}" target="_blank" rel="noopener" class="btn btn-primary" title="USI Directory Profile"><i class="fa fa-university wow bounceIn" aria-hidden="true"></i></a></div>`;
  if (typeof m.google_scholar === 'string' && m.google_scholar.trim()) socials += `<div><a href="${m.google_scholar.trim()}" target="_blank" rel="noopener" class="btn btn-primary" title="Google Scholar"><i class="ai ai-google-scholar wow bounceIn" aria-hidden="true"></i></a></div>`;
  if (typeof m.semantic_scholar === 'string' && m.semantic_scholar.trim()) socials += `<div><a href="${m.semantic_scholar.trim()}" target="_blank" rel="noopener" class="btn btn-primary" title="Semantic Scholar"><i class="ai ai-semantic-scholar wow bounceIn" aria-hidden="true"></i></a></div>`;
  if (typeof m.linkedin === 'string' && m.linkedin.trim()) socials += `<div><a href="${m.linkedin.trim()}" target="_blank" rel="noopener" class="btn btn-primary" title="LinkedIn"><i class="fa fa-linkedin wow bounceIn" aria-hidden="true"></i></a></div>`;
  if (typeof m.github === 'string' && m.github.trim()) socials += `<div><a href="${m.github.trim()}" target="_blank" rel="noopener" class="btn btn-primary" title="GitHub"><i class="fa fa-github wow bounceIn" aria-hidden="true"></i></a></div>`;
  if (typeof m.twitter === 'string' && m.twitter.trim()) socials += `<div><a href="${m.twitter.trim()}" target="_blank" rel="noopener" class="btn btn-primary" title="Twitter"><i class="fa fa-twitter wow bounceIn" aria-hidden="true"></i></a></div>`;

  return `
  <div class="col-lg-3 col-md-4 text-center">
    <div class="service-box">
      <img src="${imgSrc}" class="member-photo wow text-primary" data-wow-delay=".1s" alt="${m.first_name} ${m.last_name}">
      <p><strong>${m.first_name} ${m.last_name}</strong></p>
      <p class="text-muted">${m.role}${m.affiliation ? `<br><small>${m.affiliation}</small>` : ''}</p>
      <div class="socials">
        ${socials}
      </div>
    </div>
  </div>`;
}

function renderPublication(pub) {
  const authors = (pub.authors || []).map((a, i, arr) => {
    const isLast = i === arr.length - 1;
    const nameStr = a['remedi-lab'] ? `<strong>${a.name}</strong>` : a.name;
    return `${nameStr}${isLast ? ` (${pub.year}).` : ','}`;
  }).join(' ');

  let links = '';
  if (pub.link) {
    const noteLower = (pub.note || '').toLowerCase();
    const journalLower = (pub.journal || '').toLowerCase();
    const isBook = noteLower.includes('book') || noteLower.includes('ebook') || noteLower.includes('textbook');
    const isChapter = journalLower.startsWith('in:');
    const label = isBook ? 'Book' : (isChapter ? 'Chapter' : 'Paper');
    const icon = isBook ? 'fa-book' : 'fa-external-link';
    links += `<div><a href="${pub.link}" target="_blank" rel="noopener" class="btn btn-primary"><i class="fa ${icon}" aria-hidden="true"></i> ${label}</a></div>`;
  }
  if (pub.code) links += `<div><a href="${pub.code}" target="_blank" rel="noopener" class="btn btn-primary"><i class="fa fa-code" aria-hidden="true"></i> Code</a></div>`;
  if (pub.dataset) links += `<div><a href="${pub.dataset}" target="_blank" rel="noopener" class="btn btn-primary"><i class="fa fa-database" aria-hidden="true"></i> Dataset</a></div>`;
  if (pub.project) links += `<div><a href="${pub.project}" target="_blank" rel="noopener" class="btn btn-primary"><i class="fa fa-globe" aria-hidden="true"></i> Project</a></div>`;
  if (pub.slides) links += `<div><a href="${pub.slides}" target="_blank" rel="noopener" class="btn btn-primary"><i class="fa fa-desktop" aria-hidden="true"></i> Slides</a></div>`;

  return `
  <div>
    <p>
      ${pub.link ? `<a href="${pub.link}" target="_blank" rel="noopener">${pub.title}</a>.` : `${pub.title}.`}
      ${authors}
      <span class="publication-details"><em>${pub.journal || ''}</em>${pub.note ? `. ${pub.note}` : ''}.</span>
    </p>
    ${pub.award ? `<p class="award"><i class="fa fa-trophy" aria-hidden="true"></i> ${pub.award}.</p>` : ''}
    ${links}
  </div>`;
}

function renderStudent(m) {
  const icon = m.role === 'Student Researcher' ? 'fa-flask' : 'fa-graduation-cap';
  return `
  <div class="col-lg-4 col-md-6 col-sm-12">
    <div class="student-card">
      <div class="student-icon">
        <i class="fa ${icon}" aria-hidden="true"></i>
      </div>
      <div class="student-details">
        <h4 class="student-name">${m.first_name} ${m.last_name}</h4>
        <p class="student-role">${m.role}${m.affiliation ? ` &middot; <span class="student-affiliation">${m.affiliation}</span>` : ''}</p>
      </div>
    </div>
  </div>`;
}

function renderTeamSection() {
  const heads = team.filter(m => m.role === 'Head & Co-founder' || m.role === 'Co-director');
  const postdocs = team.filter(m => m.role === 'Postdoctoral Researcher');
  const phds = team.filter(m => m.role === 'PhD student' && !m.is_alumni);
  const students = team.filter(m => (m.role === 'Master student' || m.role === 'Student Researcher') && !m.is_alumni);
  const board = team.filter(m => m.role === 'Scientific Advisory Board' || m.role === 'Strategic Advisor');
  const partners = team.filter(m => m.role === 'Partner');
  const alumni = team.filter(m => m.is_alumni);

  return `
  <section id="team">
    <div class="container-fluid">
      <div class="row">
        <div class="col-lg-12">
          <h2 class="section-heading">Our team</h2>
          <hr class="section-bar primary">
        </div>
      </div>
    </div>
    <div class="container-fluid">
      <h2 class="section-subheading">Heads and Co-founders</h2>
      <div class="row">${heads.map(renderMember).join('')}</div>

      <h2 class="section-subheading">Scientific Advisory Board &amp; Advisors</h2>
      <div class="row">${board.map(renderMember).join('')}</div>

      <h2 class="section-subheading">Partners</h2>
      <div class="row">${partners.map(renderMember).join('')}</div>

      <h2 class="section-subheading">PhD Students</h2>
      <div class="row">${phds.map(renderMember).join('')}</div>

      ${postdocs.length > 0 ? `<h2 class="section-subheading">Postdoctoral Researchers</h2><div class="row">${postdocs.map(renderMember).join('')}</div>` : ''}

      <h2 class="section-subheading">Master Students</h2>
      <div class="row student-cards-row">
        ${students.map(renderStudent).join('')}
      </div>

      <h2 class="section-subheading">Alumni</h2>
      <div class="row student-cards-row">
        ${alumni.map(renderStudent).join('')}
      </div>
    </div>
  </section>`;
}

function renderProjectCard(p) {
  const hasLink = typeof p.link === 'string' && p.link.startsWith('http');
  const badges = (p.funding || []).map(f => `<span class="project-badge">${f}</span>`).join(' ');
  const people = (p.people || []).map(per => `<strong>${per.name}</strong>${per.role ? ` <small class="text-muted">(${per.role})</small>` : ''}`).join(', ');

  return `
  <div class="col-lg-4 col-md-6 col-sm-12 project-grid-item">
    <div class="project-card">
      <div>
        <div class="project-card-top">
          <div class="project-icon-box">
            <img src="${baseUrl ? baseUrl + '/' : ''}resources/img/projects/${p.img}" alt="${p.title}" class="project-icon-img">
          </div>
          <div class="project-header-badges">
            ${badges}
          </div>
        </div>
        <h3 class="project-title">${p.title}</h3>
        <p class="project-desc text-muted">${p.description}</p>
      </div>
      <div class="project-card-bottom">
        <div class="project-people">
          <i class="fa fa-users text-primary" aria-hidden="true"></i>
          <span>${people}</span>
        </div>
        ${hasLink ? `<div class="project-action"><a href="${p.link}" target="_blank" rel="noopener" class="btn btn-primary btn-sm"><i class="fa fa-external-link" aria-hidden="true"></i> Explore Project</a></div>` : ''}
      </div>
    </div>
  </div>`;
}

function renderResearchSection() {
  return `
  <section id="research">
    <div class="container-fluid">
      <div class="row">
        <div class="col-lg-12">
          <h2 class="section-heading">Research Pillars</h2>
          <hr class="section-bar primary">
          <p class="lead text-muted">
            Our mission is to bridge the critical gap between state-of-the-art artificial intelligence and bedside clinical implementation. We structure our investigations around three foundational pillars:
          </p>
        </div>
      </div>
    </div>
    <div class="container-fluid">
      <div class="row">
        <div class="col-xl-4 col-lg-4 col-md-6 col-sm-12 text-center">
          <div class="service-box research-interest">
            <div class="icon-wrapper">
              <i class="fa fa-stethoscope fa-3x text-primary" aria-hidden="true"></i>
            </div>
            <h3>Explainable AI for Medicine</h3>
            <p class="text-muted">
              We design AI methods tailored to clinical practice, capable of articulating their decision-making logic in clinically relevant terms. The goal is not merely algorithmic transparency, but the translation of computational representations into reasoning that mirrors clinical thinking.
            </p>
          </div>
        </div>
        <div class="col-xl-4 col-lg-4 col-md-6 col-sm-12 text-center">
          <div class="service-box research-interest">
            <div class="icon-wrapper">
              <i class="fa fa-comments-o fa-3x text-primary" aria-hidden="true"></i>
            </div>
            <h3>NLP in Healthcare</h3>
            <p class="text-muted">
              We explore advanced natural language processing techniques to parse clinical documentation and detect early diagnostic signals through spontaneous digital communications, capturing both formal medical records and authentic lived experiences.
            </p>
          </div>
        </div>
        <div class="col-xl-4 col-lg-4 col-md-6 col-sm-12 text-center">
          <div class="service-box research-interest">
            <div class="icon-wrapper">
              <i class="fa fa-heartbeat fa-3x text-primary" aria-hidden="true"></i>
            </div>
            <h3>Clinical &amp; AI Integration</h3>
            <p class="text-muted">
              We build rigorous validation frameworks that respect the high standards of medical evidence while fulfilling the methodological demands of modern machine learning and robust uncertainty quantification.
            </p>
          </div>
        </div>
      </div>
    </div>

    <br/><br/>

    <div class="container-fluid methodology-section">
      <div class="row">
        <div class="col-lg-12">
          <h2 class="section-heading">Methodological Approach</h2>
          <hr class="section-bar primary">
          <p class="lead text-muted">
            We develop data- and evidence-centric algorithms designed to empower clinical judgment through core methodological principles:
          </p>
        </div>
      </div>
      <div class="row">
        <div class="col-md-6 col-sm-12">
          <div class="methodology-card">
            <div class="method-icon"><i class="fa fa-database text-primary" aria-hidden="true"></i></div>
            <h4>Triangulating Diverse Data Sources</h4>
            <p class="text-muted">
              Our methodology integrates diverse data streams: from structured clinical datasets gathered in outpatient and psychiatric settings, to conversational data from digital platforms where individuals express mental health concerns. This triangulation captures both formal clinical nosology and authentic lived experience.
            </p>
          </div>
        </div>
        <div class="col-md-6 col-sm-12">
          <div class="methodology-card">
            <div class="method-icon"><i class="fa fa-sliders text-primary" aria-hidden="true"></i></div>
            <h4>Rigor, Interpretability &amp; Uncertainty</h4>
            <p class="text-muted">
              We develop algorithms that are scalable, reproducible, interpretable, and equipped with robust uncertainty quantification — delivering bedside decision-support tools that do not replace clinical judgment, but empower clinicians to make timely, personalized decisions.
            </p>
          </div>
        </div>
      </div>
    </div>

    <br/><br/>

    <div class="container-fluid projects-section">
      <div class="row">
        <div class="col-lg-12">
          <h2 class="section-heading">Projects &amp; Collaborations</h2>
          <hr class="section-bar primary">
          <p class="lead text-muted">
            Translational initiatives, open-source computational toolkits, and interdisciplinary clinical collaborations:
          </p>
        </div>
      </div>
      <div class="row projects-grid">
        ${projects.map(renderProjectCard).join('')}
      </div>
    </div>
  </section>`;
}

function renderPublicationsSection() {
  const extractedYears = publications.map(p => p.year).filter(y => typeof y === 'number' && !isNaN(y));
  const years = [...new Set(extractedYears)].sort((a, b) => b - a);
  if (years.length === 0) years.push(2026, 2025);
  const items = years.map((y, idx) => {
    const yearPubs = publications.filter(p => p.year === y);
    const checked = idx === 0 ? '' : ' checked';
    return `
    <li>
      <input type="checkbox"${checked}>
      <i></i>
      <h3>${y}</h3>
      ${yearPubs.map(renderPublication).join('')}
    </li>`;
  }).join('');

  return `
  <section id="publications">
    <div class="container-fluid">
      <div class="row">
        <div class="col-lg-12">
          <h2 class="section-heading">Publications</h2>
          <hr class="section-bar primary">
          <p class="text-muted">
            Our recent peer-reviewed journal papers, conference proceedings, and open-source contributions. Members of REMEDI Lab are shown in <strong>bold</strong>.
          </p>
        </div>
      </div>
    </div>
    <div class="container-fluid">
      <ul>
        ${items}
      </ul>
    </div>
  </section>`;
}

function renderContactSection() {
  return fs.readFileSync('_includes/contact.html', 'utf8').replace(/\{\{url\}\}/g, baseUrl);
}

function renderPage(contentHtml, pageTitle, extraScripts = '') {
  let head = fs.readFileSync('_includes/head.html', 'utf8')
    .replace(/\{\{site\.description\}\}/g, 'REthinking MEntal health through Clinical and Data Intelligence at Università della Svizzera italiana (USI), Euler Institute, Lugano, Switzerland.')
    .replace(/\{\% if page\.title \%\}[\s\S]*?\{\% endif \%\}/g, pageTitle ? `${pageTitle} | REMEDI Lab` : 'REMEDI Lab | Università della Svizzera italiana')
    .replace(/\{\{url\}\}/g, baseUrl);

  let nav = fs.readFileSync('_includes/nav.html', 'utf8').replace(/\{\{url\}\}/g, baseUrl);
  let scripts = fs.readFileSync('_includes/scripts.html', 'utf8').replace(/\{\{url\}\}/g, baseUrl);
  let formattedExtraScripts = extraScripts.replace(/src="([^"]+)"/g, (match, p1) => {
    if (p1.startsWith('http') || p1.startsWith('/')) return match;
    return `src="${baseUrl ? baseUrl + '/' : ''}${p1}"`;
  });

  const isHome = !pageTitle;
  const bodyClass = isHome ? 'home-page' : 'subpage';

  if (isHome) {
    return `<!DOCTYPE html>
<html lang="en">
${head}
<body id="page-top" class="${bodyClass}">
  ${nav}
  <main>
    ${contentHtml}
  </main>
  <footer class="site-footer">
    <div class="container text-center">
      <p class="text-muted">
        &copy; 2026 REMEDI Lab &middot; Euler Institute &middot; Università della Svizzera italiana (USI), Lugano, Switzerland.
      </p>
    </div>
  </footer>
  ${scripts}
  ${formattedExtraScripts}
</body>
</html>`;
  } else {
    return `<!DOCTYPE html>
<html lang="en">
${head}
<body id="page-top" class="${bodyClass}">
  ${nav}
  <main class="subpage-main">
    <div class="container content-container">
      ${contentHtml}
    </div>
  </main>
  <footer class="site-footer">
    <div class="container text-center">
      <p class="text-muted">
        &copy; 2026 REMEDI Lab &middot; Euler Institute &middot; Università della Svizzera italiana (USI), Lugano, Switzerland.
      </p>
    </div>
  </footer>
  ${scripts}
  ${formattedExtraScripts}
</body>
</html>`;
  }
}

// 1. Index / Home
const frontLayout = fs.readFileSync('_layouts/front.html', 'utf8');
const mainMatch = frontLayout.match(/<main>([\s\S]*?)<\/main>/);
const homeContent = mainMatch ? mainMatch[1].replace(/\{\{url\}\}/g, baseUrl) : '';
fs.writeFileSync(path.join(outDir, 'index.html'), renderPage(homeContent, '', '<script src="js/index.js"></script>'), 'utf8');

// 2. Team
fs.writeFileSync(path.join(outDir, 'team.html'), renderPage(renderTeamSection(), 'Team', '<script src="js/team.js"></script>'), 'utf8');

// 3. Research
fs.writeFileSync(path.join(outDir, 'research.html'), renderPage(renderResearchSection(), 'Research'), 'utf8');

// 4. Publications
fs.writeFileSync(path.join(outDir, 'publications.html'), renderPage(renderPublicationsSection(), 'Publications'), 'utf8');

// 5. Contact
fs.writeFileSync(path.join(outDir, 'contact.html'), renderPage(renderContactSection(), 'Join Us'), 'utf8');

// 6. 404
const notFound = fs.readFileSync('_includes/404.html', 'utf8').replace(/\{\{url\}\}/g, baseUrl);
fs.writeFileSync(path.join(outDir, '404.html'), renderPage(notFound, '404 Not Found'), 'utf8');

console.log('Build finished successfully! Static files generated in _site/:');
fs.readdirSync(outDir).forEach(f => console.log(' - ' + f));
