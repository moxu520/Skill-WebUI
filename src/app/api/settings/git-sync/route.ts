import { NextResponse } from "next/server";
import { readGitSyncConfig, writeGitSyncConfig } from "@/lib/skills/git-sync-config";

/** 读取当前工作区的 Git 同步配置。 */
export async function GET() {
  try {
    const config = await readGitSyncConfig();
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载 Git 同步设置失败。" },
      { status: 500 },
    );
  }
}

/** 更新当前工作区的 Git 同步配置。 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      repositoryUrl?: string;
      branch?: string;
    };
    const config = await writeGitSyncConfig({
      repositoryUrl: body.repositoryUrl,
      branch: body.branch,
    });

    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存 Git 同步设置失败。" },
      { status: 400 },
    );
  }
}
