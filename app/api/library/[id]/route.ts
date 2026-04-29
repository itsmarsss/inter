import { deleteFromLibrary } from "../../../../src/server/library";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteFromLibrary(id);
  return Response.json({ ok: true });
}
