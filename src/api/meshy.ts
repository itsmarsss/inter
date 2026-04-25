import type { FurnitureAsset } from "../state/types";

type MeshyGenerateResponse = {
  taskId?: string;
  status?: string;
  error?: unknown;
};

export type MeshyStreamUpdate = {
  taskId?: string;
  status?: string;
  progress?: number;
  modelUrl?: string;
  thumbnailUrl?: string;
  error?: unknown;
};

type MeshyStreamHandlers = {
  onUpdate: (update: MeshyStreamUpdate) => void;
  onError?: (error: string) => void;
};

export async function startFurnitureMeshyTask(asset: FurnitureAsset): Promise<FurnitureAsset> {
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
    if (!generated.taskId) {
      return mockReadyAsset(
        asset,
        normalizeError(generated.error) ?? "Meshy did not return a task id.",
      );
    }

    return {
      ...asset,
      taskId: generated.taskId,
      status: "generating",
      progress: 0,
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

export function openFurnitureMeshyStream(taskId: string, handlers: MeshyStreamHandlers) {
  const source = new EventSource(`/api/meshy/tasks/${encodeURIComponent(taskId)}/stream`);

  source.onmessage = (event) => {
    try {
      handlers.onUpdate(JSON.parse(event.data) as MeshyStreamUpdate);
    } catch {
      handlers.onError?.("Meshy stream returned an invalid progress event.");
    }
  };

  source.onerror = () => {
    handlers.onError?.("Meshy progress stream disconnected.");
    source.close();
  };

  return source;
}

export function applyMeshyStreamUpdate(asset: FurnitureAsset, update: MeshyStreamUpdate): FurnitureAsset {
  const status = String(update.status ?? "").toUpperCase();
  if (isSuccessStatus(status)) {
    return updateAssetIfChanged(asset, {
      ...asset,
      status: update.modelUrl ? "ready" : "failed",
      progress: 100,
      modelUrl: update.modelUrl,
      thumbnailUrl: update.thumbnailUrl,
      error: update.modelUrl ? undefined : "Meshy completed without a usable GLB.",
    });
  }

  if (isFailedStatus(status) || update.error) {
    return updateAssetIfChanged(asset, {
      ...asset,
      status: "failed",
      progress: update.progress ?? asset.progress,
      error: normalizeError(update.error) ?? "Meshy generation failed.",
    });
  }

  return updateAssetIfChanged(asset, {
    ...asset,
    status: "generating",
    progress: update.progress ?? asset.progress,
    error: undefined,
  });
}

export function isTerminalMeshyUpdate(update: MeshyStreamUpdate) {
  const status = String(update.status ?? "").toUpperCase();
  return isSuccessStatus(status) || isFailedStatus(status) || Boolean(update.error);
}

function mockReadyAsset(asset: FurnitureAsset, error: string): FurnitureAsset {
  return {
    ...asset,
    status: "mock",
    taskId: asset.taskId ?? `mock-${asset.id}`,
    error,
  };
}

function updateAssetIfChanged(previous: FurnitureAsset, next: FurnitureAsset): FurnitureAsset {
  return previous.status === next.status &&
    previous.progress === next.progress &&
    previous.modelUrl === next.modelUrl &&
    previous.thumbnailUrl === next.thumbnailUrl &&
    previous.error === next.error
    ? previous
    : next;
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

function isSuccessStatus(status: string) {
  return ["SUCCEEDED", "SUCCESS", "COMPLETED"].includes(status);
}

function isFailedStatus(status: string) {
  return ["FAILED", "EXPIRED", "CANCELED", "CANCELLED"].includes(status);
}
