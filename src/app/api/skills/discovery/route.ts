import { NextResponse } from "next/server";
import { listDiscoveredSkills } from "@/lib/skills/discovery";

/** 返回自动发现的可导入技能候选列表。 */
export async function GET() {
  try {
    const skills = await listDiscoveredSkills();
    return NextResponse.json({ skills });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载扫描结果失败。" },
      { status: 500 },
    );
  }
}
