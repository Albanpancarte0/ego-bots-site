export async function chat({ system, user }) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  const base   = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model  = process.env.LLM_MODEL || "gpt-4o-mini";

  // Fallback si pas de clé (ne casse pas le build)
  const fallback = `*(fallback)* ${user.slice(0, 500)}\n\n- Sections\n- Concrètes\n- Livrable prêt`;
  if (!apiKey) return fallback;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000); // 20s
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.4
      }),
      signal: controller.signal
    });
    clearTimeout(t);

    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(()=> '')}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || fallback;
  } catch (e) {
    console.warn("LLM error:", e.message);
    return fallback;
  }
}
