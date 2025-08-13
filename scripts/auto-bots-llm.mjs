import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chat } from "./llm.mjs";

const DATE = new Date().toISOString().slice(0,10);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, "..", "src", "posts");

// --- charge la liste centralisée des domaines ---
const domainsPath = path.join(__dirname, "..", "src", "_data", "domains.json");
let TEAMS = [];
try {
  const dom = JSON.parse(fs.readFileSync(domainsPath, "utf8"));
  TEAMS = Object.entries(dom).map(([slug, def]) => ({ slug, ...def }));
} catch (e) {
  console.error("domains.json invalide ou manquant:", e.message);
  process.exit(1);
}

// ========== PROMPTS ==========
const MANAGER_SYSTEM = `Tu es un Manager qui planifie le travail de 3 bots spécialisés.
Rédige un BRIEF concis en Markdown avec: Contexte, Audience, Promesse, Contraintes, Livrables, Critères qualité (0-5), Checklist finale.`;
const BOT_SYSTEM = (role) => `Tu es "${role}". Suis le brief et rends un livrable exploitable en Markdown (sections claires, concret).`;
const QA_SYSTEM = `Contrôleur qualité: note 0-5 chaque critère, propose corrections, fournis une version révisée finale.`;

// ========== HELPERS ==========
function writeFile(rel, content) {
  const f = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  return f;
}
function readFileSafe(file) {
  try { return fs.readFileSync(file, "utf8"); } catch { return null; }
}

// front-matter
const fmTeam = ({title, slug}) =>
`---
title: "${title}"
date: "${DATE}"
tags: ["post","team-manager"]
layout: layouts/post.njk
permalink: "/publications/equipes/${slug}/"
---
`;
const fmChild = ({title, teamSlug, childSlug}) =>
`---
title: "${title}"
date: "${DATE}"
tags: ["post","team-bot"]
layout: layouts/post.njk
permalink: "/publications/equipes/${teamSlug}/${childSlug}/"
---
`;

// supprime tous les anciens fichiers d'une équipe (évite conflits Eleventy)
function cleanupOldTeamFiles(teamSlug) {
  if (!fs.existsSync(OUT_DIR)) return;
  const files = fs.readdirSync(OUT_DIR);
  for (const f of files) {
    if (f.endsWith(".md") && f.includes(`-team-${teamSlug}-`) && !f.startsWith(`${DATE}-`)) {
      fs.unlinkSync(path.join(OUT_DIR, f));
      console.log("Removed old", f);
    }
  }
}

// auto-fix si un vieux fichier 'qa.md' traîne (renomme en qa-report.md + corrige permalink)
function fixQaFiles(team) {
  const qaPath = path.join(OUT_DIR, `${DATE}-team-${team.slug}-qa.md`);
  if (fs.existsSync(qaPath)) {
    let content = readFileSafe(qaPath);
    content = content.replace(
      /permalink:\s*["']?\/publications\/equipes\/([^/]+)\/[^"'\n]+["']?/,
      `permalink: "/publications/equipes/${team.slug}/qa-report/"`
    );
    const newPath = path.join(OUT_DIR, `${DATE}-team-${team.slug}-qa-report.md`);
    fs.writeFileSync(newPath, content);
    fs.unlinkSync(qaPath);
    console.log("Renamed QA -> QA-report for", team.slug);
  }
}

// ========== PIPELINE ==========
async function runTeam(team) {
  cleanupOldTeamFiles(team.slug);

  // 1) brief manager
  const brief = await chat({
    system: MANAGER_SYSTEM,
    user: `Domaine: ${team.slug}\nObjectif: ${team.goal}\nRends un BRIEF utile et mesurable pour guider 3 bots.`
  });

  // 2) livrables bots
  const outputs = {};
  for (const b of team.bots) {
    outputs[b.slug] = await chat({
      system: BOT_SYSTEM(b.name || b.role),
      user: `BRIEF:\n${brief}\n\nRéalise ta partie uniquement.`
    });
  }

  // 3) QA sur le livrable principal
  const mainKey = team.bots[0].slug;
  const qa = await chat({
    system: QA_SYSTEM,
    user: `BRIEF:\n${brief}\n\nLivrable à évaluer:\n${outputs[mainKey]}`
  });

  // 4) pages
  const managerMd =
    fmTeam({ title: team.manager, slug: team.slug }) +
    `## Brief du manager\n\n${brief}\n\n` +
    `## Livrables\n` +
    team.bots.map(b => `- [${b.name || b.role}]({{ '/publications/equipes/${team.slug}/${b.slug}/' | url }})`).join("\n") +
    `\n\n> ⚙️ Ajoute ici ton lien de paiement pour commander le pack.\n`;
  writeFile(`${DATE}-team-${team.slug}-manager.md`, managerMd);

  for (const b of team.bots) {
    const botMd =
      fmChild({ title: `${b.name || b.role} — ${team.manager}`, teamSlug: team.slug, childSlug: b.slug }) +
      outputs[b.slug] +
      `\n\n> ⚙️ Ajoute ici le lien de paiement de ce sous-produit.\n`;
    writeFile(`${DATE}-team-${team.slug}-${b.slug}.md`, botMd);
  }

  // rapport QA distinct
  const qaMd = fmChild({ title: `QA — ${team.manager}`, teamSlug: team.slug, childSlug: "qa-report" }) + qa;
  writeFile(`${DATE}-team-${team.slug}-qa-report.md`, qaMd);

  // fix de secours (au cas où)
  fixQaFiles(team);
}

async function main() {
  // Permet de générer UNE seule équipe : env TEAM=seo (par ex.)
  const only = (process.env.TEAM || "").trim();
  const list = only ? TEAMS.filter(t => t.slug === only) : TEAMS;

  for (const t of list) {
    console.log("▶ Team:", t.slug);
    await runTeam(t);
  }
  console.log("OK - équipes générées");
}

main().catch(e => { console.error(e); process.exit(1); });
