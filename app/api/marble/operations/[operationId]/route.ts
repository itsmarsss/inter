import { pollMarbleOperationRoute } from "../../../../../src/server/api";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ operationId: string }> }) {
  const { operationId } = await context.params;
  return pollMarbleOperationRoute(operationId);
}
