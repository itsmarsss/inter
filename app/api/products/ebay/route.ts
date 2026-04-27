import { getJson } from "serpapi";

export const runtime = "nodejs";
export const maxDuration = 30;

const FALLBACK_SERPAPI_KEY = "d3b62911d5c425d41054d04b7148497451fa881e47dbb267da5a963ea4fb1667";
const RESULT_LIMIT = 18;

type SerpApiEbayResult = {
  title?: unknown;
  subtitle?: unknown;
  link?: unknown;
  product_id?: unknown;
  condition?: unknown;
  price?: unknown;
  shipping?: unknown;
  location?: unknown;
  buying_format_text?: unknown;
  thumbnail?: unknown;
  quantity_sold?: unknown;
  seller?: {
    username?: unknown;
    reviews?: unknown;
    positive_feedback_in_percentage?: unknown;
  };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (!query) return Response.json({ error: "Missing product search query." }, { status: 400 });

  const apiKey = process.env.SERPAPI_API_KEY ?? FALLBACK_SERPAPI_KEY;

  try {
    const json = await getJson({
      api_key: apiKey,
      engine: "ebay",
      _nkw: query,
    });

    const organicResults = Array.isArray(json.organic_results)
      ? (json.organic_results as SerpApiEbayResult[])
      : [];

    return Response.json({
      query,
      totalResults: numberValue(json.search_information?.total_results),
      results: organicResults.slice(0, RESULT_LIMIT).map(normalizeResult).filter(Boolean),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "SerpAPI eBay search failed." },
      { status: 502 },
    );
  }
}

function normalizeResult(result: SerpApiEbayResult) {
  const title = stringValue(result.title);
  const link = stringValue(result.link);
  if (!title || !link) return null;

  return {
    id: stringValue(result.product_id) ?? link,
    title,
    subtitle: stringValue(result.subtitle),
    link,
    thumbnail: stringValue(result.thumbnail),
    price: priceText(result.price),
    condition: stringValue(result.condition),
    shipping: shippingText(result.shipping),
    location: stringValue(result.location),
    buyingFormat: stringValue(result.buying_format_text),
    quantitySold: stringValue(result.quantity_sold),
    seller: result.seller
      ? {
          username: stringValue(result.seller.username),
          reviews: numberValue(result.seller.reviews),
          positiveFeedback: numberValue(result.seller.positive_feedback_in_percentage),
        }
      : undefined,
  };
}

function priceText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  const price = value as { raw?: unknown; from?: { raw?: unknown }; to?: { raw?: unknown } };
  const raw = stringValue(price.raw);
  if (raw) return raw;
  const from = stringValue(price.from?.raw);
  const to = stringValue(price.to?.raw);
  if (from && to) return `${from} - ${to}`;
  return from ?? to;
}

function shippingText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  return stringValue((value as { raw?: unknown }).raw);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
