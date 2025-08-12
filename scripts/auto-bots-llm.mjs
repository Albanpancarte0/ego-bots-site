import fs from "node:fs";
import path from "node:path";
import { chat } from "./llm.mjs";

const DATE = new Date().toISOString().slice(0,10);
const OUT_DIR = path.join("src", "posts");

const TEAMS = [
  { slug: "seo", manager: "Manager SEO", bots: [
    {slug:"researcher",name:"Keyword Researcher"},
    {slug:"onpage",name:"On-Page Optimizer"},
    {slug:"qa",name:"Quality Assessor"} ],
    goal: "Sortir un plan SEO monétisable pour une niche précise avec une page 'offre' prête à vendre."
  },
  { slug: "ads", manager: "Manager Ads & Créa", bots: [
    {slug:"angles",name:"Creative Angle Maker"},
    {slug:"ugc",name:"UGC Script Lab"},
    {slug:"landingcopy",name:"Landing Copy Refiner"} ],
    goal: "Pack publicitaire: 10 angles + scripts UGC + copy de landing."
  },
  // … (garde tes autres équipes ici)
];

const MANAGER_SYSTEM = `Tu es un Manager qui planifie le travail de 3 bots spécialisés.
Rédige un BRIEF concis en Markdown avec: Contexte, Audience, Promesse, Contraintes, Livrables, Critères qualité (0-5), Checklist finale.`;

const BOT_SYSTEM = (role) => `Tu es "${role}". Suis le brief et rends un livrable exploitable en Markdown (sections claires, concret, pas de blabla).`;

const QA_SYSTEM = `Contrôleur qualité: note 0-5 chaque critère, propose corrections, et fournis une version révisée finale du livrable.`;

function writeFile(rel, content) {
  const f = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  return f;
}
function readFileSafe(file) { try { return fs.readFileSync(file, "utf8"); } catch { return null; } }

const fmTeam = ({title, slug}) =>
  `---\ntitle: "${title}"\ndate: "${DATE}"\ntags: ["post","team-manager"]\nlayout: layouts/post.njk\npermalink: "/publications/equipes/${slug}/"\n---\n`;

const fmChild = ({title, teamSlug, childSlug}) =>
  `---\ntitle: "${title}"\ndate: "${DATE}"\ntags: ["post","team-bot"]\nlayout: layouts/post.njk\npermalink: "/publications/equipes/${teamSlug}/${childSlug}/"\n---\n`;

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
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith(".md") && f.includes(`-team-${team.slug}-`));
  for (const f of files) {
    const fp = path.join(OUT_DIR, f);
    let txt = readFileSafe(fp);
    if (!txt) continue;

    if (/-qa\.md$/.test(f) && /permalink:\s*['"]?\/publications\/equipes\/[^/]+\/qa-report\/?['"]?/i.test(txt)) {
      txt = txt.replace(/permalink:\s*['"]?\/publications\/equipes\/([^/]+)\/qa-report\/?['"]?/i,
                        'permalink: /publications/equipes/$1/qa/');
      fs.writeFileSync(fp, txt);
      console.log("Fixed QA permalink in", f);
    }
    if (/-qa-report\.md$/.test(f) && /permalink:\s*['"]?\/publications\/equipes\/[^/]+\/qa\/?['"]?/i.test(txt)) {
      txt = txt.replace(/permalink:\s*['"]?\/publications\/equipes\/([^/]+)\/qa\/?['"]?/i,
                        'permalink: /publications/equipes/$1/qa-report/');
      fs.writeFileSync(fp, txt);
      console.log("Fixed QA-REPORT permalink in", f);
    }
  }
}

async function runTeam(team) {
  cleanupOldTeamFiles(team.slug);

  const brief = await chat({
    system: MANAGER_SYSTEM,
    user: `Domaine: ${team.slug}\nObjectif: ${team.goal}\nRends un BRIEF utile et mesurable pour guider 3 bots.`
  });

  const outputs = {};
  for (const b of team.bots) {
    outputs[b.slug] = await chat({
      system: BOT_SYSTEM(b.name),
      user: `BRIEF:\n${brief}\n\nRéalise ta partie uniquement.`
    });
  }

  const mainKey = team.bots[0].slug;
  const qa = await chat({
    system: QA_SYSTEM,
    user: `BRIEF:\n${brief}\n\nLivrable à évaluer:\n${outputs[mainKey]}`
  });

  const managerMd =
    fmTeam({ title: team.manager, slug: team.slug }) +
    `## Brief du manager\n\n${brief}\n\n` +
    `## Livrables\n` +
    team.bots.map(b => `- [${b.name}]({{ '/publications/equipes/${team.slug}/${b.slug}/' | url }})`).join("\n") +
    `\n\n> ⚙️ Ajoute ici ton lien de paiement pour commander le pack.\n`;
  writeFile(`${DATE}-team-${team.slug}-manager.md`, managerMd);

  for (const b of team.bots) {
    const botMd = fmChild({ title: `${b.name} — ${team.manager}`, teamSlug: team.slug, childSlug: b.slug })
      + outputs[b.slug] + `\n\n> ⚙️ Ajoute ici le lien de paiement de ce sous-produit.\n`;
    writeFile(`${DATE}-team-${team.slug}-${b.slug}.md`, botMd);
  }

  const qaMd = fmChild({ title: `QA — ${team.manager}`, teamSlug: team.slug, childSlug: "qa-report" }) + qa;
  writeFile(`${DATE}-team-${team.slug}-qa-report.md`, qaMd);

  // Auto-fix + prune dans la même exécution
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

async function main() {
  for (const t of TEAMS) {
    console.log("▶ Team:", t.slug);
    await runTeam(t);
  }
  console.log("OK - équipes générées");
}
main().catch(e => { console.error(e); process.exit(1); });
