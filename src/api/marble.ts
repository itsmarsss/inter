import type {
  CaptureImage,
  FurnitureAsset,
  FurnitureInstance,
  MarblePayload,
  MarbleResult,
  RoomBounds,
} from "../state/types";
import { roomDimensions } from "../state/editor";

type PreparedUpload = {
  id?: string;
  media_asset_id?: string;
  upload_url?: string;
  uploadUrl?: string;
};

type Operation = {
  id?: string;
  name?: string;
  done?: boolean;
  status?: string;
  result?: MarbleWorld;
  response?: MarbleWorld;
  error?: { message?: string } | string;
};

type MarbleWorld = {
  world_marble_url?: string;
  url?: string;
  assets?: {
    thumbnail_url?: string;
    imagery?: { pano_url?: string };
    splats?: { spz_urls?: string[] };
    mesh?: { collider_mesh_url?: string };
  };
};

const MARBLE_BASE = import.meta.env.VITE_WORLDLABS_API_BASE ?? "https://api.worldlabs.ai/marble/v1";

export async function generateRoomWithMarble(params: {
  room: RoomBounds;
  instances: FurnitureInstance[];
  assets: FurnitureAsset[];
  stylePrompt: string;
  captures: CaptureImage[];
}): Promise<MarbleResult> {
  const payload = buildMarblePayload(params);
  const apiKey = import.meta.env.VITE_WORLDLABS_API_KEY;
  if (!apiKey) return mockMarbleResult(payload, "No VITE_WORLDLABS_API_KEY set; using mock Marble output.");

  try {
    const mediaAssets = await Promise.all(
      params.captures.map((capture) => uploadCaptureToMarble(capture, apiKey)),
    );

    const requestPayload: MarblePayload = {
      ...payload,
      world_prompt: {
        ...payload.world_prompt,
        type: mediaAssets.length > 0 ? "multi-image" : "text",
        media_assets: mediaAssets.length > 0 ? mediaAssets : undefined,
      },
    };

    const generateResponse = await fetch(`${MARBLE_BASE}/worlds:generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!generateResponse.ok) {
      return mockMarbleResult(requestPayload, await responseError(generateResponse, "Marble generation failed"));
    }

    const operation = (await generateResponse.json()) as Operation;
    const operationId = operation.id ?? operation.name;
    if (!operationId) return mockMarbleResult(requestPayload, "Marble did not return an operation id.");

    const completed = await pollMarbleOperation(operationId, apiKey);
    const world = completed.result ?? completed.response;
    if (!world) return mockMarbleResult(requestPayload, "Marble operation finished without a world result.");

    return {
      status: "complete",
      payload: requestPayload,
      operationId,
      worldUrl: world.world_marble_url ?? world.url,
      thumbnailUrl: world.assets?.thumbnail_url,
      panoUrl: world.assets?.imagery?.pano_url,
      spzUrl: world.assets?.splats?.spz_urls?.[0],
      colliderMeshUrl: world.assets?.mesh?.collider_mesh_url,
    };
  } catch (error) {
    return mockMarbleResult(payload, error instanceof Error ? error.message : "Marble request failed.");
  }
}

function buildMarblePayload({
  room,
  instances,
  assets,
  stylePrompt,
}: {
  room: RoomBounds;
  instances: FurnitureInstance[];
  assets: FurnitureAsset[];
  stylePrompt: string;
}): MarblePayload {
  const dimensions = roomDimensions(room);
  const objects = instances.map((instance) => {
    const asset = assets.find((item) => item.id === instance.assetId);
    return {
      id: instance.id,
      name: instance.name,
      prompt: asset?.prompt ?? instance.name,
      position: instance.position,
      rotation: instance.rotation,
      scale: instance.scale,
      modelUrl: asset?.modelUrl,
    };
  });

  return {
    model: "marble-1.1",
    world_prompt: {
      type: "multi-image",
      text_prompt: [
        stylePrompt,
        "",
        `Preserve this edited room blockout: ${dimensions.width}m wide, ${dimensions.depth}m deep, ${dimensions.height}m tall.`,
        `Furniture to preserve: ${objects.map((object) => `${object.name} at ${object.position.join(",")}`).join("; ") || "none"}.`,
        "Generate a complete interior design world that refines the rough blockout into a finished designed room.",
      ].join("\n"),
    },
    metadata: {
      roomLayout: { bounds: room, dimensions },
      objects,
    },
  };
}

async function uploadCaptureToMarble(capture: CaptureImage, apiKey: string) {
  const prepareResponse = await fetch(`${MARBLE_BASE}/media-assets:prepare_upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content_type: "image/png" }),
  });

  if (!prepareResponse.ok) throw new Error(await responseError(prepareResponse, "Marble upload prepare failed"));

  const prepared = (await prepareResponse.json()) as PreparedUpload;
  const uploadUrl = prepared.upload_url ?? prepared.uploadUrl;
  const mediaId = prepared.media_asset_id ?? prepared.id;
  if (!uploadUrl || !mediaId) throw new Error("Marble did not return an upload URL and media asset id.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: dataUrlToBlob(capture.dataUrl),
  });

  if (!uploadResponse.ok) throw new Error(`Marble media upload failed: ${uploadResponse.status}`);
  return { id: mediaId, role: capture.role };
}

async function pollMarbleOperation(operationId: string, apiKey: string): Promise<Operation> {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await delay(attempt < 8 ? 2000 : 5000);
    const response = await fetch(`${MARBLE_BASE}/operations/${encodeURIComponent(operationId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(await responseError(response, "Marble polling failed"));

    const operation = (await response.json()) as Operation;
    const status = operation.status?.toUpperCase();
    if (operation.done || status === "SUCCEEDED" || status === "SUCCESS" || status === "COMPLETED") {
      return operation;
    }
    if (status === "FAILED" || status === "CANCELED" || operation.error) {
      throw new Error(
        typeof operation.error === "string" ? operation.error : operation.error?.message ?? "Marble generation failed.",
      );
    }
  }

  throw new Error("Marble generation timed out.");
}

function mockMarbleResult(payload: MarblePayload, error: string): MarbleResult {
  return {
    status: "complete",
    payload,
    operationId: "mock-marble-operation",
    worldUrl: "https://worldlabs.ai/marble",
    thumbnailUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 720'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%230f172a'/%3E%3Cstop offset='1' stop-color='%2314b8a6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='720' fill='url(%23g)'/%3E%3Cpath d='M180 520h840V230L600 105 180 230z' fill='%23e2e8f0' opacity='.18'/%3E%3Cpath d='M260 485h250V330H260zm420 0h260V285H680z' fill='%23f8fafc' opacity='.28'/%3E%3Ccircle cx='854' cy='210' r='58' fill='%23fbbf24' opacity='.65'/%3E%3Ctext x='90' y='110' fill='%23f8fafc' font-family='Arial' font-size='54' font-weight='700'%3EMarble generated room preview%3C/text%3E%3Ctext x='92' y='165' fill='%23ccfbf1' font-family='Arial' font-size='26'%3EMock fallback while the live World Labs endpoint is unavailable%3C/text%3E%3C/svg%3E",
    error,
  };
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return body?.message ?? body?.error?.message ?? body?.error ?? fallback;
  } catch {
    return `${fallback}: ${response.status}`;
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
