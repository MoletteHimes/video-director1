import { NextRequest, NextResponse } from "next/server";
import { NEST_AUTH_TOKEN_COOKIE } from "@/lib/nest-auth-proxy";

type NestResponse = Record<string, unknown> & {
  ok?: boolean;
  data?: unknown;
  error?: string;
  message?: string | string[];
};

function getNestApiBaseUrl() {
  return (process.env.NEST_API_BASE_URL || "http://localhost:4000/api").replace(/\/+$/, "");
}

function getBearerToken(request: NextRequest) {
  return request.cookies.get(NEST_AUTH_TOKEN_COOKIE)?.value;
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

async function forward(request: NextRequest, path: string, init: { method: string; body?: unknown }) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let upstream: Response;
  try {
    upstream = await fetch(`${getNestApiBaseUrl()}/admin/${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Admin service is unavailable. Start the Nest API with npm run api:dev." },
      { status: 502 },
    );
  }

  const payload = await readJson(upstream);
  if (!upstream.ok || !payload || !payload.ok) {
    return NextResponse.json(
      { ok: false, error: formatUpstreamError(payload, "Admin request failed") },
      { status: upstream.status || 502 },
    );
  }
  return NextResponse.json({ ok: true, data: payload.data ?? null });
}

export function proxyAdminUsersList(request: NextRequest) {
  const search = request.nextUrl.search || "";
  return forward(request, `users${search}`, { method: "GET" });
}

export function proxyAdminUserGet(request: NextRequest, id: string) {
  return forward(request, `users/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function proxyAdminUserPatch(request: NextRequest, id: string) {
  const body = await request.json().catch(() => ({}));
  return forward(request, `users/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export function proxyAdminUserDelete(request: NextRequest, id: string) {
  return forward(request, `users/${encodeURIComponent(id)}`, { method: "DELETE" });
}
