import { NextRequest, NextResponse } from "next/server";
import { NEST_AUTH_TOKEN_COOKIE } from "@/lib/nest-auth-proxy";
import type { AnalysisResult, StoryboardShot } from "@/types";

type ProjectCreatePayload = Record<string, unknown> & {
  projectId: string | undefined;
  title: string | undefined;
  originalScript: string | undefined;
  optimizedScript: string | undefined;
  contentType: string | undefined;
  style: string | undefined;
  duration: string | undefined;
  status: string | undefined;
  storyboardImageUrl: string | undefined;
  storyboardImagePrompt: string | undefined;
  fullVideoPrompt: string | undefined;
  shots: unknown[] | undefined;
  result: AnalysisResult | undefined;
};

type NestResponseData = Record<string, unknown> & {
  projects: unknown[] | undefined;
  saved: boolean | undefined;
  projectId: string | undefined;
  versionId: string | undefined;
  versionNumber: number | undefined;
  storyboardImageUrl: string | undefined;
};

type NestResponse = Record<string, unknown> & {
  ok: boolean | undefined;
  data: NestResponseData | undefined;
  error: string | undefined;
  message: string | string[] | undefined;
};

function getNestApiBaseUrl() {
  return (process.env.NEST_API_BASE_URL || "http://localhost:4000/api").replace(/\/+$/, "");
}

function formatUpstreamError(payload: NestResponse | null, fallback: string) {
  const message = payload ? payload.error || payload.message || fallback : fallback;
  return Array.isArray(message) ? message.join("; ") : message;
}

async function readJson(response: Response): Promise<NestResponse | null> {
  try {
    return (await response.json()) as NestResponse;
  } catch {
    return null;
  }
}

function getBearerToken(request: NextRequest) {
  const cookie = request.cookies.get(NEST_AUTH_TOKEN_COOKIE);
  return cookie ? cookie.value : undefined;
}

function mapShotToNestProjectBody(shot: StoryboardShot) {
  return {
    shotNumber: Number(shot.shotNumber),
    scene: shot.scene,
    visual: shot.visual,
    shotType: shot.shotType,
    cameraMovement: shot.cameraMovement,
    emotion: shot.emotion,
    transition: shot.transition,
    firstFramePrompt: shot.firstFramePrompt,
    videoPrompt: shot.videoPrompt,
    lastFramePrompt: shot.lastFramePrompt,
    negativePrompt: shot.negativePrompt,
  };
}

function getNestResponseData(payload: NestResponse | null) {
  if (!payload || !payload.data || typeof payload.data !== "object") return null;
  return payload.data;
}

export function mapAnalysisResultToNestProjectBody(input: Record<string, unknown>) {
  const payload = input as ProjectCreatePayload;
  if (!payload.result) {
    return input;
  }

  return {
    projectId: payload.projectId,
    title: payload.result.title,
    originalScript: payload.originalScript || "",
    optimizedScript: payload.result.optimizedScript,
    contentType: payload.result.contentType,
    style: payload.result.style,
    duration: payload.result.duration,
    status: payload.status || "draft",
    storyboardImageUrl: payload.storyboardImageUrl,
    storyboardImagePrompt: payload.storyboardImagePrompt,
    fullVideoPrompt: payload.fullVideoPrompt,
    shots: payload.result.storyboard.map(mapShotToNestProjectBody),
  };
}

export async function proxyNestProjectsGet(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const upstream = await fetch(`${getNestApiBaseUrl()}/projects`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await readJson(upstream);

  if (!upstream.ok || !payload || !payload.ok) {
    return NextResponse.json(
      { ok: false, error: formatUpstreamError(payload, "Projects service request failed") },
      { status: upstream.status || 502 },
    );
  }

  const data = getNestResponseData(payload);
  return NextResponse.json({ ok: true, projects: data ? data.projects || [] : [] });
}

export async function proxyNestProjectGet(request: NextRequest, projectId: string) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const upstream = await fetch(`${getNestApiBaseUrl()}/projects/${projectId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await readJson(upstream);

  if (!upstream.ok || !payload || !payload.ok) {
    const error =
      upstream.status === 404
        ? "Project detail endpoint is unavailable. Restart the Nest API with npm run api:dev, then refresh this page."
        : formatUpstreamError(payload, "Project detail request failed");
    return NextResponse.json(
      { ok: false, error },
      { status: upstream.status || 502 },
    );
  }

  const data = getNestResponseData(payload);
  return NextResponse.json({ ok: true, project: data ? data.project || null : null });
}

export async function proxyNestProjectsPost(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = mapAnalysisResultToNestProjectBody((await request.json()) as Record<string, unknown>);
  const upstream = await fetch(`${getNestApiBaseUrl()}/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(upstream);

  if (!upstream.ok || !payload || !payload.ok) {
    return NextResponse.json(
      { ok: false, error: formatUpstreamError(payload, "Project save failed") },
      { status: upstream.status || 502 },
    );
  }

  return NextResponse.json({ ok: true, save: getNestResponseData(payload) || { saved: true } });
}

export async function saveAnalysisProjectToNest(
  request: NextRequest,
  originalScript: string,
  result: AnalysisResult,
  projectId: string | undefined = undefined,
) {
  const token = getBearerToken(request);
  if (!token) return { saved: false, reason: "Unauthorized" };

  const body = mapAnalysisResultToNestProjectBody({ projectId, originalScript, result });
  const upstream = await fetch(`${getNestApiBaseUrl()}/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await readJson(upstream);

  if (!upstream.ok || !payload || !payload.ok) {
    return {
      saved: false,
      reason: formatUpstreamError(payload, "Project save failed"),
    };
  }

  return getNestResponseData(payload) || { saved: true };
}

export async function saveStoryboardImageToNest(
  request: NextRequest,
  input: { projectId: string; versionId: string; storyboardImageUrl: string; storyboardImagePrompt: string | undefined },
) {
  const token = getBearerToken(request);
  if (!token) return { saved: false, reason: "Unauthorized" };

  const upstream = await fetch(`${getNestApiBaseUrl()}/projects/${input.projectId}/versions/${input.versionId}/storyboard-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      storyboardImageUrl: input.storyboardImageUrl,
      storyboardImagePrompt: input.storyboardImagePrompt,
    }),
    cache: "no-store",
  });
  const payload = await readJson(upstream);

  if (!upstream.ok || !payload || !payload.ok) {
    return {
      saved: false,
      reason: formatUpstreamError(payload, "Storyboard image save failed"),
    };
  }

  return getNestResponseData(payload) || { saved: true };
}
