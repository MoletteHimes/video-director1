import { NextRequest } from "next/server";
import { proxyNestProjectGet } from "@/lib/nest-projects-proxy";

export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const params = await context.params;
  return proxyNestProjectGet(request, params.projectId);
}
