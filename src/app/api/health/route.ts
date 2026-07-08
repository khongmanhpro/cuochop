import { NextResponse } from "next/server";
import { logInfo } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  logInfo({ route: "/api/health", message: "health check ok" });
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
