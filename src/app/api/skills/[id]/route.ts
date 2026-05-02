import { NextResponse } from "next/server";
import {
  deleteSkill,
  getSkill,
  updateSkill,
} from "@/lib/skills/skill-repository";

/** 按技能标识读取单个技能详情。 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const skill = await getSkill(id);
    return NextResponse.json({ skill });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载技能详情失败。" },
      { status: 404 },
    );
  }
}

/** 按技能标识更新技能内容或目录标识。 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const skill = await updateSkill(id, body);
    return NextResponse.json({ skill });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新技能失败。" },
      { status: 400 },
    );
  }
}

/** 按技能标识删除整个技能目录。 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await deleteSkill(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除技能失败。" },
      { status: 400 },
    );
  }
}
