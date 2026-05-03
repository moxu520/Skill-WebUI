import { NextResponse } from "next/server";
import { importMarketplaceSkill } from "@/lib/skills/marketplace";
import type { MarketSourceId } from "@/lib/types";

/** 单次市场导入请求的输入结构。 */
type MarketImportRequest = {
  source?: MarketSourceId;
  skillUrl?: string;
  repositoryUrl?: string;
};

/** 从技能市场直接导入单个技能。 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MarketImportRequest;
    const skill = await importMarketplaceSkill({
      source: body.source,
      skillUrl: body.skillUrl ?? "",
      repositoryUrl: body.repositoryUrl,
    });

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导入市场技能失败。" },
      { status: 400 },
    );
  }
}
