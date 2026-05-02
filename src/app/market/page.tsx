import { AppShell } from "@/components/app-shell";
import { MarketWorkspace } from "@/components/market-workspace";
import { readCachedMarketplaceSkills } from "@/lib/skills/marketplace";
import type { MarketRanking } from "@/lib/types";

/** 校验页面查询参数中的榜单类型，非法值回退到默认榜单。 */
function parseRanking(input: string | string[] | undefined): MarketRanking {
  if (input === "hot" || input === "all_time" || input === "newest") {
    return input;
  }

  return "trending";
}

/** 技能市场页面，首屏优先读取本地缓存，再交由客户端继续交互。 */
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ ranking?: string | string[] }>;
}) {
  const params = await searchParams;
  const ranking = parseRanking(params.ranking);
  const collection = await readCachedMarketplaceSkills({
    source: "skills_sh",
    ranking,
    page: 1,
    pageSize: 50,
  });

  return (
    <AppShell
      title="技能市场"
      description="从公开技能生态里搜刮近期热门、趋势走高与长期主流的技能。"
      currentPath="/market"
    >
      <MarketWorkspace key={ranking} initialCollection={collection} />
    </AppShell>
  );
}
