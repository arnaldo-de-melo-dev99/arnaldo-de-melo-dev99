#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const USERNAME = process.env.GITHUB_USERNAME || process.env.GITHUB_REPOSITORY_OWNER || 'arnaldo-de-melo-dev99';
const PROFILE_REPO_NAME = process.env.PROFILE_REPO_NAME || USERNAME;
const README_PATH = resolve(process.env.README_PATH || 'README.md');
const PROJECT_LIMIT = Number.parseInt(process.env.PROJECT_LIMIT || '5', 10);
const TOKEN = process.env.README_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const API_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'readme-refresh-script',
};

if (TOKEN) {
  API_HEADERS.Authorization = `Bearer ${TOKEN}`;
}

const PROJECT_COPY = {
  'Goals-Plane': 'Plataforma digital para planear e organizar objectivos pessoais, com uma experiência visual simples e intuitiva, à maneira de um Trello.',
  'event-connect': 'Projecto em TypeScript e CSS em evolução, preparado para crescer com uma base limpa e moderna.',
  'DS-CEP': 'Ferramenta prática para consulta de CEP em JavaScript, HTML e CSS, com uma interface directa.',
  'Note-Pad': 'Aplicação de notas em React e Tailwind CSS, pensada para capturar ideias com rapidez e clareza.',
  'Web-site-MarketPLace': 'Marketplace de produtos digitais em fase inicial, com base para evoluir em produto e conversão.',
};

const TECH_ALIASES = new Map([
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['c', 'C'],
  ['c++', 'C++'],
  ['python', 'Python'],
  ['react', 'React'],
  ['vue', 'Vue.js'],
  ['vue.js', 'Vue.js'],
  ['next.js', 'Next.js'],
  ['nextjs', 'Next.js'],
  ['nestjs', 'Nest.js'],
  ['nest.js', 'Nest.js'],
  ['node.js', 'Node.js'],
  ['nodejs', 'Node.js'],
  ['postgresql', 'PostgreSQL'],
  ['mysql', 'MySQL'],
  ['mongodb', 'MongoDB'],
  ['tailwind css', 'Tailwind CSS'],
  ['tailwindcss', 'Tailwind CSS'],
  ['github actions', 'GitHub Actions'],
  ['docker', 'Docker'],
  ['aws', 'AWS'],
  ['linux', 'Linux'],
  ['tensorflow', 'TensorFlow'],
  ['pytorch', 'PyTorch'],
  ['scikit-learn', 'Scikit-learn'],
  ['seo', 'SEO'],
]);

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCompactDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'A definir';
  }
  return `${String(date.getUTCDate()).padStart(2, '0')} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function prettifyTech(value) {
  const key = String(value).trim().toLowerCase();
  return TECH_ALIASES.get(key) || value;
}

function chunk(array, size) {
  const output = [];
  for (let index = 0; index < array.length; index += size) {
    output.push(array.slice(index, index + size));
  }
  return output;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRateLimitError(error) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
    && error.message.toLowerCase().includes('rate limit exceeded'),
  );
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...API_HEADERS,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const content = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const reason = typeof content === 'object' && content && 'message' in content
      ? content.message
      : text || response.statusText;
    throw new Error(`GitHub API error ${response.status}: ${reason}`);
  }

  return content;
}

async function fetchGraphQL(query, variables) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();

  if (!response.ok || payload.errors) {
    const reason = payload.errors?.map((item) => item.message).join('; ') || response.statusText;
    throw new Error(`GitHub GraphQL error: ${reason}`);
  }

  return payload.data;
}

async function getProfile() {
  return fetchJson(`https://api.github.com/users/${USERNAME}`);
}

async function getOwnedRepos() {
  const repos = await fetchJson(
    `https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=created&direction=desc&type=owner`,
  );

  return repos
    .filter((repo) => !repo.fork && !repo.archived)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getProjectRepos(ownedRepos) {
  return ownedRepos
    .filter((repo) => repo.name !== PROFILE_REPO_NAME)
    .slice(0, PROJECT_LIMIT);
}

async function getRepoLanguages(repo) {
  return fetchJson(repo.languages_url).catch(() => ({}));
}

function getTopTechsFromLanguages(languages = {}) {
  return Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => prettifyTech(name));
}

function getDominantLanguage(languagesByRepo = []) {
  const totals = new Map();

  for (const languages of languagesByRepo) {
    for (const [name, bytes] of Object.entries(languages || {})) {
      totals.set(name, (totals.get(name) || 0) + bytes);
    }
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'A definir';
}

async function countPublicCommitsForRepo(repoName, since) {
  let total = 0;
  let page = 1;

  while (true) {
    const commits = await fetchJson(
      `https://api.github.com/repos/${USERNAME}/${repoName}/commits?author=${encodeURIComponent(USERNAME)}&since=${encodeURIComponent(since)}&per_page=100&page=${page}`,
    );

    if (!Array.isArray(commits) || commits.length === 0) {
      break;
    }

    total += commits.length;

    if (commits.length < 100) {
      break;
    }

    page += 1;
  }

  return total;
}

async function getPublicCommitsThisMonth(repos, since) {
  const counts = await Promise.all(repos.map((repo) => countPublicCommitsForRepo(repo.name, since)));
  return counts.reduce((sum, value) => sum + value, 0);
}

async function getGraphQLMonthlyCommits(now) {
  if (!TOKEN) {
    return null;
  }

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const data = await fetchGraphQL(
    `
      query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            totalCommitContributions
          }
        }
      }
    `,
    {
      login: USERNAME,
      from: monthStart.toISOString(),
      to: now.toISOString(),
    },
  );

  return data?.user?.contributionsCollection?.totalCommitContributions ?? null;
}

function buildStatsBlock({ profile, monthlyCommits, dominantLanguage, latestProject }) {
  const latestProjectName = latestProject ? escapeHtml(latestProject.name) : 'A definir';
  const latestProjectUrl = latestProject ? latestProject.html_url : '#';

  return [
    '<div align="center">',
    '  <table align="center" cellpadding="10" cellspacing="2" border="1" bordercolor="#1F2937" width="92%">',
    '    <tr>',
    `      <td align="center" width="25%" bgcolor="#0B1120"><strong>Repos públicos</strong><br/>${profile.public_repos ?? 'A definir'}</td>`,
    `      <td align="center" width="25%" bgcolor="#0B1120"><strong>Commits este mês</strong><br/>${monthlyCommits ?? 'A definir'}</td>`,
    `      <td align="center" width="25%" bgcolor="#0B1120"><strong>Linguagem dominante</strong><br/>${escapeHtml(prettifyTech(dominantLanguage))}</td>`,
    `      <td align="center" width="25%" bgcolor="#0B1120"><strong>Último projeto</strong><br/><a href="${latestProjectUrl}">${latestProjectName}</a></td>`,
    '    </tr>',
    '  </table>',
    '</div>',
  ].join('\n');
}

function buildProjectCard(repo, languages) {
  const description = escapeHtml(PROJECT_COPY[repo.name] || repo.description || 'Projeto em evolução com base pública ainda sem descrição.');
  const techs = getTopTechsFromLanguages(languages);
  const techLine = techs.length ? techs.map(escapeHtml).join(' • ') : 'A definir';

  return [
    '      <img src="./assets/project-card-accent.svg" width="100%" alt="" />',
    `      <h3><a href="${repo.html_url}">${escapeHtml(repo.name)}</a></h3>`,
    `      <p>${description}</p>`,
    `      <p><strong>Techs:</strong> ${techLine}</p>`,
  ].join('\n');
}

function buildProjectsBlock(projects, languagesByRepo) {
  const cards = projects.map((repo) => buildProjectCard(repo, languagesByRepo[repo.name] || {}));
  const rows = chunk(cards, 2);

  return [
    '<div align="center">',
    '  <table align="center" cellpadding="12" cellspacing="2" border="1" bordercolor="#1F2937" width="92%">',
    ...rows.map((row) => {
      if (row.length === 2) {
        return [
          '    <tr>',
          `      <td width="50%" valign="top" bgcolor="#0B1120">\n${row[0]}\n      </td>`,
          `      <td width="50%" valign="top" bgcolor="#0B1120">\n${row[1]}\n      </td>`,
          '    </tr>',
        ].join('\n');
      }

      return [
        '    <tr>',
        `      <td colspan="2" valign="top" bgcolor="#0B1120">\n${row[0]}\n      </td>`,
        '    </tr>',
      ].join('\n');
    }),
    '  </table>',
    '</div>',
  ].join('\n');
}

function replaceBlock(content, startMarker, endMarker, replacement) {
  const pattern = new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`);

  if (!pattern.test(content)) {
    throw new Error(`Não encontrei os marcadores ${startMarker} e ${endMarker} no README.`);
  }

  return content.replace(pattern, `${startMarker}\n${replacement}\n${endMarker}`);
}

async function main() {
  const [profile, ownedRepos] = await Promise.all([
    getProfile().catch(() => ({})),
    getOwnedRepos().catch(() => []),
  ]);

  if (ownedRepos.length === 0) {
    console.log('GitHub API returned no repositories. Leaving README unchanged.');
    return;
  }

  const repos = getProjectRepos(ownedRepos);
  const languagesEntries = await Promise.all(
    repos.map(async (repo) => [repo.name, await getRepoLanguages(repo)]),
  );

  const languagesByRepo = Object.fromEntries(languagesEntries);
  const dominantLanguage = getDominantLanguage(languagesEntries.map(([, languages]) => languages));
  const latestProject = repos[0] || null;
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  let monthlyCommits = null;
  try {
    monthlyCommits = await getGraphQLMonthlyCommits(now);
  } catch {
    monthlyCommits = null;
  }

  if (monthlyCommits === null) {
    try {
      monthlyCommits = await getPublicCommitsThisMonth(ownedRepos, since);
    } catch (error) {
      if (isRateLimitError(error)) {
        console.log('GitHub API rate limit reached. Leaving README unchanged.');
        return;
      }

      throw error;
    }
  }

  const currentReadme = await readFile(README_PATH, 'utf8');
  const statsBlock = buildStatsBlock({
    profile,
    monthlyCommits,
    dominantLanguage,
    latestProject,
  });
  const projectsBlock = buildProjectsBlock(repos, languagesByRepo);

  let updatedReadme = currentReadme;
  updatedReadme = replaceBlock(
    updatedReadme,
    '<!-- AUTO:REALTIME_STATS_START -->',
    '<!-- AUTO:REALTIME_STATS_END -->',
    statsBlock,
  );
  updatedReadme = replaceBlock(
    updatedReadme,
    '<!-- AUTO:PROJECTS_START -->',
    '<!-- AUTO:PROJECTS_END -->',
    projectsBlock,
  );

  if (updatedReadme === currentReadme) {
    console.log('README already up to date.');
    return;
  }

  await writeFile(README_PATH, updatedReadme);
  console.log(`README updated with ${repos.length} projects and ${monthlyCommits} commits this month.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
