export async function chat({ system, user, model = process.env.LLM_MODEL || "default" }) {
  const url = process.env.LLM_BASE_URL; // ex: https://.../v1/chat/completions
  const key = process.env.LLM_API_KEY;
  // Fallback pour ne pas faire planter si pas de secrets
  if (!url || !key) {
    return `> ⚠️ IA non configurée (ajoute LLM_BASE_URL & LLM_API_KEY dans Settings → Secrets).\n\n### Brief reçu\n${user}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.5
    })
  });
  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim() || "Réponse IA vide.";
}
