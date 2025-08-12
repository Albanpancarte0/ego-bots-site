export async function chat({ system, user }) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    // fallback sans clé (évite l'échec du build)
    return `*(fallback)* ${user.slice(0, 500)}\n\n- Sections\n- Concrètes\n- Livrable prêt`;
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.4
    })
  });
  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content?.trim();
  return out || "(vide)";
}
