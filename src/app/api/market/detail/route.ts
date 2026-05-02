import { NextResponse, type NextRequest } from "next/server";
import { fetchMarketSkillDetail } from "@/lib/skills/marketplace";
import type { MarketRanking, MarketSourceId } from "@/lib/types";

/** 校验详情查询中的市场来源，非法值回退到默认来源。 */
function parseSource(input: string | null): MarketSourceId {
  return input === "skills_sh" ? input : "skills_sh";
}

/** 校验详情查询中的榜单类型，非法值回退到默认榜单。 */
function parseRanking(input: string | null): MarketRanking {
  if (input === "hot" || input === "all_time" || input === "newest") {
    return input;
  }

  return "trending";
}

/** 读取单个市场技能的详情内容。 */
export async function GET(request: NextRequest) {
  try {
    const skillUrl = request.nextUrl.searchParams.get("skillUrl") ?? "";

    if (!skillUrl.trim()) {
      throw new Error("技能详情链接不能为空。");
    }

    const detail = await fetchMarketSkillDetail({
      source: parseSource(request.nextUrl.searchParams.get("source")),
      ranking: parseRanking(request.nextUrl.searchParams.get("ranking")),
      skillUrl,
      repositoryUrl: request.nextUrl.searchParams.get("repositoryUrl") ?? undefined,
      refresh: request.nextUrl.searchParams.get("refresh") === "1",
    });

    return NextResponse.json({ detail }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载技能详情失败。" },
      { status: 400 },
    );
  }
}
