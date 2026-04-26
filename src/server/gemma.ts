import "server-only";
import { Client } from "ssh2";

const DEFAULT_POLYCOUNT = 30000;
const DEFAULT_LENGTH_METERS = 2.0;
const SSH_TIMEOUT_MS = 30000;

// Meshy preview models are generated at a larger-than-real internal scale.
// Multiplying the real-world dimension by this factor keeps s = length/longest > 1
// so furniture appears at an appropriate size in the scene rather than shrinking.
const LENGTH_SCALE = 3;

// --- shared SSH helper -------------------------------------------------------

function sshExec(cmd: string): Promise<string | null> {
  const host = process.env.GEMMA_SSH_HOST;
  const username = process.env.GEMMA_SSH_USER ?? "root";
  const password = process.env.GEMMA_SSH_PASSWORD;

  if (!host || !password) return Promise.resolve(null);

  return new Promise((resolve) => {
    const conn = new Client();
    let settled = false;

    function finish(value: string | null) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { conn.end(); } catch {}
      resolve(value);
    }

    const timer = setTimeout(() => finish(null), SSH_TIMEOUT_MS);

    conn.on("ready", () => {
      conn.exec(cmd, (err, stream) => {
        if (err) return finish(null);
        let output = "";
        stream.on("data", (chunk: Buffer) => { output += chunk.toString(); });
        stream.stderr.on("data", () => {});
        stream.on("close", () => finish(output));
      });
    });

    conn.on("error", () => finish(null));
    conn.connect({ host, port: 22, username, password });
  });
}

function ollamaCmd(prompt: string): string {
  const body = JSON.stringify({
    model: "gemma3:4b",
    prompt,
    stream: false,
  });
  const escaped = body.replace(/'/g, "'\\''");
  return `curl -s --max-time 25 -X POST http://localhost:11434/api/generate -H 'Content-Type: application/json' -d '${escaped}'`;
}

function parseOllamaResponse(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { response?: string };
    return parsed.response ?? null;
  } catch {
    return null;
  }
}

// --- polycount estimation ----------------------------------------------------

function buildPolycountPrompt(furniture: string): string {
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

export async function estimateMeshPolycount(furniturePrompt: string): Promise<number> {
  const raw = await sshExec(ollamaCmd(buildPolycountPrompt(furniturePrompt)));
  const text = parseOllamaResponse(raw);
  if (!text) return DEFAULT_POLYCOUNT;
  const match = text.match(/\d+/);
  if (!match) return DEFAULT_POLYCOUNT;
  return Math.min(Math.max(parseInt(match[0], 10), 1000), 100000);
}

// --- real-world dimension estimation -----------------------------------------

function buildLengthPrompt(furniture: string): string {
  return (
    `You are an interior design expert. Estimate the typical real-world LONGEST dimension in meters ` +
    `of the following piece of furniture as it would appear in a normal home.\n` +
    `Reply with a single decimal number only — no units, no explanation.\n\n` +
    `Item: ${furniture}\n` +
    `Longest dimension (meters):`
  );
}

export async function estimateRealWorldLength(furniturePrompt: string): Promise<number> {
  const raw = await sshExec(ollamaCmd(buildLengthPrompt(furniturePrompt)));
  const text = parseOllamaResponse(raw);
  if (!text) return DEFAULT_LENGTH_METERS;
  const match = text.match(/\d+(\.\d+)?/);
  if (!match) return DEFAULT_LENGTH_METERS;
  const value = parseFloat(match[0]);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_LENGTH_METERS;
  return value * LENGTH_SCALE;
}
