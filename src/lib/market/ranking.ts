import type { MarketRanking } from "@/lib/types";

/** 将市场榜单标识映射为界面展示使用的中文标签。 */
export function getMarketRankingLabel(ranking: MarketRanking) {
  if (ranking === "all_time") {
    return "总榜";
  }

  if (ranking === "trending") {
    return "趋势";
  }

  if (ranking === "hot") {
    return "热门";
  }

  return "最新";
}
