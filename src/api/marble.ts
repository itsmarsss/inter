import type {
  CaptureImage,
  FurnitureAsset,
  FurnitureInstance,
  MarblePayload,
  MarbleResult,
  RoomBounds,
} from "../state/types";
import { roomDimensions } from "../state/editor";

export async function generateRoomWithMarble(params: {
  room: RoomBounds;
  instances: FurnitureInstance[];
  assets: FurnitureAsset[];
  stylePrompt: string;
  captures: CaptureImage[];
}): Promise<MarbleResult> {
  const payload = buildMarblePayload(params);
  try {
    const response = await fetch("/api/marble/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload, captures: params.captures }),
    });

    if (!response.ok) {
      return failedMarbleResult(payload, await responseError(response, "Marble generation failed"));
    }

    return normalizeMarbleResult(await response.json(), payload);
  } catch (error) {
    return failedMarbleResult(
      payload,
      error instanceof Error ? `${error.message}. Make sure the backend API server is running.` : "Marble request failed.",
    );
  }
}

export async function pollMarbleOperation(operationId: string): Promise<MarbleResult> {
  const response = await fetch(`/api/marble/operations/${encodeURIComponent(operationId)}`);
  if (!response.ok) {
    throw new Error(await responseError(response, "Marble polling failed"));
  }

  return normalizeMarbleResult(await response.json());
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

function failedMarbleResult(payload: MarblePayload, error: string): MarbleResult {
  return {
    status: "failed",
    payload,
    error,
  };
}

async function responseError(response: Response, fallback: string) {
  try {
    const text = await response.text();
    if (!text) return `${fallback}: ${response.status}`;

    try {
      const body = JSON.parse(text);
      return body?.message ?? body?.error?.message ?? body?.error ?? `${fallback}: ${response.status}`;
    } catch {
      return `${fallback}: ${response.status} ${text}`;
    }
  } catch {
    return `${fallback}: ${response.status}`;
  }
}

function normalizeMarbleResult(value: unknown, fallbackPayload?: MarblePayload): MarbleResult {
  const result = value as MarbleResult;
  return {
    ...result,
    payload: result.payload ?? fallbackPayload,
  };
}
