import { NextResponse } from "next/server";
import { createSkill, listSkills } from "@/lib/skills/skill-repository";

export async function GET() {
  try {
    const skills = await listSkills();
    return NextResponse.json({ skills });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载技能列表失败。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const skill = await createSkill(body);
    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建技能失败。" },
      { status: 400 },
    );
  }
}
