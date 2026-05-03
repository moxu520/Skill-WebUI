import { NextResponse } from "next/server";
import { getSkill } from "@/lib/skills/skill-repository";
import { pullSkillFromGit } from "@/lib/skills/git-sync";

/** 拉取远端仓库中的单个 Skill 到本地受管目录。 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { gitSync, activity } = await pullSkillFromGit(id);
    const skill = await getSkill(id);

    return NextResponse.json({ skill, gitSync, activity });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "拉取 Skill 失败。" },
      { status: 400 },
    );
  }
}
