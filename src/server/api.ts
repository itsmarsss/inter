import "server-only";
import net from "node:net";

const JSON_LIMIT_BYTES = 35 * 1024 * 1024;

const meshyBase = process.env.MESHY_API_BASE ?? "https://api.meshy.ai/openapi/v2";
const marbleBase = process.env.WORLDLABS_API_BASE ?? "https://api.worldlabs.ai/marble/v1";
const worldLabsApiKey = process.env.WORLDLABS_API_KEY;

type CaptureImage = {
  role?: string;
  dataUrl?: string;
};

type StageError = Error & {
  stage?: string;
};

type MarbleGeneratePayload = {
  model?: unknown;
  world_prompt?: {
    text_prompt?: unknown;
  };
};

type MarbleOperation = {
  status?: unknown;
  done?: unknown;
  error?: unknown;
  metadata?: {
    progress?: {
      status?: unknown;
    };
  };
  result?: MarbleWorld;
  response?: MarbleWorld;
};

type MarbleWorld = {
  world_marble_url?: string;
  url?: string;
  assets?: {
    thumbnail_url?: string;
    imagery?: {
      pano_url?: string;
    };
    splats?: {
      spz_urls?: unknown;
    };
    mesh?: {
      collider_mesh_url?: string;
    };
  };
};

export function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

export async function readJsonRequest(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > JSON_LIMIT_BYTES) {
    throw stageError("parse_request", "Request body exceeds the 35mb limit.");
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > JSON_LIMIT_BYTES) {
    throw stageError("parse_request", "Request body exceeds the 35mb limit.");
  }

  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

export function health() {
  return {
    ok: true,
    meshyConfigured: Boolean(process.env.MESHY_API_KEY),
    marbleConfigured: Boolean(worldLabsApiKey),
  };
}

export async function generateMeshyFurniture(body: Record<string, unknown>) {
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) return jsonResponse({ error: "Missing furniture prompt." }, { status: 400 });
  if (!process.env.MESHY_API_KEY) {
    return jsonResponse({ error: "MESHY_API_KEY is not configured on the backend." }, { status: 503 });
  }

  try {
    const createResponse = await fetch(`${meshyBase}/text-to-3d`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MESHY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "preview",
        prompt,
        art_style: "realistic",
        target_polycount: 30000,
        target_formats: ["glb"],
      }),
    });

    if (!createResponse.ok) {
      return jsonResponse(
        { error: await responseError(createResponse, "Meshy request failed") },
        { status: createResponse.status },
      );
    }

    const created = await createResponse.json();
    const taskId = created.result ?? created.id;
    if (!taskId) return jsonResponse({ error: "Meshy did not return a task id." }, { status: 502 });

    const task = await pollMeshyTask(taskId);
    const status = String(task.status ?? "").toUpperCase();
    if (!task.model_urls?.glb || ["FAILED", "EXPIRED", "CANCELED", "TIMEOUT"].includes(status)) {
      return jsonResponse(
        {
          error: normalizeError(task.error) ?? "Meshy did not return a usable GLB.",
          taskId,
          status: task.status,
        },
        { status: 502 },
      );
    }

    return jsonResponse({
      taskId,
      status: "ready",
      modelUrl: meshyModelProxyUrl(task.model_urls.glb),
      thumbnailUrl: task.thumbnail_url,
    });
  } catch (error) {
    return jsonResponse({ error: errorMessage(error, "Meshy generation failed.") }, { status: 500 });
  }
}

export async function proxyMeshyModel(sourceUrl: string) {
  const parsedUrl = parseMeshyAssetUrl(sourceUrl);
  if (!parsedUrl) return jsonResponse({ error: "Invalid Meshy asset URL." }, { status: 400 });

  try {
    const modelResponse = await fetch(parsedUrl);
    if (!modelResponse.ok || !modelResponse.body) {
      return jsonResponse(
        { error: await responseError(modelResponse, "Meshy model download failed") },
        { status: modelResponse.status || 502 },
      );
    }

    return streamResponse(modelResponse, "model/gltf-binary");
  } catch (error) {
    return jsonResponse({ error: errorMessage(error, "Meshy model download failed.") }, { status: 502 });
  }
}

export async function generateMarbleRoom(body: Record<string, unknown>) {
  const payload = body.payload as MarbleGeneratePayload | undefined;
  const captures = Array.isArray(body.captures) ? (body.captures as CaptureImage[]) : [];
  if (!payload?.world_prompt?.text_prompt) return jsonResponse({ error: "Missing Marble payload." }, { status: 400 });
  if (!worldLabsApiKey) {
    return jsonResponse({ error: "WORLDLABS_API_KEY is not configured on the backend." }, { status: 503 });
  }

  try {
    const capture = captures.find((item) => String(item?.role ?? "").startsWith("scene")) ?? captures[0];
    const mediaAsset = capture ? await uploadCaptureToMarble(capture, 0) : undefined;
    const requestPayload = {
      model: payload.model,
      display_name: "Interior blockout",
      world_prompt: {
        type: mediaAsset ? "image" : "text",
        text_prompt: payload.world_prompt.text_prompt,
        image_prompt: mediaAsset
          ? {
              source: "media_asset",
              media_asset_id: mediaAsset.id,
            }
          : undefined,
      },
    };

    const generateResponse = await fetch(`${marbleBase}/worlds:generate`, {
      method: "POST",
      headers: {
        ...marbleAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!generateResponse.ok) {
      return jsonResponse(
        {
          error: await responseError(generateResponse, "Marble generation failed"),
          stage: "generate_world",
          payload: requestPayload,
        },
        { status: generateResponse.status },
      );
    }

    const operation = await generateResponse.json();
    const operationId = operation.operation_id ?? operation.id ?? operation.name;
    if (!operationId) {
      return jsonResponse(
        { error: "Marble did not return an operation id.", stage: "generate_world", payload: requestPayload },
        { status: 502 },
      );
    }

    return jsonResponse({
      status: "generating",
      payload: requestPayload,
      operationId,
    });
  } catch (error) {
    const message = errorMessage(error, "Marble generation failed.");
    console.error("Marble generation failed", message, error);
    return jsonResponse({ error: message, stage: (error as StageError).stage, payload }, { status: 500 });
  }
}

export async function pollMarbleOperationRoute(operationId: string) {
  if (!worldLabsApiKey) {
    return jsonResponse({ error: "WORLDLABS_API_KEY is not configured on the backend." }, { status: 503 });
  }

  try {
    const operation = await fetchMarbleOperation(operationId);
    return jsonResponse(marbleOperationResult(operationId, operation));
  } catch (error) {
    const message = errorMessage(error, "Marble polling failed.");
    console.error("Marble polling failed", message, error);
    return jsonResponse(
      { status: "failed", operationId, error: message, stage: (error as StageError).stage },
      { status: 500 },
    );
  }
}

export async function proxyMarbleSplat(sourceUrl: string) {
  const parsedUrl = parsePublicHttpsUrl(sourceUrl);
  if (!parsedUrl) return jsonResponse({ error: "Invalid Marble SPZ URL." }, { status: 400 });

  try {
    const splatResponse = await fetchSafeAsset(parsedUrl);
    if (!splatResponse.ok || !splatResponse.body) {
      return jsonResponse(
        { error: await responseError(splatResponse, "Marble SPZ download failed") },
        { status: splatResponse.status || 502 },
      );
    }

    return streamResponse(splatResponse, "application/octet-stream");
  } catch (error) {
    return jsonResponse({ error: errorMessage(error, "Marble SPZ download failed.") }, { status: 502 });
  }
}

async function pollMeshyTask(taskId: string) {
  for (let attempt = 0; attempt < 42; attempt += 1) {
    await delay(attempt < 4 ? 1800 : 3500);
    const response = await fetch(`${meshyBase}/text-to-3d/${taskId}`, {
      headers: { Authorization: `Bearer ${process.env.MESHY_API_KEY}` },
    });
    if (!response.ok) throw new Error(await responseError(response, "Meshy polling failed"));

    const task = await response.json();
    const status = String(task.status ?? "").toUpperCase();
    if (["SUCCEEDED", "SUCCESS", "COMPLETED", "FAILED", "EXPIRED", "CANCELED"].includes(status)) return task;
  }

  return { status: "TIMEOUT", error: "Meshy generation timed out." };
}

async function uploadCaptureToMarble(capture: CaptureImage, index: number) {
  if (!capture?.dataUrl) throw stageError("capture", "Missing capture image.");
  const mime = dataUrlMime(capture.dataUrl);
  const extension = mimeExtension(mime);

  const prepareResponse = await fetch(`${marbleBase}/media-assets:prepare_upload`, {
    method: "POST",
    headers: {
      ...marbleAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_name: `${capture.role ?? "scene"}-${index + 1}.${extension}`,
      kind: "image",
      extension,
      metadata: { role: capture.role ?? "scene" },
    }),
  });

  if (!prepareResponse.ok) {
    throw stageError("prepare_upload", await responseError(prepareResponse, "Marble upload prepare failed"));
  }

  const prepared = await prepareResponse.json();
  const uploadUrl = prepared.upload_info?.upload_url ?? prepared.upload_url ?? prepared.uploadUrl;
  const uploadHeaders = prepared.upload_info?.required_headers ?? {};
  const mediaAsset = prepared.media_asset ?? prepared;
  const mediaId = mediaAsset.media_asset_id ?? mediaAsset.id ?? prepared.media_asset_id ?? prepared.id;

  if (!uploadUrl || !mediaId) {
    throw stageError("prepare_upload", "Marble did not return an upload URL and media asset id.");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mime,
      ...uploadHeaders,
    },
    body: dataUrlToBlob(capture.dataUrl),
  });

  if (!uploadResponse.ok) {
    throw stageError("upload_media", await responseError(uploadResponse, "Marble media upload failed"));
  }
  return { id: mediaId, role: capture.role ?? "scene" };
}

async function fetchMarbleOperation(operationId: string) {
  const response = await fetch(`${marbleBase}/operations/${encodeURIComponent(operationId)}`, {
    headers: marbleAuthHeaders(),
  });
  if (!response.ok) throw stageError("poll_operation", await responseError(response, "Marble polling failed"));
  return response.json();
}

function marbleOperationResult(operationId: string, operation: MarbleOperation) {
  const status = String(operation.status ?? operation.metadata?.progress?.status ?? "").toUpperCase();
  if (operation.error || ["FAILED", "CANCELED", "CANCELLED"].includes(status)) {
    return {
      status: "failed",
      operationId,
      error: normalizeError(operation.error) ?? "Marble generation failed.",
    };
  }

  const world = operation.result ?? operation.response;
  if (operation.done || ["SUCCEEDED", "SUCCESS", "COMPLETED"].includes(status)) {
    if (!world) {
      return {
        status: "failed",
        operationId,
        error: "Marble operation finished without a world result.",
      };
    }

    return {
      status: "complete",
      operationId,
      worldUrl: world.world_marble_url ?? world.url,
      thumbnailUrl: world.assets?.thumbnail_url,
      panoUrl: world.assets?.imagery?.pano_url,
      spzUrl: firstSpzUrl(world.assets?.splats?.spz_urls),
      colliderMeshUrl: world.assets?.mesh?.collider_mesh_url,
    };
  }

  return { status: "generating", operationId };
}

async function responseError(response: Response, fallback: string) {
  try {
    const text = await response.text();
    if (!text) return `${fallback}: ${response.status}`;
    try {
      const body = JSON.parse(text);
      return body?.detail?.[0]?.msg ?? body?.detail ?? body?.message ?? body?.error?.message ?? body?.error ?? `${fallback}: ${response.status}`;
    } catch {
      return `${fallback}: ${response.status} ${text}`;
    }
  } catch {
    return `${fallback}: ${response.status}`;
  }
}

function streamResponse(source: Response, fallbackContentType: string) {
  const headers = new Headers();
  headers.set("Content-Type", source.headers.get("content-type") ?? fallbackContentType);
  headers.set("Cache-Control", "private, max-age=3600");
  const contentLength = source.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(source.body, {
    status: source.status,
    headers,
  });
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = Buffer.from(base64, "base64");
  return new Blob([binary], { type: mime });
}

function dataUrlMime(dataUrl: string) {
  return dataUrl.match(/^data:(.*?);/)?.[1] ?? "image/png";
}

function mimeExtension(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return JSON.stringify(error);
}

function meshyModelProxyUrl(sourceUrl: string) {
  return `/api/meshy/model?url=${encodeURIComponent(sourceUrl)}`;
}

function parseMeshyAssetUrl(sourceUrl: string) {
  try {
    const parsedUrl = new URL(sourceUrl);
    if (parsedUrl.protocol !== "https:") return null;
    if (parsedUrl.hostname !== "assets.meshy.ai") return null;
    return parsedUrl;
  } catch {
    return null;
  }
}

function parsePublicHttpsUrl(sourceUrl: string) {
  try {
    const parsedUrl = new URL(sourceUrl);
    if (parsedUrl.protocol !== "https:") return null;
    if (parsedUrl.username || parsedUrl.password) return null;
    if (!isPublicHostname(parsedUrl.hostname)) return null;
    return parsedUrl;
  } catch {
    return null;
  }
}

function isPublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!normalized || normalized === "localhost" || normalized.endsWith(".localhost")) return false;

  const ipVersion = net.isIP(normalized);
  if (!ipVersion) return true;

  if (ipVersion === 4) {
    const [first, second] = normalized.split(".").map((part) => Number(part));
    if (first === 10 || first === 127 || first === 0) return false;
    if (first === 172 && second >= 16 && second <= 31) return false;
    if (first === 192 && second === 168) return false;
    if (first === 169 && second === 254) return false;
    return true;
  }

  return !(
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

async function fetchSafeAsset(initialUrl: URL) {
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: { "Accept-Encoding": "identity" },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;

    const location = response.headers.get("location");
    if (!location) throw new Error("Asset redirect did not include a Location header.");

    const nextUrl = parsePublicHttpsUrl(new URL(location, currentUrl).toString());
    if (!nextUrl) throw new Error("Asset redirect target is not allowed.");
    currentUrl = nextUrl;
  }

  throw new Error("Asset redirect limit exceeded.");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function stageError(stage: string, message: string) {
  const error = new Error(message) as StageError;
  error.stage = stage;
  return error;
}

function firstSpzUrl(spzUrls: unknown) {
  if (!spzUrls) return undefined;
  if (Array.isArray(spzUrls)) return spzUrls[0];
  if (typeof spzUrls !== "object") return undefined;
  const urls = spzUrls as Record<string, string>;
  return urls["500k"] ?? urls["100k"] ?? urls.full_res ?? Object.values(urls)[0];
}

function marbleAuthHeaders() {
  return { "WLT-Api-Key": worldLabsApiKey ?? "" };
}
