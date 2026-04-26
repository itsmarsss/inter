import "server-only";
import { Client } from "ssh2";

const DEFAULT_POLYCOUNT = 30000;
const SSH_TIMEOUT_MS = 30000;

function buildPrompt(furniture: string): string {
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
  return Math.min(Math.max(parseInt(match[0], 10), 1000), 100000);
}

export async function estimateMeshPolycount(furniturePrompt: string): Promise<number> {
  const host = process.env.GEMMA_SSH_HOST;
  const username = process.env.GEMMA_SSH_USER ?? "root";
  const password = process.env.GEMMA_SSH_PASSWORD;

  if (!host || !password) return DEFAULT_POLYCOUNT;

  return new Promise((resolve) => {
    const conn = new Client();
    let settled = false;

    function finish(value: number) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { conn.end(); } catch {}
      resolve(value);
    }

    const timer = setTimeout(() => finish(DEFAULT_POLYCOUNT), SSH_TIMEOUT_MS);

    conn.on("ready", () => {
      const body = JSON.stringify({
        model: "gemma3:12b",
        prompt: buildPrompt(furniturePrompt),
        stream: false,
      });
      // Shell-safe: escape single quotes inside the single-quoted JSON arg
      const escapedBody = body.replace(/'/g, "'\\''");
      const cmd = `curl -s --max-time 25 -X POST http://localhost:11434/api/generate -H 'Content-Type: application/json' -d '${escapedBody}'`;

      conn.exec(cmd, (err, stream) => {
        if (err) return finish(DEFAULT_POLYCOUNT);

        let output = "";
        stream.on("data", (chunk: Buffer) => { output += chunk.toString(); });
        stream.stderr.on("data", () => {});
        stream.on("close", () => {
          try {
            const parsed = JSON.parse(output) as { response?: string };
            finish(parsePolycount(parsed.response ?? "") ?? DEFAULT_POLYCOUNT);
          } catch {
            finish(DEFAULT_POLYCOUNT);
          }
        });
      });
    });

    conn.on("error", () => finish(DEFAULT_POLYCOUNT));
    conn.connect({ host, port: 22, username, password });
  });
}
