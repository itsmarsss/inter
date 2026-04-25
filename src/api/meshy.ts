import type { FurnitureAsset } from "../state/types";

type MeshyTask = {
  id?: string;
  result?: string;
  status?: string;
  model_urls?: { glb?: string };
  thumbnail_url?: string;
  error?: string | { message?: string };
};

const MESHY_BASE = import.meta.env.VITE_MESHY_API_BASE ?? "https://api.meshy.ai/openapi/v2";

export async function generateFurnitureWithMeshy(asset: FurnitureAsset): Promise<FurnitureAsset> {
  const apiKey = import.meta.env.VITE_MESHY_API_KEY;
  if (!apiKey) return mockReadyAsset(asset, "No VITE_MESHY_API_KEY set; using a local placeholder.");

  const createResponse = await fetch(`${MESHY_BASE}/text-to-3d`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "preview",
      prompt: asset.prompt,
      art_style: "realistic",
      target_polycount: 30000,
      target_formats: ["glb"],
    }),
  });

  if (!createResponse.ok) {
    return mockReadyAsset(asset, await responseError(createResponse, "Meshy request failed"));
  }

  const created = (await createResponse.json()) as MeshyTask;
  const taskId = created.result ?? created.id;
  if (!taskId) return mockReadyAsset(asset, "Meshy did not return a task id.");

  const task = await pollMeshyTask(taskId, apiKey);
  if (!task.model_urls?.glb) return mockReadyAsset(asset, task.error?.toString() ?? "Meshy did not return a GLB.");

  return {
    ...asset,
    taskId,
    status: "ready",
    modelUrl: task.model_urls.glb,
    thumbnailUrl: task.thumbnail_url,
    error: undefined,
  };
}

async function pollMeshyTask(taskId: string, apiKey: string): Promise<MeshyTask> {
  const maxAttempts = 42;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await delay(attempt < 4 ? 1800 : 3500);
    const response = await fetch(`${MESHY_BASE}/text-to-3d/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) throw new Error(await responseError(response, "Meshy polling failed"));

    const task = (await response.json()) as MeshyTask;
    const status = task.status?.toUpperCase();
    if (status === "SUCCEEDED" || status === "SUCCESS" || status === "COMPLETED") return task;
    if (status === "FAILED" || status === "EXPIRED" || status === "CANCELED") return task;
  }

  return { status: "TIMEOUT", error: "Meshy generation timed out." };
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
    return body?.message ?? body?.error ?? fallback;
  } catch {
    return `${fallback}: ${response.status}`;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
