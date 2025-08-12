import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chat } from "./llm.mjs";

// Résout le chemin du JSON de paiements
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const paymentsPath = path.join(__dirname, "..", "src", "_data", "payments.json");

// Charge paiements (Gumroad/Stripe): { [teamSlug]: { pack, botSlug1, ... } }
let PAY = {};
try { PAY = JSON.parse(fs.readFileSync(paymentsPath, "utf8")); }
catch { console.warn("payments.json introuvable/invalide → {}"); PAY = {}; }

// Date du jour (horodatée par build) + dossier de sortie
const DATE = new Date().toISOString().slice(0,10);
const OUT_DIR = path.join("src", "posts");

// === LISTE D'ÉQUIPES (tu peux en ajouter/retirer) ===
const TEAMS = [
  { slug: "seo", manager: "Manager SEO",
    bots: [
      {slug:"researcher",name:"Keyword Researcher"},
      {slug:"onpage",name:"On-Page Optimizer"},
      {slug:"qa",name:"Quality Assessor"}
    ],
    goal: "Sortir un plan SEO monétisable pour une niche avec une page 'offre' prête à vendre."
  },
  { slug: "ecommerce", manager: "Manager E-commerce",
    bots: [
      {slug:"pdp",name:"Product Page Writer"},
      {slug:"adangles",name:"Ads Angle Maker"},
      {slug:"email",name:"Abandoned Cart Emailer"}
    ],
    goal: "Fiche produit + angles pubs + 3 emails panier abandonné."
  },
  { slug: "social", manager: "Manager Réseaux sociaux",
    bots: [
      {slug:"hooks",name:"Hook Factory"},
      {slug:"carousel",name:"Carousel Writer"},
      {slug:"qa",name:"Quality Assessor"}
    ],
    goal: "Pack Social (20 hooks, un carrousel 10 slides)."
  },
  { slug: "local", manager: "Manager Local",
    bots: [
      {slug:"gmb",name:"GMB Poster"},
      {slug:"review",name:"Review Reply Pro"},
      {slug:"localfix",name:"Local SEO Fixer"}
    ],
    goal: "1 post GBP, 10 réponses aux avis, checklist d’optimisations."
  },
  { slug: "content", manager: "Manager Contenu",
    bots: [
      {slug:"outline",name:"Blog Outliner"},
      {slug:"writer",name:"Article Writer"},
      {slug:"qa",name:"Quality Assessor"}
    ],
    goal: "Plan + article 1000 mots + QA."
  },
  { slug: "ads", manager: "Manager Ads & Créa",
    bots: [
      {slug:"angles",name:"Creative Angle Maker"},
      {slug:"ugc",name:"UGC Script Lab"},
      {slug:"landingcopy",name:"Landing Copy Refiner"}
    ],
    goal: "10 angles + scripts UGC + copy de landing."
  },
  { slug: "emailcrm", manager: "Manager Email & CRM",
    bots: [
      {slug:"onboarding",name:"Onboarding Sequence"},
      {slug:"newsletter",name:"Newsletter Builder"},
      {slug:"reactivation",name:"Reactivation Flow"}
    ],
    goal: "Séquences onboarding, newsletter, réactivation."
  },
  { slug: "immobilier", manager: "Manager Immobilier",
    bots: [
      {slug:"annonce",name:"Annonce Immo Writer"},
      {slug:"visite",name:"Script Visite"},
      {slug:"estimation",name:"Guide Estimation"}
    ],
    goal: "Annonce, script de visite, guide estimation."
  },
  { slug: "saas", manager: "Manager SaaS",
    bots: [
      {slug:"onboardingdocs",name:"Onboarding Docs"},
      {slug:"releasenotes",name:"Release Notes Writer"},
      {slug:"faq",name:"FAQ Writer"}
    ],
    goal: "Docs d’onboarding, notes de version, FAQ."
  },
  { slug: "freelance", manager: "Manager Freelance",
    bots: [
      {slug:"proposal",name:"Proposal Writer"},
      {slug:"portfolio",name:"Portfolio Polisher"},
      {slug:"pricing",name:"Pricing Packager"}
    ],
    goal: "Proposition, portfolio, packs tarifaires."
  },
  { slug: "tiktokshop", manager: "Manager TikTok Shop",
    bots: [
      {slug:"productresearch",name:"Product Research"},
      {slug:"videoscript",name:"Video Script UGC"},
      {slug:"offerbuilder",name:"Offer Builder"}
    ],
    goal: "Recherche produit, scripts vidéo, offre bundle."
  },
  { slug: "education", manager: "Manager Éducation",
    bots: [
      {slug:"revisionplan",name:"Plan de révision"},
      {slug:"quiz",name:"Quiz Maker"},
      {slug:"notes",name:"Study Notes"}
    ],
    goal: "Plan semaine, quiz, fiches."
  },
  { slug: "restaurant", manager: "Manager Restaurant",
    bots: [
      {slug:"menu",name:"Menu Optimizer"},
      {slug:"gbppost",name:"GBP Post Weekly"},
      {slug:"reply",name:"Review Reply Pro"}
    ],
    goal: "Menu optimisé, post GBP, réponses aux avis."
  },
  { slug: "branding", manager: "Manager Personal Branding",
    bots: [
      {slug:"bio",name:"Bio & Headline"},
      {slug:"about",name:"About Page"},
      {slug:"case",name:"Case Study Writer"}
    ],
    goal: "Bio, à-propos, étude de cas."
  },
  { slug: "events", manager: "Manager Événementiel",
    bots: [
      {slug:"landing",name:"Event Landing"},
      {slug:"emails",name:"Email Invitations"},
      {slug:"sponsor",name:"Sponsor Kit"}
    ],
    goal: "Landing, emails d’invitation, kit sponsor."
  },
  { slug: "podcast", manager: "Manager Podcast/Video",
    bots: [
      {slug:"outline",name:"Episode Outline"},
      {slug:"shownotes",name:"Show Notes"},
      {slug:"cliptitles",name:"Clip Titles"}
    ],
    goal: "Plan d’épisode, show notes, titres pour clips."
  }
];

// Permet de cibler certaines équipes: TEAMS="seo,ads"
const pick = (process.env.TEAMS || "").split(",").map(s => s.trim()).filter(Boolean);
const TEAMS_SELECTED = pick.length ? TEAMS.filter(t => pick.includes(t.slug)) : TEAMS;

// === PROMPTS ===
const MANAGER_SYSTEM = `Tu es un Manager qui planifie le travail de 3 bots spécialisés.
Rédige un BRIEF concis en Markdown avec: Contexte, Audience, Promesse, Contraintes, Livrables, Critères qualité (0-5), Checklist finale.`;

const BOT_SYSTEM = (role) => `Tu es "${role}". Suis le brief et rends un livrable exploitable en Markdown (sections claires, concret, pas de blabla).`;

const QA_SYSTEM = `Contrôleur qualité: note 0-5 chaque critère, propose corrections, et fournis une version révisée finale du livrable.`;

// === HELPERS ===
function writeFile(rel, content) {
  const f = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  return f;
}
function setPermalink(file, newPermalink) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  const m = /^---\n([\s\S]*?)\n---/m.exec(raw);
  if (!m) return;
  const fm = m[1];
  const body = raw.slice(m[0].length);
  const cleaned = String(newPermalink).replace(/["']/g, "").replace(/\/+$/,"/");
  const fm2 = /^\s*permalink:/m.test(fm)
    ? fm.replace(/^\s*permalink:.*$/m, `permalink: ${cleaned}`)
    : `permalink: ${cleaned}\n` + fm;
  fs.writeFileSync(file, `---\n${fm2}\n---${body}`);
}
function cleanupOldTeamFiles(teamSlug) {
  if (!fs.existsSync(OUT_DIR)) return;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith(".md") && f.includes(`-team-${teamSlug}-`) && !f.startsWith(`${DATE}-`)) {
      fs.unlinkSync(path.join(OUT_DIR, f));
      console.log("Removed old", f);
    }
  }
}
function fixQaFiles(team) {
  const qaFile       = path.join(OUT_DIR, `${DATE}-team-${team.slug}-qa.md`);
  const qaReportFile = path.join(OUT_DIR, `${DATE}-team-${team.slug}-qa-report.md`);
  if (fs.existsSync(qaFile))       setPermalink(qaFile,       `/publications/equipes/${team.slug}/qa/`);
  if (fs.existsSync(qaReportFile)) setPermalink(qaReportFile, `/publications/equipes/${team.slug}/qa-report/`);
}

// === PIPELINE ===
async function runTeam(team) {
  cleanupOldTeamFiles(team.slug);

  // 1) Brief manager
  const brief = await chat({
    system: MANAGER_SYSTEM,
    user: `Domaine: ${team.slug}\nObjectif: ${team.goal}\nRends un BRIEF utile et mesurable pour guider 3 bots.`
  });

  // 2) Bots (3 livrables)
  const outputs = {};
  for (const b of team.bots) {
    outputs[b.slug] = await chat({
      system: BOT_SYSTEM(b.name),
      user: `BRIEF:\n${brief}\n\nRéalise ta partie uniquement.`
    });
  }

  // 3) QA sur le livrable principal (1er bot)
  const mainKey = team.bots[0].slug;
  const qa = await chat({
    system: QA_SYSTEM,
    user: `BRIEF:\n${brief}\n\nLivrable à évaluer:\n${outputs[mainKey]}`
  });

  // 4) Écriture des pages (CTA si payments.json renseigne)
  const payPack = PAY[team.slug]?.pack || "";
  const ctaPack = payPack ? `\n<p><a class="btn" href="${payPack}" target="_blank" rel="noopener">Commander le PACK — 79€</a></p>\n` : "";

  const managerMd =
    `---
title: "${team.manager}"
date: "${DATE}"
tags: ["post","team-manager"]
layout: layouts/post.njk
permalink: "/publications/equipes/${team.slug}/"
---
## Brief du manager

${brief}

## Livrables
${team.bots.map(b => `- [${b.name}]({{ '/publications/equipes/${team.slug}/${b.slug}/' | url }})`).join("\n")}
${ctaPack}
> ⚙️ Édite les liens dans src/_data/payments.json
`;
  writeFile(`${DATE}-team-${team.slug}-manager.md`, managerMd);

  for (const b of team.bots) {
    const payBot = PAY[team.slug]?.[b.slug] || "";
    const ctaBot = payBot ? `\n<p><a class="btn" href="${payBot}" target="_blank" rel="noopener">Commander ce livrable</a></p>\n` : "";
    const botMd =
`---
title: "${b.name} — ${team.manager}"
date: "${DATE}"
tags: ["post","team-bot"]
layout: layouts/post.njk
permalink: "/publications/equipes/${team.slug}/${b.slug}/"
---
${outputs[b.slug]}
${ctaBot}`;
    writeFile(`${DATE}-team-${team.slug}-${b.slug}.md`, botMd);
  }

  const qaMd =
`---
title: "QA — ${team.manager}"
date: "${DATE}"
tags: ["post","team-bot"]
layout: layouts/post.njk
permalink: "/publications/equipes/${team.slug}/qa-report/"
---
${qa}
`;
  writeFile(`${DATE}-team-${team.slug}-qa-report.md`, qaMd);

  // Auto-fix permalinks + prune du jour
  fixQaFiles(team);
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

// === MAIN ===
async function main() {
  for (const t of TEAMS_SELECTED) {
    console.log("▶ Team:", t.slug);
    await runTeam(t);
  }
  console.log("OK - équipes générées");
}
main().catch(e => { console.error(e); process.exit(1); });
