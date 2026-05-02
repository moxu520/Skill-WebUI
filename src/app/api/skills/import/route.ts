import { NextResponse } from "next/server";
import { importSkill } from "@/lib/skills/skill-repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const skill = await importSkill(body);
    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导入技能失败。" },
      { status: 400 },
    );
  }
}
