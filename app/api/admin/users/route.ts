import { NextRequest } from "next/server";
import { proxyAdminUsersList } from "@/lib/nest-admin-proxy";

export async function GET(request: NextRequest) {
  return proxyAdminUsersList(request);
}
