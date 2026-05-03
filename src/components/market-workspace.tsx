"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  ExternalLink,
  Flame,
  LoaderCircle,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/components/ui/toast";
import { getMarketRankingLabel } from "@/lib/market/ranking";
import { cn } from "@/lib/utils";
import type {
  MarketRanking,
  MarketSkillCollection,
  MarketSkillDetail,
  MarketSkillSummary,
} from "@/lib/types";

/** 市场详情接口的成功返回结构。 */
type MarketDetailResponse = {
  detail: MarketSkillDetail;
};

/** 市场导入接口与本地导入接口共享的成功结构。 */
type MarketImportResponse = {
  skill?: {
    id: string;
    name: string;
  };
  error?: string;
};

/** 将缓存时间格式化成界面中使用的短时间文本。 */
function formatTimestamp(input: string) {
  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return input;
  }

  if (date.getTime() === 0) {
    return "未缓存";
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((accumulator, part) => {
      if (part.type !== "literal") {
        accumulator[part.type] = part.value;
      }

      return accumulator;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** 将多行文本裁成较短摘要，避免详情侧栏过长。 */
function clampText(input: string, maxLength: number) {
  const normalized = input.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/** 榜单切换按钮的视觉标签与图标。 */
const rankingOptions: Array<{
  value: MarketRanking;
  label: string;
  icon: typeof TrendingUp;
}> = [
  { value: "trending", label: "趋势", icon: TrendingUp },
  { value: "hot", label: "热门", icon: Flame },
  { value: "all_time", label: "总榜", icon: Download },
  { value: "newest", label: "最新", icon: RefreshCw },
];

/** 返回榜单列表卡片中第一指标的中文标签。 */
function getPrimaryMetricLabel(skill: MarketSkillSummary) {
  if (skill.ranking === "hot") {
    return `热度 ${skill.weeklyInstallsLabel}`;
  }

  return `周安装 ${skill.weeklyInstallsLabel}`;
}

/** 技能市场主工作区，负责榜单切换、详情拉取与一键导入。 */
export function MarketWorkspace({
  initialCollection,
}: {
  initialCollection: MarketSkillCollection;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [overrideCollection, setOverrideCollection] = useState<MarketSkillCollection | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState(initialCollection.items[0]?.detailUrl ?? "");
  const [detailCache, setDetailCache] = useState<Record<string, MarketSkillDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeImportUrl, setActiveImportUrl] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const listScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const hasRequestedInitialCollectionRef = useRef(false);
  const collection = overrideCollection ?? initialCollection;
  const ranking = collection.ranking;

  /** 在榜单切换后同步更新 URL，让服务端页面重新预加载对应榜单。 */
  const updateRankingInUrl = useCallback(
    (nextRanking: MarketRanking) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextRanking === "trending") {
        params.delete("ranking");
      } else {
        params.set("ranking", nextRanking);
      }

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /** 按当前榜单重新抓取市场数据，并覆盖当前页面上的缓存结果。 */
  const loadCollection = useCallback(
    async ({
      refresh = false,
      page = 1,
      append = false,
    }: {
      refresh?: boolean;
      page?: number;
      append?: boolean;
    } = {}) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingCollection(true);
      }

      const response = await fetch(
        `/api/market?source=skills_sh&ranking=${encodeURIComponent(
          ranking,
        )}&refresh=${refresh ? "1" : "0"}&page=${page}&pageSize=${collection.pageSize}`,
      );
      const payload = (await response.json()) as Partial<MarketSkillCollection> & {
        error?: string;
      };

      if (!response.ok || !payload.items || !payload.fetchedAt || !payload.ranking) {
        toast({
          title: refresh ? "刷新技能市场失败" : "加载技能市场失败",
          description: payload.error ?? "技能市场加载失败。",
          variant: "error",
        });
        setLoadingCollection(false);
        setLoadingMore(false);
        return;
      }

      const nextCollection = {
        source: "skills_sh",
        ranking: payload.ranking,
        fetchedAt: payload.fetchedAt,
        items: append ? [...collection.items, ...payload.items] : payload.items,
        total: payload.total ?? payload.items.length,
        page: payload.page ?? page,
        pageSize: payload.pageSize ?? collection.pageSize,
        hasMore: payload.hasMore ?? false,
        error: payload.error,
      } satisfies MarketSkillCollection;

      setOverrideCollection(nextCollection);
      setLoadingCollection(false);
      setLoadingMore(false);

      if (!selectedUrl || !nextCollection.items.some((item) => item.detailUrl === selectedUrl)) {
        setSelectedUrl(payload.items[0]?.detailUrl ?? "");
      }

      if (payload.error && refresh) {
        toast({
          title: "刷新失败，已显示缓存数据",
          description: payload.error,
          variant: "error",
        });
      }
    },
    [collection.items, collection.pageSize, ranking, selectedUrl, toast],
  );

  /** 首屏若未命中缓存，则在客户端挂载后补拉当前榜单。 */
  useEffect(() => {
    if (collection.items.length || hasRequestedInitialCollectionRef.current) {
      return;
    }

    hasRequestedInitialCollectionRef.current = true;
    void loadCollection({ page: 1 });
  }, [collection.items.length, loadCollection]);

  /** 拉取当前选中市场条目的详情。 */
  useEffect(() => {
    if (!selectedUrl || detailCache[selectedUrl]) {
      return;
    }

    const selectedSummary = collection.items.find((item) => item.detailUrl === selectedUrl);

    if (!selectedSummary) {
      return;
    }

    const summary = selectedSummary;

    let cancelled = false;

    async function loadDetail() {
      setLoadingDetail(true);

      const response = await fetch(
        `/api/market/detail?source=skills_sh&ranking=${encodeURIComponent(
          ranking,
        )}&skillUrl=${encodeURIComponent(summary.detailUrl)}&repositoryUrl=${encodeURIComponent(
          summary.repositoryUrl,
        )}`,
      );
      const payload = (await response.json()) as Partial<MarketDetailResponse> & {
        error?: string;
      };

      if (cancelled) {
        return;
      }

      if (!response.ok || !payload.detail) {
        toast({
          title: "加载技能详情失败",
          description: payload.error ?? "技能详情加载失败。",
          variant: "error",
        });
        setLoadingDetail(false);
        return;
      }

      setDetailCache((current) => ({
        ...current,
        [summary.detailUrl]: payload.detail as MarketSkillDetail,
      }));
      setLoadingDetail(false);
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [collection.items, detailCache, ranking, selectedUrl, toast]);

  /** 搜索会同时命中名称、描述、仓库名与标签。 */
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return collection.items;
    }

    return collection.items.filter((item) => {
      const haystack = [
        item.name,
        item.description,
        item.owner,
        item.repository,
        item.repositoryLabel,
        ...item.tags,
      ]
        .join("\n")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [collection.items, search]);

  /** 当前展示的详情优先走已缓存详情，未命中时回退到列表项。 */
  const selectedDetail = useMemo(() => {
    if (!selectedUrl) {
      return null;
    }

    return (
      detailCache[selectedUrl] ??
      collection.items.find((item) => item.detailUrl === selectedUrl) ??
      null
    );
  }, [collection.items, detailCache, selectedUrl]);

  /** 当滚动接近列表底部时自动追加下一页。 */
  useEffect(() => {
    if (search.trim() || !collection.hasMore || loadingMore || loadingCollection) {
      return;
    }

    const scrollRoot = listScrollAreaRef.current;
    const sentinel = loadMoreSentinelRef.current;
    const viewport = scrollRoot?.querySelector("[data-radix-scroll-area-viewport]");

    if (!(viewport instanceof HTMLDivElement) || !(sentinel instanceof HTMLDivElement)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry?.isIntersecting || loadingMore || loadingCollection) {
          return;
        }

        void loadCollection({
          page: collection.page + 1,
          append: true,
        });
      },
      {
        root: viewport,
        rootMargin: "0px 0px 240px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    collection.hasMore,
    collection.page,
    loadCollection,
    loadingCollection,
    loadingMore,
    search,
  ]);

  /** 让列表卡片支持键盘选择，保持与点击行为一致。 */
  function handleCardKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
    detailUrl: string,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    setSelectedUrl(detailUrl);
  }

  /** 用户切换榜单时同步更新本地状态与地址栏。 */
  function handleRankingChange(nextRanking: string) {
    if (
      nextRanking !== "trending" &&
      nextRanking !== "hot" &&
      nextRanking !== "all_time" &&
      nextRanking !== "newest"
    ) {
      return;
    }

    updateRankingInUrl(nextRanking);
  }

  /** 直接从市场条目发起导入，并在成功后跳转到本地技能详情。 */
  async function handleImport(skill: MarketSkillSummary | MarketSkillDetail) {
    setActiveImportUrl(skill.detailUrl);

    const response = await fetch("/api/market/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "skills_sh",
        skillUrl: skill.detailUrl,
        repositoryUrl: skill.repositoryUrl,
      }),
    });
    const payload = (await response.json()) as MarketImportResponse;

    setActiveImportUrl("");

    if (!response.ok || !payload.skill) {
      toast({
        title: "导入失败",
        description: payload.error ?? "导入市场技能失败。",
        variant: "error",
      });
      return;
    }

    toast({
      title: "技能已导入",
      description: `已导入 ${payload.skill.name}。`,
      variant: "success",
    });
    router.push(`/skills?skill=${encodeURIComponent(payload.skill.id)}`);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5 lg:p-8">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">技能市场</h2>
              <p className="text-sm text-slate-500">
                从 skills.sh 浏览主流技能，并直接导入到当前本地工作区。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 lg:w-72 lg:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索名称、仓库、标签"
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadCollection({ refresh: true, page: 1 })}
                disabled={loadingCollection}
              >
                {loadingCollection ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                刷新
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <ToggleGroup type="single" value={ranking} onValueChange={handleRankingChange}>
              {rankingOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <ToggleGroupItem key={option.value} value={option.value} className="gap-2">
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>缓存时间</span>
              <span className="font-mono text-slate-500">
                {formatTimestamp(collection.fetchedAt)}
              </span>
              <span className="font-mono text-slate-400">
                已加载 {collection.items.length}/{collection.total}
              </span>
              {collection.error ? (
                <Badge variant="muted" className="text-[11px]">
                  缓存回退
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_380px]">
          <ScrollArea
            ref={listScrollAreaRef}
            className="min-h-0 overflow-hidden border-b border-slate-200 lg:border-b-0 lg:border-r"
          >
            <div className="space-y-2 p-3">
              {filteredItems.length ? (
                filteredItems.map((item) => {
                  const isSelected = item.detailUrl === selectedUrl;
                  const isImporting = activeImportUrl === item.detailUrl;

                  return (
                    <div
                      key={item.detailUrl}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedUrl(item.detailUrl)}
                      onKeyDown={(event) => handleCardKeyDown(event, item.detailUrl)}
                      className={cn(
                        "w-full rounded-lg border px-4 py-3 text-left transition-colors",
                        isSelected
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 shrink-0 pt-0.5 text-center font-mono text-sm text-slate-400">
                          #{item.rank}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {item.name}
                            </p>
                            <Badge variant="muted">{getMarketRankingLabel(item.ranking)}</Badge>
                            {item.auditsCount > 0 ? (
                              <Badge variant="accent">{item.auditsCount} audits</Badge>
                            ) : null}
                          </div>

                          <p className="font-mono text-xs text-slate-500">
                            {item.repositoryLabel}
                          </p>

                          <p className="text-sm text-slate-600">
                            {item.description
                              ? clampText(item.description, 150)
                              : item.installCommand}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            <span>{getPrimaryMetricLabel(item)}</span>
                            <span>Stars {item.starsLabel}</span>
                            <span>首次收录 {item.firstSeenLabel}</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={!item.canImport || !!activeImportUrl}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleImport(item);
                            }}
                          >
                            {isImporting ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            导入
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
                  {loadingCollection ? (
                    <>
                      <div className="flex justify-center">
                        <LoaderCircle className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                      <p className="mt-3 text-sm font-medium text-slate-900">
                        正在加载市场技能
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        首屏优先展示工作区，榜单数据会在后台补齐。
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-900">
                        没有匹配的市场技能
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        换一个关键词，或者切换到别的榜单再看看。
                      </p>
                    </>
                  )}
                </div>
              )}

              {!search.trim() && collection.hasMore ? (
                <div ref={loadMoreSentinelRef} className="flex justify-center px-3 pb-3 pt-1">
                  {loadingMore ? (
                    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      正在加载更多
                    </div>
                  ) : (
                    <div className="h-6 w-full" aria-hidden="true" />
                  )}
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="flex min-h-0 flex-col overflow-hidden bg-slate-50/40">
            {selectedDetail ? (
              <>
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-slate-900">
                        {selectedDetail.name}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {selectedDetail.repositoryLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={selectedDetail.detailUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          查看来源
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!selectedDetail.canImport || !!activeImportUrl}
                        onClick={() => void handleImport(selectedDetail)}
                      >
                        {activeImportUrl === selectedDetail.detailUrl ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                        导入
                      </Button>
                    </div>
                  </div>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-5 px-5 py-4">
                    {loadingDetail && !detailCache[selectedDetail.detailUrl] ? (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        正在补充技能详情…
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Weekly Installs
                        </p>
                        <p className="mt-1 font-mono text-lg font-semibold text-slate-900">
                          {selectedDetail.weeklyInstallsLabel}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Stars</p>
                        <p className="mt-1 font-mono text-lg font-semibold text-slate-900">
                          {selectedDetail.starsLabel}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          First Seen
                        </p>
                        <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                          {selectedDetail.firstSeenLabel}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Audits</p>
                        <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                          {selectedDetail.auditsCount || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Summary</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {"summaryText" in selectedDetail && selectedDetail.summaryText
                          ? selectedDetail.summaryText
                          : selectedDetail.description || "暂无摘要。"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Install Command
                      </p>
                      <code className="mt-2 block overflow-x-auto rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        {selectedDetail.installCommand}
                      </code>
                    </div>

                    {"audits" in selectedDetail && selectedDetail.audits.length ? (
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Security Audits
                        </p>
                        <div className="mt-3 space-y-2">
                          {selectedDetail.audits.map((audit) => (
                            <Link
                              key={`${audit.name}-${audit.href}`}
                              href={audit.href}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <span className="truncate">{audit.name}</span>
                              <Badge
                                variant={
                                  audit.status === "pass"
                                    ? "accent"
                                    : audit.status === "warn"
                                      ? "default"
                                      : "muted"
                                }
                              >
                                {audit.status.toUpperCase()}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {"skillBodyText" in selectedDetail && selectedDetail.skillBodyText ? (
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          SKILL.md
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {clampText(selectedDetail.skillBodyText, 3200)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
                先从左侧选择一个技能，右侧会显示它的市场详情和导入入口。
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
