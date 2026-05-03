import { NextResponse } from "next/server";
import { getSkill } from "@/lib/skills/skill-repository";
import { pushSkillToGit } from "@/lib/skills/git-sync";

/** 将本地受管目录中的单个 Skill 推送到远端仓库。 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { gitSync, activity } = await pushSkillToGit(id);
    const skill = await getSkill(id);

    return NextResponse.json({ skill, gitSync, activity });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "推送 Skill 失败。" },
      { status: 400 },
    );
  }
}
