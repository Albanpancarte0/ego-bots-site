import fs from "node:fs";
import path from "node:path";
import paymentsData from "../src/_data/payments.json" with { type: "json" };
import { chat } from "./llm.mjs";

const PAY = paymentsData || {};
const DATE = new Date().toISOString().slice(0,10);
const OUT_DIR = path.join("src", "posts");

// === EQUIPES (tu pourras en rajouter après que ça tourne) ===
const TEAMS = [
  { slug: "seo", manager: "Manager SEO",
    bots: [
      { slug: "researcher", name: "Keyword Researcher" },
      { slug: "onpage",     name: "On-Page Optimizer" },
      { slug: "qa",         name: "Quality Assessor" }
    ],
    goal: "Sortir un plan SEO monétisable pour une niche précise avec une page 'offre' prête à vendre."
  },
  { slug: "ads", manager: "Manager Ads & Créa",
    bots: [
      { slug: "angles",      name: "Creative Angle Maker" },
      { slug: "ugc",         name: "UGC Script Lab" },
      { slug: "landingcopy", name: "Landing Copy Refiner" }
    ],
    goal: "Pack publicitaire: 10 angles + scripts UGC + copy de landing."
  }
];

const MANAGER_SYSTEM = `Tu es un Manager qui planifie le travail de 3 bots spécialisés.
Rédige un BRIEF concis en Markdown avec: Contexte, Audience, Promesse, Contraintes, Livrables, Critères qualité (0-5), Checklist finale.`;

const BOT_SYSTEM = (role) => `Tu es "${role}". Suis le brief et rends un livrable exploitable en Markdown (sections claires, concret, pas de blabla).`;

const QA_SYSTEM = `Contrôleur qualité: note 0-5 chaque critère, propose corrections, et fournis une version révisée finale du livrable.`;

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

function cleanupOldTeamFiles(teamSlug) {
  if (!fs.existsSync(OUT_DIR)) return;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith(".md") && f.includes(`-team-${teamSlug}-`) && !f.startsWith(`${DATE}-`)) {
      fs.unlinkSync(path.join(OUT_DIR, f));
      console.log("Removed old", f);
    }
  }
}

function setPermalink(file, newPermalink) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  const m = /^---\n([\s\S]*?)\n---/m.exec(raw);
  if (!m) return;
  const fm = m[1];
  const body = raw.slice(m[0].length);
  const cleaned = String(newPermalink).replace(/["']/g, "").replace(/\/+$/,"/"); // normalise
  const fm2 = /^\s*permalink:/m.test(fm)
    ? fm.replace(/^\s*permalink:.*$/m, `permalink: ${cleaned}`)
    : `permalink: ${cleaned}\n` + fm;
  fs.writeFileSync(file, `---\n${fm2}\n---${body}`);
}

function fixQaFiles(team) {
  const qaFile       = path.join(OUT_DIR, `${DATE}-team-${team.slug}-qa.md`);
  const qaReportFile = path.join(OUT_DIR, `${DATE}-team-${team.slug}-qa-report.md`);
  if (fs.existsSync(qaFile))       setPermalink(qaFile,       `/publications/equipes/${team.slug}/qa/`);
  if (fs.existsSync(qaReportFile)) setPermalink(qaReportFile, `/publications/equipes/${team.slug}/qa-report/`);
}

// ========== PIPELINE PAR EQUIPE ==========
async function runTeam(team) {
  cleanupOldTeamFiles(team.slug);

  // 1) Brief
  const brief = await chat({
    system: MANAGER_SYSTEM,
    user: `Domaine: ${team.slug}\nObjectif: ${team.goal}\nRends un BRIEF utile et mesurable pour guider 3 bots.`
  });

  // 2) Bots
  const outputs = {};
  for (const b of team.bots) {
    outputs[b.slug] = await chat({
      system: BOT_SYSTEM(b.name),
      user: `BRIEF:\n${brief}\n\nRéalise ta partie uniquement.`
    });
  }

  // 3) QA sur le livrable principal (premier bot)
  const mainKey = team.bots[0].slug;
  const qa = await chat({
    system: QA_SYSTEM,
    user: `BRIEF:\n${brief}\n\nLivrable à évaluer:\n${outputs[mainKey]}`
  });

  // 4) Pages
  const payPack = PAY[team.slug]?.pack || "";
  const ctaPack = payPack ? `\n<p><a class="btn" href="${payPack}" target="_blank" rel="noopener">Commander le PACK — 79€</a></p>\n` : "";

  const managerMd =
    fmTeam({ title: team.manager, slug: team.slug }) +
    `## Brief du manager\n\n${brief}\n\n` +
    `## Livrables\n` +
    team.bots
      .map(b => `- [${b.name}]({{ '/publications/equipes/${team.slug}/${b.slug}/' | url }})`)
      .join("\n") +
    `\n` + ctaPack +
    `\n> ⚙️ Ajoute/édite les liens dans src/_data/payments.json\n`;
  writeFile(`${DATE}-team-${team.slug}-manager.md`, managerMd);

  for (const b of team.bots) {
    const payBot = PAY[team.slug]?.[b.slug] || "";
    const ctaBot = payBot ? `\n<p><a class="btn" href="${payBot}" target="_blank" rel="noopener">Commander ce livrable</a></p>\n` : "";
    const botMd =
      fmChild({ title: `${b.name} — ${team.manager}`, teamSlug: team.slug, childSlug: b.slug }) +
      outputs[b.slug] +
      ctaBot;
    writeFile(`${DATE}-team-${team.slug}-${b.slug}.md`, botMd);
  }

  // Rapport QA
  const qaMd =
    fmChild({ title: `QA — ${team.manager}`, teamSlug: team.slug, childSlug: "qa-report" }) + qa;
  writeFile(`${DATE}-team-${team.slug}-qa-report.md`, qaMd);

  // Auto-fix permalinks QA / QA-report
  fixQaFiles(team);

  // Prune des fichiers inattendus du jour
  const allowed = new Set(["manager", ...team.bots.map(b => b.slug), "qa-report"]);
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.startsWith(`${DATE}-`) && f.endsWith(".md") && f.includes(`-team-${team.slug}-`)) {
      const slugPart = f.split(`-team-${team.slug}-`)[1].replace(/\.md$/,'');
      if (!allowed.has(slugPart)) {
        fs.unlinkSync(path.join(OUT_DIR, f));
        console.log("Pruned stray", f);
      }
    }
  }
}

// ========== MAIN ==========
async function main() {
  for (const t of TEAMS) {
    console.log("▶ Team:", t.slug);
    await runTeam(t);
  }
  console.log("OK - équipes générées");
}
main().catch(e => { console.error(e); process.exit(1); });
