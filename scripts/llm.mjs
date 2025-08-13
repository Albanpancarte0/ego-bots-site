export async function chat({ system, user }) {
  const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const key  = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  if (!key) throw new Error("Missing LLM_API_KEY / OPENAI_API_KEY");

  const url = base.endsWith("/")
    ? `${base}chat/completions`
    : `${base}/chat/completions`;

  const body = {
    model,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: user }
    ],
    temperature: 0.4
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content || "";
  return out.trim();
}
