import fs from "node:fs";
import path from "node:path";
import { chat } from "./llm.mjs";

// ==== DATE & SORTIE ====
const DATE = new Date().toISOString().slice(0,10);
const OUT_DIR = path.join("src", "posts");

// ==== CONFIG DES ÉQUIPES ====
const TEAMS = [
  { slug: "seo", manager: "Manager SEO",
    bots: [
      {slug:"researcher",name:"Keyword Researcher"},
      {slug:"onpage",name:"On-Page Optimizer"},
      {slug:"qa",name:"Quality Assessor"}
    ],
    goal: "Sortir un plan SEO monétisable pour une niche précise avec une page 'offre' prête à vendre."
  },
  { slug: "ecommerce", manager: "Manager E-commerce",
    bots: [
      {slug:"pdp",name:"Product Page Writer"},
      {slug:"adangles",name:"Ads Angle Maker"},
      {slug:"email",name:"Abandoned Cart Emailer"}
    ],
    goal: "Créer une fiche produit + angles pubs + 3 emails panier abandonné pour une boutique vendable comme pack."
  },
  { slug: "social", manager: "Manager Réseaux sociaux",
    bots: [
      {slug:"hooks",name:"Hook Factory"},
      {slug:"carousel",name:"Carousel Writer"},
      {slug:"qa",name:"Quality Assessor"}
    ],
    goal: "Produire un pack Social (20 hooks, un carrousel 10 slides) prêt à vendre."
  },
  { slug: "local", manager: "Manager Local",
    bots: [
      {slug:"gmb",name:"GMB Poster"},
      {slug:"review",name:"Review Reply Pro"},
      {slug:"localfix",name:"Local SEO Fixer"}
    ],
    goal: "Pack local business: 1 post Google Business, 10 réponses aux avis et checklist d’optimisations."
  },
  { slug: "content", manager: "Manager Contenu",
    bots: [
      {slug:"outline",name:"Blog Outliner"},
      {slug:"writer",name:"Article Writer"},
      {slug:"qa",name:"Quality Assessor"}
    ],
    goal: "Plan + article 1000 mots + QA, vendable comme livrable clé-en-main."
  },

  // nouvelles niches
  { slug: "ads", manager: "Manager Ads & Créa",
    bots: [
      {slug:"angles",name:"Creative Angle Maker"},
      {slug:"ugc",name:"UGC Script Lab"},
      {slug:"landingcopy",name:"Landing Copy Refiner"}
    ],
    goal: "Pack publicitaire: 10 angles + scripts UGC + copy de landing."
  },
  { slug: "emailcrm", manager: "Manager Email & CRM",
    bots: [
      {slug:"onboarding",name:"Onboarding Sequence"},
      {slug:"newsletter",name:"Newsletter Builder"},
      {slug:"reactivation",name:"Reactivation Flow"}
    ],
    goal: "Séquences d’emails (onboarding, newsletter, réactivation) prêtes à envoyer."
  },
  { slug: "immobilier", manager: "Manager Immobilier",
    bots: [
      {slug:"annonce",name:"Annonce Immo Writer"},
      {slug:"visite",name:"Script Visite"},
      {slug:"estimation",name:"Guide Estimation"}
    ],
    goal: "Pack agence: annonces, script de visite, guide estimation."
  },
  { slug: "saas", manager: "Manager SaaS",
    bots: [
      {slug:"onboardingdocs",name:"Onboarding Docs"},
      {slug:"releasenotes",name:"Release Notes Writer"},
      {slug:"faq",name:"FAQ Writer"}
    ],
    goal: "Pack SaaS: docs d’onboarding, notes de version, FAQ."
  },
  { slug: "freelance", manager: "Manager Freelance",
    bots: [
      {slug:"proposal",name:"Proposal Writer"},
      {slug:"portfolio",name:"Portfolio Polisher"},
      {slug:"pricing",name:"Pricing Packager"}
    ],
    goal: "Proposition, portfolio et packs tarifaires pour signer plus."
  },
  { slug: "tiktokshop", manager: "Manager TikTok Shop",
    bots: [
      {slug:"productresearch",name:"Product Research"},
      {slug:"videoscript",name:"Video Script UGC"},
      {slug:"offerbuilder",name:"Offer Builder"}
    ],
    goal: "Recherche produit + scripts vidéo + offre bundle."
  },
  { slug: "education", manager: "Manager Éducation",
    bots: [
      {slug:"revisionplan",name:"Plan de révision"},
      {slug:"quiz",name:"Quiz Maker"},
      {slug:"notes",name:"Study Notes"}
    ],
    goal: "Pack révision: plan semaine, quiz, fiches."
  },
  { slug: "restaurant", manager: "Manager Restaurant",
    bots: [
      {slug:"menu",name:"Menu Optimizer"},
      {slug:"gbppost",name:"GBP Post Weekly"},
      {slug:"reply",name:"Review Reply Pro"}
    ],
    goal: "Menu optimisé + post Google Business + réponses aux avis."
  },
  { slug: "branding", manager: "Manager Personal Branding",
    bots: [
      {slug:"bio",name:"Bio & Headline"},
      {slug:"about",name:"About Page"},
      {slug:"case",name:"Case Study Writer"}
    ],
    goal: "Pack personal branding: bio, à-propos, étude de cas."
  },
  { slug: "events", manager: "Manager Événementiel",
    bots: [
      {slug:"landing",name:"Event Landing"},
      {slug:"emails",name:"Email Invitations"},
      {slug:"sponsor",name:"Sponsor Kit"}
    ],
    goal: "Landing d’événement, emails d’invitation, kit sponsor."
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

// ==== PROMPTS ====
const MANAGER_SYSTEM = `Tu es un Manager qui planifie le travail de 3 bots spécialisés.
Rédige un BRIEF concis en Markdown avec: Contexte, Audience, Promesse, Contraintes, Livrables, Critères qualité (0-5), Checklist finale.`;

const BOT_SYSTEM = (role) => `Tu es "${role}". Suis le brief et rends un livrable exploitable en Markdown (sections claires, concret, pas de blabla).`;

const QA_SYSTEM = `Contrôleur qualité: note 0-5 chaque critère, propose corrections, et fournis une version révisée finale du livrable.`;

// ==== HELPERS ====
function writeFile(rel, content) {
  const f = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  return f;
}

function readFileSafe(file) {
  try { return fs.readFileSync(file, "utf8"); } catch { return null; }
}

// Front-matter
const fmTeam = ({title, slug}) =>
  `---\ntitle: "${title}"\ndate: "${DATE}"\ntags: ["post","team-manager"]\nlayout: layouts/post.njk\npermalink: "/publications/equipes/${slug}/"\n---\n`;

const fmChild = ({title, teamSlug, childSlug}) =>
  `---\ntitle: "${title}"\ndate: "${DATE}"\ntags: ["post","team-bot"]\nlayout: layouts/post.njk\npermalink: "/publications/equipes/${teamSlug}/${childSlug}/"\n---\n`;

// Supprimer anciens fichiers d'équipe (évite conflits)
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

// Corriger/éliminer les fichiers QA problématiques
function fixQaFiles(team) {
  const hasQaBot = team.bots.some(b => b.slug === "qa");
  const qaFile = path.join(OUT_DIR, `${DATE}-team-${team.slug}-qa.md`);
  const qaReportFile = path.join(OUT_DIR, `${DATE}-team-${team.slug}-qa-report.md`);

  // Si l'équipe n'a PAS de bot "qa" → supprimer un éventuel -qa.md d'un ancien script
  if (!hasQaBot && fs.existsSync(qaFile)) {
    fs.unlinkSync(qaFile);
    console.log("Pruned stray", path.basename(qaFile));
  }

  // Si l'équipe a un bot "qa" → s'assurer que son permalink est bien /.../qa/
  if (hasQaBot && fs.existsSync(qaFile)) {
    const txt = readFileSafe(qaFile);
    if (txt && /permalink:\s*\/publications\/equipes\/[^/]+\/qa-report\//.test(txt)) {
      const fixed = txt.replace(/permalink:\s*\/publications\/equipes\/([^/]+)\/qa-report\//,
                                "permalink: /publications/equipes/$1/qa/");
      fs.writeFileSync(qaFile, fixed);
      console.log("Fixed QA permalink in", path.basename(qaFile));
    }
  }

  // S'assurer que qa-report a bien /qa-report/
  if (fs.existsSync(qaReportFile)) {
    const txt = readFileSafe(qaReportFile);
    if (txt && !/permalink:\s*\/publications\/equipes\/[^/]+\/qa-report\//.test(txt)) {
      const fixed = txt.replace(/permalink:\s*\/publications\/equipes\/([^/]+)\/qa\//,
                                "permalink: /publications/equipes/$1/qa-report/");
      fs.writeFileSync(qaReportFile, fixed);
      console.log("Fixed QA-REPORT permalink in", path.basename(qaReportFile));
    }
  }
}

// ==== PIPELINE PAR ÉQUIPE ====
async function runTeam(team) {
  cleanupOldTeamFiles(team.slug);

  // 1) Brief du manager
  const brief = await chat({
    system: MANAGER_SYSTEM,
    user: `Domaine: ${team.slug}\nObjectif: ${team.goal}\nRends un BRIEF utile et mesurable pour guider 3 bots.`
  });

  // 2) Livrables des bots
  const outputs = {};
  for (const b of team.bots) {
    outputs[b.slug] = await chat({
      system: BOT_SYSTEM(b.name),
      user: `BRIEF:\n${brief}\n\nRéalise ta partie uniquement.`
    });
  }

  // 3) QA (contrôle) sur le livrable principal (premier bot)
  const mainKey = team.bots[0].slug;
  const qa = await chat({
    system: QA_SYSTEM,
    user: `BRIEF:\n${brief}\n\nLivrable à évaluer:\n${outputs[mainKey]}`
  });

  // 4) Écriture des pages
  const managerMd =
    fmTeam({ title: team.manager, slug: team.slug }) +
    `## Brief du manager\n\n${brief}\n\n` +
    `## Livrables\n` +
    team.bots
      .map(b => `- [${b.name}]({{ '/publications/equipes/${team.slug}/${b.slug}/' | url }})`)
      .join("\n") +
    `\n\n> ⚙️ Ajoute ici ton lien de paiement pour commander le pack.\n`;
  writeFile(`${DATE}-team-${team.slug}-manager.md`, managerMd);

  for (const b of team.bots) {
    const botMd =
      fmChild({ title: `${b.name} — ${team.manager}`, teamSlug: team.slug, childSlug: b.slug }) +
      outputs[b.slug] +
      `\n\n> ⚙️ Ajoute ici le lien de paiement de ce sous-produit.\n`;
    writeFile(`${DATE}-team-${team.slug}-${b.slug}.md`, botMd);
  }

  // Rapport QA dans un FICHIER distinct avec slug qa-report
  const qaMd =
    fmChild({ title: `QA — ${team.manager}`, teamSlug: team.slug, childSlug: "qa-report" }) + qa;
  writeFile(`${DATE}-team-${team.slug}-qa-report.md`, qaMd);

  // Auto-réparation des fichiers QA si un ancien script a laissé des conflits
  fixQaFiles(team);

  // Prune des fichiers inattendus (aujourd'hui) pour éviter les doublons à la source
  const allowed = new Set(["manager", ...team.bots.map(b => b.slug), "qa-report"]);
  const files = fs.readdirSync(OUT_DIR);
  for (const f of files) {
    if (f.includes(`-team-${team.slug}-`) && f.endsWith(".md") && f.startsWith(`${DATE}-`)) {
      const slugPart = f.split(`-team-${team.slug}-`)[1].replace(/\.md$/,'');
      if (!allowed.has(slugPart)) {
        fs.unlinkSync(path.join(OUT_DIR, f));
        console.log("Pruned stray", f);
      }
    }
  }
}

// ==== MAIN ====
async function main() {
  for (const t of TEAMS) {
    console.log("▶ Team:", t.slug);
    await runTeam(t);
  }
  console.log("OK - équipes générées");
}

main().catch(e => { console.error(e); process.exit(1); });
