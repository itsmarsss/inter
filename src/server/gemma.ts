import "server-only";
import { Client } from "ssh2";

const DEFAULT_POLYCOUNT = 30000;
const SSH_TIMEOUT_MS = 30000;
const GEMINI_TIMEOUT_MS = 15000;

function buildEstimationPrompt(furniture: string): string {
  return (
    `You are a 3D modeling expert. Given this furniture description, reply with ONLY a single integer for the target polygon count.\n` +
    `Guidelines:\n` +
    `- Simple shapes (cube, box, cylinder): 5000-10000\n` +
    `- Basic furniture (stool, side table): 10000-20000\n` +
    `- Standard furniture (chair, sofa, table): 20000-40000\n` +
    `- Complex/ornate pieces (carved cabinet, detailed bookshelf): 40000-80000\n\n` +
    `Furniture: ${furniture}\n` +
    `Target polycount:`
  );
}

function parsePolycount(text: string): number | null {
  const match = text.match(/\d+/);
  if (!match) return null;
  const count = parseInt(match[0], 10);
  return Math.min(Math.max(count, 1000), 100000);
}

// Gemma 3 via SSH → Ollama on the Vultr server
async function estimateWithGemma(furniturePrompt: string): Promise<number | null> {
  const host = process.env.GEMMA_SSH_HOST;
  const username = process.env.GEMMA_SSH_USER ?? "root";
  const password = process.env.GEMMA_SSH_PASSWORD;

  if (!host || !password) return null;

  return new Promise((resolve) => {
    const conn = new Client();
    let settled = false;

    function finish(value: number | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        conn.end();
      } catch {}
      resolve(value);
    }

    const timer = setTimeout(() => finish(null), SSH_TIMEOUT_MS);

    conn.on("ready", () => {
      const body = JSON.stringify({
        model: "gemma3:12b",
        prompt: buildEstimationPrompt(furniturePrompt),
        stream: false,
      });
      // Shell-safe: escape single quotes inside the single-quoted JSON arg
      const escapedBody = body.replace(/'/g, "'\\''");
      const cmd = `curl -s --max-time 25 -X POST http://localhost:11434/api/generate -H 'Content-Type: application/json' -d '${escapedBody}'`;

      conn.exec(cmd, (err, stream) => {
        if (err) return finish(null);

        let output = "";
        stream.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        stream.stderr.on("data", () => {});
        stream.on("close", () => {
          try {
            const parsed = JSON.parse(output) as { response?: string };
            finish(parsePolycount(parsed.response ?? ""));
          } catch {
            finish(null);
          }
        });
      });
    });

    conn.on("error", () => finish(null));
    conn.connect({ host, port: 22, username, password });
  });
}

// Gemini flash as fallback
async function estimateWithGemini(furniturePrompt: string): Promise<number | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildEstimationPrompt(furniturePrompt) }] }],
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timer);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parsePolycount(text);
  } catch {
    return null;
  }
}

// Primary: Gemma 3 (SSH → Ollama) → Fallback: Gemini Flash → Fallback: hardcoded default
export async function estimateMeshPolycount(furniturePrompt: string): Promise<number> {
  const gemma = await estimateWithGemma(furniturePrompt);
  if (gemma !== null) return gemma;

  const gemini = await estimateWithGemini(furniturePrompt);
  if (gemini !== null) return gemini;

  return DEFAULT_POLYCOUNT;
}
