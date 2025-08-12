import fs from "node:fs";
import path from "node:path";

const ROOT = ".";
const POSTS = path.join(ROOT, "src", "posts");

function readFrontMatter(file) {
  const txt = fs.readFileSync(file, "utf8");
  const m = /^---\n([\s\S]*?)\n---/m.exec(txt);
  return m ? { fm: m[1], body: txt.slice(m[0].length), raw: txt } : null;
}

function setPermalink(file, newPermalink) {
  const data = readFrontMatter(file);
  if (!data) return false;
  const fm2 = data.fm.replace(/(^|\n)permalink:\s*.*\n/, `$1permalink: ${newPermalink}\n`);
  const out = `---\n${fm2}\n---${data.body}`;
  fs.writeFileSync(file, out);
  console.log("Fixed permalink:", path.basename(file), "→", newPermalink);
  return true;
}

const byPermalink = new Map();
for (const f of fs.readdirSync(POSTS)) {
  if (!f.endsWith(".md")) continue;
  const fp = path.join(POSTS, f);
  const meta = readFrontMatter(fp);
  if (!meta) continue;
  const m = /(^|\n)permalink:\s*(\S+)/.exec(meta.fm);
  if (!m) continue;
  const p = m[2];
  if (!byPermalink.has(p)) byPermalink.set(p, []);
  byPermalink.get(p).push(fp);
}

// Règle simple : si on a à la fois *-qa.md et *-qa-report.md qui pointent vers /qa-report/,
// on remet *-qa.md vers /qa/
for (const [perm, files] of byPermalink.entries()) {
  if (files.length > 1 && perm.endsWith("/qa-report/")) {
    const qaFile = files.find(x => /-qa\.md$/.test(x));
    if (qaFile) {
      const fixed = perm.replace(/qa-report\/$/, "qa/");
      setPermalink(qaFile, fixed);
    }
  }
}
