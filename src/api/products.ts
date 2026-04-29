export type EbayProductResult = {
  id: string;
  title: string;
  subtitle?: string;
  link: string;
  thumbnail?: string;
  price?: string;
  condition?: string;
  shipping?: string;
  location?: string;
  buyingFormat?: string;
  quantitySold?: string;
  seller?: {
    username?: string;
    reviews?: number;
    positiveFeedback?: number;
  };
};

export type EbayProductSearchResponse = {
  query: string;
  totalResults?: number;
  results: EbayProductResult[];
};

export async function searchEbayProducts(query: string): Promise<EbayProductSearchResponse> {
  const response = await fetch(`/api/products/ebay?q=${encodeURIComponent(query)}`);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `eBay product search failed: ${response.status}`;
    throw new Error(message);
  }

  return body as EbayProductSearchResponse;
}
