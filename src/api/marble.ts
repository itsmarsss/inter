import type {
  CaptureImage,
  CustomShape,
  FurnitureAsset,
  FurnitureAssetMap,
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
  assetById?: FurnitureAssetMap;
  shapes: CustomShape[];
  projectTitle: string;
  visibility: "private" | "public";
  workflowStep: "chisel" | "panorama" | "draft" | "world";
  templateId: string;
  panoramaOpacity: number;
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
  assetById = new Map(assets.map((asset) => [asset.id, asset])),
  shapes,
  projectTitle,
  visibility,
  workflowStep,
  templateId,
  panoramaOpacity,
  stylePrompt,
  captures,
}: {
  room: RoomBounds;
  instances: FurnitureInstance[];
  assets: FurnitureAsset[];
  assetById?: FurnitureAssetMap;
  shapes: CustomShape[];
  projectTitle: string;
  visibility: "private" | "public";
  workflowStep: "chisel" | "panorama" | "draft" | "world";
  templateId: string;
  panoramaOpacity: number;
  stylePrompt: string;
  captures: CaptureImage[];
}): MarblePayload {
  const dimensions = roomDimensions(room);
  const layoutPano = captures.find((capture) => capture.role === "layout-pano");
  const roomCenter: [number, number, number] = [
    (room.minX + room.maxX) / 2,
    room.height / 2,
    (room.minZ + room.maxZ) / 2,
  ];
  const objects = instances.map((instance) => {
    const asset = assetById.get(instance.assetId);
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
      type: "image",
      text_prompt: [
        stylePrompt,
        "",
        "Strictly preserve the submitted 360 equirectangular layout panorama.",
        `Room dimensions must stay ${dimensions.width}m wide, ${dimensions.depth}m deep, ${dimensions.height}m tall.`,
        "Keep wall planes, room footprint, camera origin, major object footprints, object positions, and object orientations fixed.",
        `Furniture to preserve in place: ${objects.map((object) => `${object.name} at ${object.position.join(",")} rotated ${object.rotation.join(",")} scaled ${object.scale.join(",")}`).join("; ") || "none"}.`,
        `Custom blockout shapes to preserve in place: ${shapes.map((shape) => `${shape.kind} "${shape.name}" at ${shape.position.join(",")} rotated ${shape.rotation.join(",")} scaled ${shape.scale.join(",")}`).join("; ") || "none"}.`,
        `Project metadata: "${projectTitle}", ${visibility}, ${workflowStep} workflow, template ${templateId}, panorama reference opacity ${panoramaOpacity}.`,
        "Replace blockout materials with finished interior art and realistic detail without adding, deleting, or relocating major furniture.",
      ].join("\n"),
    },
    metadata: {
      capture: layoutPano
        ? {
            role: layoutPano.role,
            isPano: Boolean(layoutPano.isPano),
            resolution: layoutPano.resolution,
            camera: layoutPano.camera,
            roomCenter,
            coordinateSystem: "three-y-up",
            generationMode: "layout-pano",
          }
        : undefined,
      roomLayout: { bounds: room, dimensions },
      objects,
      shapes,
      project: {
        title: projectTitle,
        visibility,
        workflowStep,
        templateId,
        panoramaOpacity,
      },
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
