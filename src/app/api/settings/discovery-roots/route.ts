import { NextResponse } from "next/server";
import {
  readScanRootConfig,
  writeScanRootConfig,
} from "@/lib/skills/discovery-config";

export async function GET() {
  try {
    const config = await readScanRootConfig();
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载扫描设置失败。" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { extraRoots?: unknown };
    const extraRoots = Array.isArray(body.extraRoots)
      ? body.extraRoots.filter((root): root is string => typeof root === "string")
      : [];
    const config = await writeScanRootConfig({ extraRoots });

    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存扫描设置失败。" },
      { status: 400 },
    );
  }
}
