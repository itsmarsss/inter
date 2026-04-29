"use client";

import { ExternalLink, Minus, PackageSearch, Search, ShoppingBag, Star } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { searchEbayProducts, type EbayProductResult } from "../api/products";
import type { FurnitureAsset, FurnitureAssetMap, FurnitureInstance, LibraryEntry } from "../state/types";

type ProductSearchPanelProps = {
  open: boolean;
  assets: FurnitureAsset[];
  instances: FurnitureInstance[];
  assetById: FurnitureAssetMap;
  libraryEntries: LibraryEntry[];
  onClose: () => void;
};

type ProductQuery = {
  id: string;
  label: string;
  query: string;
  source: string;
};

export function ProductSearchPanel({
  open,
  assets,
  instances,
  assetById,
  libraryEntries,
  onClose,
}: ProductSearchPanelProps) {
  const queries = useMemo(
    () => buildProductQueries(assets, instances, assetById, libraryEntries),
    [assetById, assets, instances, libraryEntries],
  );
  const [inputValue, setInputValue] = useState("");
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);
  const [results, setResults] = useState<EbayProductResult[]>([]);
  const [totalResults, setTotalResults] = useState<number | undefined>(undefined);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    try {
      const response = await searchEbayProducts(trimmed);
      setResults(response.results);
      setTotalResults(response.totalResults);
      setSearchedQuery(response.query);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Product search failed.");
      setResults([]);
      setTotalResults(undefined);
      setSearchedQuery(trimmed);
    } finally {
      setLoading(false);
    }
  }

  function selectQuery(query: ProductQuery) {
    setActiveQueryId(query.id);
    setInputValue(query.query);
    void runSearch(query.query);
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 44,
        top: 0,
        bottom: 0,
        width: open ? 300 : 0,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        background: "#16181d",
        borderRight: "1px solid var(--border-mid)",
        boxShadow: open ? "8px 0 28px rgba(0, 0, 0, 0.55)" : "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 160ms ease",
        zIndex: 15,
      }}
    >
      <div
        style={{
          height: 44,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--border-dim)",
          flexShrink: 0,
        }}
      >
        <PackageSearch size={13} strokeWidth={1.5} color="var(--accent-text)" />
        <span
          style={{
            fontSize: 17,
            fontWeight: 400,
            color: "var(--text-bright)",
            letterSpacing: "0.06em",
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            lineHeight: 1,
            flex: 1,
            whiteSpace: "nowrap",
          }}
        >
          Products
        </span>
        <PanelIconBtn label="Collapse panel" onClick={onClose}>
          <Minus size={11} strokeWidth={1.5} />
        </PanelIconBtn>
      </div>

      <div style={{ padding: "12px", flexShrink: 0, borderBottom: "1px solid var(--border-dim)" }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(inputValue);
          }}
          style={{ display: "grid", gridTemplateColumns: "1fr 34px", gap: 6 }}
        >
          <input
            className="precision-input"
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setActiveQueryId(null);
            }}
            placeholder="Search eBay furniture"
            style={{
              height: 34,
              minWidth: 0,
              background: "var(--surface-input)",
              border: "1px solid var(--border-dim)",
              borderRadius: 4,
              padding: "0 10px",
              fontSize: 12,
              color: "var(--text-bright)",
              fontFamily: "var(--font-ui)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            aria-label="Search eBay products"
            title="Search eBay products"
            style={{
              height: 34,
              borderRadius: 4,
              border: "1px solid var(--border-dim)",
              background: inputValue.trim() && !loading ? "var(--surface-input)" : "transparent",
              color: inputValue.trim() && !loading ? "var(--accent-text)" : "var(--text-ghost)",
              display: "grid",
              placeItems: "center",
              cursor: inputValue.trim() && !loading ? "pointer" : "not-allowed",
            }}
          >
            <Search size={14} strokeWidth={1.6} />
          </button>
        </form>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 9,
            maxHeight: 92,
            overflowY: "auto",
          }}
        >
          {queries.length === 0 ? (
            <span style={{ fontSize: 10, color: "var(--text-secondary)", fontStyle: "italic" }}>
              Generate or place furniture to search matching products.
            </span>
          ) : (
            queries.map((query) => (
              <button
                key={query.id}
                type="button"
                onClick={() => selectQuery(query)}
                title={`${query.source}: ${query.query}`}
                style={{
                  minWidth: 0,
                  maxWidth: "100%",
                  height: 24,
                  borderRadius: 4,
                  border: `1px solid ${activeQueryId === query.id ? "var(--accent-border)" : "var(--border-dim)"}`,
                  background: activeQueryId === query.id ? "var(--accent-dim)" : "var(--surface-input)",
                  color: activeQueryId === query.id ? "var(--accent-text)" : "var(--text-secondary)",
                  padding: "0 8px",
                  fontSize: 10,
                  fontFamily: "var(--font-ui)",
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {query.label}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="precision-scroll" style={{ flex: 1, overflowY: "auto" }}>
        <div
          style={{
            height: 28,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 12px",
            borderBottom: "1px solid var(--border-dim)",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          <ShoppingBag size={10} strokeWidth={1.5} color="var(--accent-text)" />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {searchedQuery ? `eBay: ${searchedQuery}` : "eBay Results"}
          </span>
          {typeof totalResults === "number" ? (
            <span
              style={{
                fontSize: 9,
                color: "var(--accent-text)",
                fontFamily: "var(--font-mono)",
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-border)",
                padding: "0 5px",
                borderRadius: 2,
              }}
            >
              {compactNumber(totalResults)}
            </span>
          ) : null}
        </div>

        {loading ? <PanelMessage label="Searching eBay..." /> : null}
        {!loading && error ? <PanelMessage label={error} tone="error" /> : null}
        {!loading && !error && results.length === 0 ? (
          <PanelMessage label="Pick a furniture item or enter a product search." />
        ) : null}
        {!loading && !error
          ? results.map((result) => <ProductResultCard key={result.id} result={result} />)
          : null}
      </div>
    </div>
  );
}

function buildProductQueries(
  assets: FurnitureAsset[],
  instances: FurnitureInstance[],
  assetById: FurnitureAssetMap,
  libraryEntries: LibraryEntry[],
) {
  const queries: ProductQuery[] = [];
  const seen = new Set<string>();

  function push(id: string, label: string, query: string, source: string) {
    const normalized = query.trim().replace(/\s+/g, " ");
    if (!normalized || seen.has(normalized.toLowerCase())) return;
    seen.add(normalized.toLowerCase());
    queries.push({
      id,
      label: label.trim() || normalized,
      query: normalized,
      source,
    });
  }

  for (const instance of instances) {
    const asset = assetById.get(instance.assetId);
    push(`instance-${instance.id}`, instance.name, asset?.prompt ?? instance.name, "Placed");
  }

  for (const asset of assets) {
    push(`asset-${asset.id}`, asset.name, asset.prompt || asset.name, "Workspace");
  }

  for (const entry of libraryEntries) {
    push(`library-${entry.id}`, entry.name, entry.prompt || entry.name, "Library");
  }

  return queries;
}

function ProductResultCard({ result }: { result: EbayProductResult }) {
  return (
    <a
      href={result.link}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "grid",
        gridTemplateColumns: "56px minmax(0,1fr)",
        gap: 9,
        padding: "10px 12px",
        borderBottom: "1px solid var(--border-dim)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 5,
          border: "1px solid var(--border-dim)",
          background: "var(--surface-input)",
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
        }}
      >
        {result.thumbnail ? (
          <img src={result.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <ShoppingBag size={18} color="var(--text-ghost)" strokeWidth={1.2} />
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "start" }}>
          <h3
            style={{
              margin: 0,
              flex: 1,
              minWidth: 0,
              fontSize: 11,
              lineHeight: 1.35,
              color: "var(--text-primary)",
              fontWeight: 500,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {result.title}
          </h3>
          <ExternalLink size={11} color="var(--text-ghost)" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
        </div>
        {result.price ? (
          <div style={{ marginTop: 4, color: "var(--accent-text)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            {result.price}
          </div>
        ) : null}
        <div
          style={{
            marginTop: 4,
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 8px",
            color: "var(--text-secondary)",
            fontSize: 9,
            lineHeight: 1.35,
          }}
        >
          {result.condition ? <span>{result.condition}</span> : null}
          {result.shipping ? <span>{result.shipping}</span> : null}
          {result.quantitySold ? <span>{result.quantitySold}</span> : null}
          {result.seller?.positiveFeedback ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Star size={9} strokeWidth={1.4} />
              {result.seller.positiveFeedback}%
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}

function PanelMessage({ label, tone = "muted" }: { label: string; tone?: "muted" | "error" }) {
  return (
    <div
      style={{
        padding: "24px 14px",
        color: tone === "error" ? "var(--status-error)" : "var(--text-secondary)",
        fontSize: 11,
        lineHeight: 1.5,
        fontStyle: "italic",
      }}
    >
      {label}
    </div>
  );
}

function PanelIconBtn({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        border: "none",
        background: "transparent",
        color: "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function compactNumber(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
