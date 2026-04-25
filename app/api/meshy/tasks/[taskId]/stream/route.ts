import { streamMeshyFurnitureTask } from "../../../../../../src/server/api";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  return streamMeshyFurnitureTask(taskId);
}
