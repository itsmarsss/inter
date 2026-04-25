import { proxyMarbleSplat } from "../../../../src/server/api";

export const runtime = "nodejs";

export function GET(request: Request) {
  const sourceUrl = new URL(request.url).searchParams.get("url") ?? "";
  return proxyMarbleSplat(sourceUrl);
}
