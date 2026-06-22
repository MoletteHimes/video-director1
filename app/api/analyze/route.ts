import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeScript } from "@/lib/ai";
import { fetchDirectorContextFromNest, saveAnalysisProjectToNest } from "@/lib/nest-projects-proxy";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createRequestId, durationSince, logger } from "@/lib/logger";

export const runtime = "nodejs";

const RequestSchema = z.object({
  script: z.string().min(5).max(12000),
  projectId: z.string().uuid().optional(),
  versionId: z.string().uuid().optional(),
  contentType: z.string().default("自动识别"),
  style: z.string().default("自动匹配文案气质"),
  duration: z.string().default("15秒"),
  provider: z.string().optional(),
  save: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const requestId = createRequestId("analyze");
  const startedAt = Date.now();
  const route = "/api/analyze";
  try {
    logger.info("api_request_started", { requestId, route, method: "POST" });
    const rateLimit = checkRateLimit({
      key: rateLimitKey(request, "analyze"),
      limit: Number(process.env.ANALYZE_RATE_LIMIT_PER_MINUTE || 20),
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      logger.warn("api_request_rate_limited", { requestId, route, resetAt: rateLimit.resetAt });
      return NextResponse.json({ ok: false, error: "请求太频繁，请稍后再试" }, { status: 429 });
    }

    const body = RequestSchema.parse(await request.json());
    logger.info("analyze_generation_started", {
      requestId,
      route,
      provider: body.provider || process.env.AI_PROVIDER || "mock",
      workflow: process.env.AI_WORKFLOW || "langgraph",
      scriptLength: body.script.length,
      saveRequested: body.save,
    });
    const directorContext = body.projectId
      ? await fetchDirectorContextFromNest(request, body.projectId, body.script)
      : "";
    const result = await analyzeScript({ ...body, requestId, directorContext });

    let saveMeta: any = { saved: false };
    if (body.save) {
      saveMeta = await saveAnalysisProjectToNest(request, body.script, result, body.projectId, body.versionId);
    }

    logger.info("api_request_completed", {
      requestId,
      route,
      durationMs: durationSince(startedAt),
      storyboardCount: result.storyboard.length,
      saved: Boolean(saveMeta.saved),
    });
    return NextResponse.json({ ok: true, result, save: saveMeta });
  } catch (error: any) {
    logger.error("api_request_failed", {
      requestId,
      route,
      durationMs: durationSince(startedAt),
      error,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to analyze script" },
      { status: 400 }
    );
  }
}
