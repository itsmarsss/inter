import { estimateModelLength, jsonResponse, readJsonRequest } from "../../../../src/server/api";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    return await estimateModelLength(await readJsonRequest(request));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return jsonResponse({ error: message }, { status: 400 });
  }
}
