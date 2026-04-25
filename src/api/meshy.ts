import type { FurnitureAsset } from "../state/types";

type MeshyGenerateResponse = {
  taskId?: string;
  status?: string;
  modelUrl?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  error?: unknown;
};

export async function generateFurnitureWithMeshy(asset: FurnitureAsset): Promise<FurnitureAsset> {
  try {
    const response = await fetch("/api/meshy/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: asset.prompt }),
    });

    if (!response.ok) {
      return mockReadyAsset(asset, await responseError(response, "Meshy request failed"));
    }

    const generated = (await response.json()) as MeshyGenerateResponse;
    if (!generated.modelUrl) {
      return mockReadyAsset(
        { ...asset, taskId: generated.taskId },
        normalizeError(generated.error) ?? "Meshy did not return a usable GLB.",
      );
    }

    return {
      ...asset,
      taskId: generated.taskId,
      status: "ready",
      modelUrl: generated.modelUrl,
      thumbnailUrl: generated.thumbnailUrl ?? generated.thumbnail_url,
      error: undefined,
    };
  } catch (error) {
    return mockReadyAsset(
      asset,
      error instanceof Error
        ? `${error.message}. Make sure the backend API server is running.`
        : "Meshy request failed. Make sure the backend API server is running.",
    );
  }
}

function mockReadyAsset(asset: FurnitureAsset, error: string): FurnitureAsset {
  return {
    ...asset,
    status: "mock",
    taskId: asset.taskId ?? `mock-${asset.id}`,
    error,
  };
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return normalizeError(body?.message ?? body?.error ?? body) ?? `${fallback}: ${response.status}`;
  } catch {
    return `${fallback}: ${response.status}`;
  }
}

function normalizeError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const value = error as { message?: unknown; error?: unknown; detail?: unknown };
    return normalizeError(value.message) ?? normalizeError(value.error) ?? normalizeError(value.detail) ?? JSON.stringify(error);
  }
  return String(error);
}
