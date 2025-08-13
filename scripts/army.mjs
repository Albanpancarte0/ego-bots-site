import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chat } from "./llm.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const OUT_DIR = path.join(__dirname, "..", "sortie");
const DATE = new Date().toISOString().slice(0,10);

// --- charge la liste centralisée des domaines ---
const domainsPath = path.join(__dirname, "..", "src", "_data", "domains.json");
let TEAMS_MAP = {};
try {
  TEAMS_MAP = JSON.parse(fs.readFileSync(domainsPath, "utf8")); // objet {slug: {...}}
} catch (e) {
  console.error("domains.json invalide ou manquant:", e.message);
  process.exit(1);
}
function getTeam(slug) { return TEAMS_MAP[slug]; }

// Sélection des domaines via env: ARMY="ads,shortvideo,seo"
const pick = (process.env.ARMY || "").split(",").map(s => s.trim()).filter(Boolean);
const DOMAINS = pick.length ? pick : Object.keys(TEAMS_MAP);

// Brief global facultatif
const GLOBAL_BRIEF = process.env.BRIEF || "";
// Webhook optionnel
const WEBHOOK = process.env.ARMY_WEBHOOK_URL || "";

// ========= Prompts =========
const MANAGER_SYSTEM = `Tu es un manager qui planifie le travail d'une mini-équipe spécialisée.
Rédige un BRIEF concis (Markdown) avec: Contexte, Audience, Promesse, Contraintes, Livrables attendus, Critères qualité (0–5), Checklist finale.`;
const BOT_SYSTEM = (role) => `Tu es "${role}". Suis le brief et rends un livrable exploitable en Markdown (sections claires, concret).`;
const QA_SYSTEM = `Contrôleur qualité: note 0-5 chaque critère du brief, propose corrections concrètes, puis fournis une version révisée prête à livrer.`;

// ========= Helpers =========
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeText(file, content){ ensureDir(path.dirname(file)); fs.writeFileSync(file, content); }
function writeJSON(file, obj){ ensureDir(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }
function cleanOut(domain){
  const dir = path.join(OUT_DIR, domain, DATE);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive:true, force:true });
  ensureDir(dir);
}

async function runDomain(slug){
  const team = getTeam(slug);
  if(!team) return { slug, error: "Domaine inconnu" };

  cleanOut(slug);

  // 1) brief manager
  const briefUser =
`Domaine: ${slug}
Objectif: ${team.goal}
${GLOBAL_BRIEF ? `Contrainte utilisateur: ${GLOBAL_BRIEF}` : ""}

Rends un BRIEF utile et mesurable pour guider 3 bots.`;
  const brief = await chat({ system: MANAGER_SYSTEM, user: briefUser });

  // 2) bots
  const outputs = {};
  for(const b of team.bots){
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

  // 4) sauvegardes
  const baseDir = path.join(OUT_DIR, slug, DATE);
  writeText(path.join(baseDir, `brief.md`), brief);
  for(const b of team.bots){ writeText(path.join(baseDir, `${b.slug}.md`), outputs[b.slug]); }
  writeText(path.join(baseDir, `qa-report.md`), qa);

  // 5) export JSON (pour webhook)
  const payload = { date: DATE, domain: slug, title: team.manager, goal: team.goal, brief, outputs, qa };
  writeJSON(path.join(baseDir, `export.json`), payload);

  // 6) webhook (optionnel)
  if (WEBHOOK){
    try{
      const res = await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });
      console.log(slug, "webhook:", res.status);
    }catch(e){ console.warn(slug, "webhook error:", e.message); }
  }

  return { slug, ok: true, dir: baseDir };
}

async function main(){
  const results = [];
  for(const slug of DOMAINS){
    console.log("▶ Run domain:", slug);
    results.push(await runDomain(slug));
  }
  writeJSON(path.join(OUT_DIR, `last-run.json`), { at: new Date().toISOString(), results });
  console.log("OK - armée produite");
}
main().catch(e => { console.error(e); process.exit(1); });
