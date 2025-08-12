import fs from "node:fs";
import path from "node:path";

const POSTS = path.join("src", "posts");

function readFM(txt){ const m=/^---\n([\s\S]*?)\n---/m.exec(txt); return m?{fm:m[1], body:txt.slice(m[0].length)}:null; }

const byPerm = new Map();
for (const f of fs.readdirSync(POSTS)) {
  if (!f.endsWith(".md")) continue;
  const p = path.join(POSTS, f);
  const txt = fs.readFileSync(p, "utf8");
  const m = readFM(txt);
  if (!m) continue;
  const pm = /(^|\n)permalink:\s*['"]?(\S+?)['"]?(\s|$)/.exec(m.fm);
  if (!pm) continue;
  const perm = pm[2];
  if (!byPerm.has(perm)) byPerm.set(perm, []);
  byPerm.get(perm).push(p);
}

// Règle: si 2 fichiers écrivent le même permalink:
// - si l'un finit par -qa-report.md → l'autre qui est un -qa.md doit passer sur /.../qa/
// - sinon, on garde le plus récent et on supprime les autres.
for (const [perm, files] of byPerm.entries()) {
  if (files.length <= 1) continue;

  const hasReport = files.some(f => /-qa-report\.md$/.test(f));
  const hasQa = files.some(f => /-qa\.md$/.test(f));

  if (perm.endsWith("/qa-report/") && hasQa) {
    // retrouve le -qa.md et le bascule en /qa/
    const qaFile = files.find(f => /-qa\.md$/.test(f));
    const txt = fs.readFileSync(qaFile, "utf8");
    const fixed = txt.replace(/permalink:\s*['"]?\/publications\/equipes\/([^/]+)\/qa-report\/?['"]?/i,
                              'permalink: /publications/equipes/$1/qa/');
    fs.writeFileSync(qaFile, fixed);
    console.log("Heal: fixed QA permalink → /qa/ for", path.basename(qaFile));
    continue;
  }

  // Sinon: supprimer les plus anciens
  const sorted = files.sort((a,b)=>fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (let i=1;i<sorted.length;i++){
    fs.unlinkSync(sorted[i]);
    console.log("Heal: removed duplicate permalink file", path.basename(sorted[i]));
  }
}
