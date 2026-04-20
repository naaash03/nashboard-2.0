const GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

type ProviderUsed = "groq" | "gemini" | "rules";

const lastProviderUsed: { provider: ProviderUsed | null } = { provider: null };

function logProvider(provider: ProviderUsed, note?: string): void {
  lastProviderUsed.provider = provider;
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ai/client] provider=${provider}${note ? ` | ${note}` : ""}`);
  }
}

export function getLastProviderUsed(): ProviderUsed | null {
  return lastProviderUsed.provider;
}

async function callGroq(prompt: string, context: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.GROQ_KEY;
  if (!apiKey) {
    throw new Error("GROQ_KEY is not configured.");
  }

  const userMessage = `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(GROQ_BASE, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [{ role: "user", content: userMessage }],
        temperature: 0.4,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const text = (await response.text()).slice(0, 200);
      throw new Error(`Groq ${response.status}: ${text}`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Groq returned empty content.");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(prompt: string, context: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const userMessage = `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const url = `${GEMINI_BASE}?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
      }),
    });

    if (!response.ok) {
      const text = (await response.text()).slice(0, 200);
      throw new Error(`Gemini ${response.status}: ${text}`);
    }

    const json = (await response.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    const content = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!content) {
      throw new Error("Gemini returned empty content.");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function inferAnalysis(
  prompt: string,
  context: Record<string, unknown>,
): Promise<string> {
  try {
    const result = await callGroq(prompt, context);
    logProvider("groq");
    return result;
  } catch (groqError) {
    logProvider("groq", `failed: ${String(groqError)}`);
  }

  try {
    const result = await callGemini(prompt, context);
    logProvider("gemini");
    return result;
  } catch (geminiError) {
    logProvider("gemini", `failed: ${String(geminiError)}`);
  }

  const fallback = createRulesBasedFallback(context);
  logProvider("rules");
  return fallback;
}

export function createRulesBasedFallback(context: Record<string, unknown>): string {
  const keys = Object.keys(context);

  const subject = keys.length > 0
    ? keys.slice(0, 3).map((k) => `${k}: ${JSON.stringify(context[k])}`).join(", ")
    : "the available data";

  const caveat = keys.includes("gameDate") || keys.includes("startTime")
    ? "game-time conditions or lineup changes occur"
    : keys.includes("winRate") || keys.includes("record")
    ? "recent form shifts significantly"
    : "new data becomes available";

  return `Based on ${subject}, no strong directional signal stands out at this time. This analysis could shift if ${caveat}.`;
}
