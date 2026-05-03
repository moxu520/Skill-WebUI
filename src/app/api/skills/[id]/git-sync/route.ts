import { NextResponse } from "next/server";
import { getSkillGitSyncStatus } from "@/lib/skills/git-sync";

/** 读取单个 Skill 的 Git 同步状态。 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const gitSync = await getSkillGitSyncStatus(id);
    return NextResponse.json({ gitSync });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载 Git 同步状态失败。" },
      { status: 400 },
    );
  }
}
