import { NextResponse, type NextRequest } from "next/server";
import { listMarketplaceSkills } from "@/lib/skills/marketplace";
import type { MarketRanking, MarketSourceId } from "@/lib/types";

/** 校验查询参数中的市场来源，非法值回退到默认来源。 */
function parseSource(input: string | null): MarketSourceId {
  return input === "skills_sh" ? input : "skills_sh";
}

/** 校验查询参数中的榜单类型，非法值回退到默认榜单。 */
function parseRanking(input: string | null): MarketRanking {
  if (input === "hot" || input === "all_time" || input === "newest") {
    return input;
  }

  return "trending";
}

/** 校验分页参数，非法值回退到默认值。 */
function parsePositiveInteger(input: string | null, fallback: number) {
  const value = Number(input);

  if (!Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.trunc(value);
}

/** 读取技能市场榜单数据，支持按榜单和刷新标记查询。 */
export async function GET(request: NextRequest) {
  try {
    const source = parseSource(request.nextUrl.searchParams.get("source"));
    const ranking = parseRanking(request.nextUrl.searchParams.get("ranking"));
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const page = parsePositiveInteger(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = parsePositiveInteger(request.nextUrl.searchParams.get("pageSize"), 50);
    const result = await listMarketplaceSkills({
      source,
      ranking,
      refresh,
      page,
      pageSize,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "加载技能市场失败。" },
      { status: 400 },
    );
  }
}
