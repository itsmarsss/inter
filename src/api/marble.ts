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

  // Marble's text prompt should describe STYLE/MOOD only (≤2000 chars per the
  // prompt guide). Geometry / dimensions / object positions are conveyed by
  // the panorama; numeric "preserve dimensions" instructions are not
  // enforceable by the model and just crowd out the actual style signal.
  // We send a compact, descriptive paragraph and let Marble's recaptioner
  // enrich it from the panorama.
  const styleText = (stylePrompt ?? "").trim();
  const text_prompt = styleText
    ? `${styleText} Interior room captured as a 360° equirectangular panorama; maintain the same overall layout, walls, openings, and major object footprints visible in the image.`
    : "Photorealistic interior captured as a 360° equirectangular panorama; maintain the same overall layout, walls, openings, and major object footprints visible in the image.";

  return {
    // marble-1.1-plus enables dynamic world sizing, which adapts the generated
    // world to the spatial proportions of the input — what we want for
    // user-shaped rooms with outcrops.
    model: "marble-1.1-plus",
    world_prompt: {
      type: "image",
      text_prompt,
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
