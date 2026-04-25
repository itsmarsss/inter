import { health, jsonResponse } from "../../../src/server/api";

export const runtime = "nodejs";

export function GET() {
  return jsonResponse(health());
}
