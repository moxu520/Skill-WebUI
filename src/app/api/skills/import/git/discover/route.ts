import { NextResponse } from "next/server";
import { discoverGitSkills } from "@/lib/skills/skill-repository";

/** 扫描指定 Git 仓库默认分支中的全部 Skill 候选。 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { repositoryUrl?: string; branch?: string };
    const result = await discoverGitSkills(body.repositoryUrl ?? "", body.branch);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "扫描 Git 仓库失败。" },
      { status: 400 },
    );
  }
}
