import { generateMarbleRoom, jsonResponse, readJsonRequest } from "../../../../src/server/api";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    return await generateMarbleRoom(await readJsonRequest(request));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return jsonResponse({ error: message }, { status: 400 });
  }
}
