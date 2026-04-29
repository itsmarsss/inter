import { readLibraryManifest, saveToLibrary } from "../../../src/server/library";

export const runtime = "nodejs";

export async function GET() {
  const entries = await readLibraryManifest();
  return Response.json(entries);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entry = await saveToLibrary(body);
    return Response.json(entry);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save mesh";
    return Response.json({ error: message }, { status: 500 });
  }
}
