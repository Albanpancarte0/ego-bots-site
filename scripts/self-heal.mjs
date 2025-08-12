import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join("src", "posts");

function fixPermalinkLine(s) {
  // enlève quotes foireuses et double-slashes, force trailing slash
  const cleaned = String(s).replace(/["']/g, "").replace(/\/+$/,"/").replace(/\/{2,}/g,"/");
  return cleaned.endsWith("/") ? cleaned : (cleaned + "/");
}

function fixFile(file) {
  const raw = fs.readFileSync(file, "utf8");
  const m = /^---\n([\s\S]*?)\n---([\s\S]*)$/m.exec(raw);
  if (!m) return;
  let fm = m[1], body = m[2];

  // normalise permalink
  const pm = /^\s*permalink:\s*(.*)$/m.exec(fm);
  if (pm) {
    const fixed = fixPermalinkLine(pm[1]);
    fm = fm.replace(/^\s*permalink:.*$/m, `permalink: ${fixed}`);
  }

  // corrige cas connus "-report/\"" etc.
  fm = fm.replace(/qa-report\/-report\/"?/g, "qa-report/");

  // assure le tag team-manager si -manager.md
  if (/team-([a-z0-9-]+)-manager\.md$/i.test(file) && !/team-manager/.test(fm)) {
    const tagsLine = /^\s*tags:\s*\[(.*?)\]\s*$/m;
    if (tagsLine.test(fm)) {
      fm = fm.replace(tagsLine, (all, inside) => `tags: [${inside ? inside + "," : ""}"team-manager"]`);
    } else {
      fm = `tags: ["post","team-manager"]\n` + fm;
    }
  }

  fs.writeFileSync(file, `---\n${fm}\n---${body}`);
}

if (fs.existsSync(OUT_DIR)) {
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith(".md")) {
      try { fixFile(path.join(OUT_DIR, f)); } catch {}
    }
  }
  console.log("Self-heal OK");
} else {
  console.log("No src/posts dir yet");
}
