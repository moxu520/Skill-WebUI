import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { discoverGitSkills, importGitSkill } from "@/lib/skills/skill-repository";
import { sanitizeSkillId } from "@/lib/skills/path-guard";
import type {
  MarketAuditStatus,
  MarketRanking,
  MarketSkillCollection,
  MarketSkillDetail,
  MarketSkillSummary,
  MarketSourceId,
} from "@/lib/types";

const MARKET_CACHE_DIRECTORY = path.join(process.cwd(), ".skill-webui");
const MARKET_CACHE_PATH = path.join(MARKET_CACHE_DIRECTORY, "market-cache.json");
const SKILLS_SH_BASE_URL = "https://skills.sh";
const MARKET_FETCH_HEADERS = {
  accept: "text/html,application/xhtml+xml",
  "user-agent": "Skill-WebUI/0.1 (+https://skills.sh)",
} as const;
const RANKING_ROUTE_MAP: Record<Exclude<MarketRanking, "newest">, string> = {
  all_time: "/",
  trending: "/trending",
  hot: "/hot",
};
const NEWEST_DETAIL_SAMPLE_SIZE = 36;
const DEFAULT_MARKET_PAGE_SIZE = 50;

/** 市场缓存文件中单个榜单条目的持久化结构。 */
type MarketCacheCollectionRecord = {
  fetchedAt: string;
  data: MarketSkillCollection;
};

/** 市场缓存文件中单个详情条目的持久化结构。 */
type MarketCacheDetailRecord = {
  fetchedAt: string;
  data: MarketSkillDetail;
};

/** 市场缓存文件的整体结构。 */
type MarketCacheDocument = {
  collections: Record<string, MarketCacheCollectionRecord>;
  details: Record<string, MarketCacheDetailRecord>;
};

/** skills.sh 榜单页里嵌入的轻量列表项结构。 */
type SkillsShLeaderboardItem = {
  source: string;
  skillId: string;
  name: string;
  installs: number;
};

/** 将榜单键统一编码成缓存可用的稳定字符串。 */
function createCollectionCacheKey(source: MarketSourceId, ranking: MarketRanking) {
  return `${source}:${ranking}`;
}

/** 将详情链接统一编码成缓存可用的稳定字符串。 */
function createDetailCacheKey(source: MarketSourceId, skillUrl: string) {
  return `${source}:${skillUrl.trim()}`;
}

/** 将外部来源和榜单转换为人类可读的标题。 */
export function getMarketRankingLabel(ranking: MarketRanking) {
  if (ranking === "all_time") {
    return "All Time";
  }

  if (ranking === "trending") {
    return "Trending";
  }

  if (ranking === "hot") {
    return "Hot";
  }

  return "Newest";
}

/** 将页码和页长规范化为安全可用的正整数。 */
function normalizePagination(page = 1, pageSize = DEFAULT_MARKET_PAGE_SIZE) {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const safePageSize = Math.max(1, Math.min(100, Math.trunc(pageSize) || DEFAULT_MARKET_PAGE_SIZE));

  return {
    page: safePage,
    pageSize: safePageSize,
  };
}

/** 从完整榜单中裁出当前页结果，并附带分页元信息。 */
function paginateCollection(
  base: Omit<MarketSkillCollection, "items" | "page" | "pageSize" | "hasMore" | "total"> & {
    items: MarketSkillSummary[];
  },
  page: number,
  pageSize: number,
): MarketSkillCollection {
  const normalized = normalizePagination(page, pageSize);
  const startIndex = (normalized.page - 1) * normalized.pageSize;
  const endIndex = startIndex + normalized.pageSize;
  const items = base.items.slice(startIndex, endIndex);

  return {
    ...base,
    items,
    total: base.items.length,
    page: normalized.page,
    pageSize: normalized.pageSize,
    hasMore: endIndex < base.items.length,
  };
}

/** 确保市场缓存文件所在目录存在。 */
async function ensureMarketCacheDirectory() {
  await mkdir(MARKET_CACHE_DIRECTORY, { recursive: true });
}

/** 读取市场缓存文件，损坏或缺失时回退到空结构。 */
async function readMarketCacheDocument(): Promise<MarketCacheDocument> {
  try {
    const raw = await readFile(MARKET_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<MarketCacheDocument>;

    return {
      collections:
        parsed.collections && typeof parsed.collections === "object"
          ? parsed.collections
          : {},
      details:
        parsed.details && typeof parsed.details === "object" ? parsed.details : {},
    };
  } catch {
    return {
      collections: {},
      details: {},
    };
  }
}

/** 将市场缓存写回本地文件，便于后续直接命中。 */
async function writeMarketCacheDocument(document: MarketCacheDocument) {
  await ensureMarketCacheDirectory();
  await writeFile(MARKET_CACHE_PATH, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

/** 将 HTML 数字缩写文本解析成可排序的整数。 */
function parseCompactNumber(input: string) {
  const normalized = input.trim().toUpperCase().replace(/,/g, "");
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/);

  if (!match) {
    const fallback = Number(normalized);
    return Number.isFinite(fallback) ? fallback : null;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(value)) {
    return null;
  }

  if (unit === "K") {
    return Math.round(value * 1_000);
  }

  if (unit === "M") {
    return Math.round(value * 1_000_000);
  }

  if (unit === "B") {
    return Math.round(value * 1_000_000_000);
  }

  return Math.round(value);
}

/** 将 HTML 实体反解码为普通文本。 */
function decodeHtmlEntities(input: string) {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** 将文本中的多余空白与 HTML 标签去掉，生成可搜索的纯文本。 */
function stripHtml(input: string) {
  return decodeHtmlEntities(input)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** 将 flight 字符串中的转义片段反解码为原始 HTML。 */
function decodeFlightEscapedString(input: string) {
  try {
    return JSON.parse(`"${input.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`) as string;
  } catch {
    return decodeHtmlEntities(
      input
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\"),
    );
  }
}

/** 将技能详情页上的相对或绝对链接标准化成完整 URL。 */
function toAbsoluteSkillsShUrl(input: string) {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }

  return new URL(input, SKILLS_SH_BASE_URL).toString();
}

/** 从 skills.sh 条目路径中解析拥有者、仓库和 skill slug。 */
function parseSkillUrl(skillUrl: string) {
  const url = new URL(skillUrl);
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length < 3) {
    throw new Error("技能市场条目的链接格式不正确。");
  }

  return {
    owner: segments[0],
    repository: segments[1],
    slug: segments[2],
  };
}

/** 将 skills.sh 的仓库标识拆成拥有者与仓库名。 */
function splitRepositorySource(source: string) {
  const [owner = "", repository = ""] = source.split("/", 2);
  return {
    owner,
    repository,
    repositoryLabel: source,
    repositoryUrl: `https://github.com/${source}`,
  };
}

/** 将 skills.sh 榜单条目映射为工作区统一使用的市场摘要。 */
function buildSummaryFromLeaderboardItem(
  item: SkillsShLeaderboardItem,
  ranking: MarketRanking,
  rank: number,
  updatedAt: string,
): MarketSkillSummary {
  const repository = splitRepositorySource(item.source);
  const detailUrl = `${SKILLS_SH_BASE_URL}/${item.source}/${item.skillId}`;

  return {
    source: "skills_sh",
    ranking,
    rank,
    name: item.name,
    slug: item.skillId,
    owner: repository.owner,
    repository: repository.repository,
    repositoryLabel: repository.repositoryLabel,
    repositoryUrl: repository.repositoryUrl,
    detailUrl,
    installCommand: `npx skills add ${repository.repositoryUrl} --skill ${item.skillId}`,
    description: "",
    tags: [],
    weeklyInstalls: item.installs,
    weeklyInstallsLabel: new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(item.installs),
    stars: null,
    starsLabel: "—",
    firstSeenAt: "",
    firstSeenLabel: "Unknown",
    auditsCount: 0,
    updatedAt,
    canImport: true,
    importReason: "可从对应 Git 仓库导入。",
  };
}

/** 通过 skills.sh 榜单页的 flight 数据提取轻量列表信息。 */
function parseSkillsShLeaderboardPage(html: string, ranking: MarketRanking) {
  const matches = [
    ...html.matchAll(
      /\{\\\"source\\\":\\\"([^\\"]+)\\\",\\\"skillId\\\":\\\"([^\\"]+)\\\",\\\"name\\\":\\\"([^\\"]+)\\\",\\\"installs\\\":([0-9]+)\}/g,
    ),
  ];

  if (!matches.length) {
    throw new Error("无法解析技能市场榜单数据。");
  }

  const updatedAt = new Date().toISOString();

  return matches.map((match, index) =>
    buildSummaryFromLeaderboardItem(
      {
        source: match[1],
        skillId: match[2],
        name: decodeHtmlEntities(match[3]),
        installs: Number(match[4]),
      },
      ranking,
      index + 1,
      updatedAt,
    ),
  );
}

/** 从详情页正文中提取安全审计信息。 */
function parseAuditSummaries(html: string) {
  const matches = [
    ...html.matchAll(
      /href="([^"]+\/security\/[^"]+)"[\s\S]*?<span class="text-sm font-medium text-foreground truncate">([^<]+)<\/span>[\s\S]*?<span class="text-xs font-mono uppercase[^"]*">([^<]+)<\/span>/g,
    ),
  ];

  return matches.map((match) => {
    const label = match[3].trim().toLowerCase();
    let status: MarketAuditStatus = "unknown";

    if (label === "pass") {
      status = "pass";
    } else if (label === "warn") {
      status = "warn";
    } else if (label === "fail") {
      status = "fail";
    }

    return {
      name: decodeHtmlEntities(match[2].trim()),
      status,
      href: toAbsoluteSkillsShUrl(match[1]),
    };
  });
}

/** 从详情页 flight 片段中提取 summary 与 SKILL.md 的 HTML 内容。 */
function parseDetailHtmlBlocks(html: string) {
  const htmlMatches = [
    ...html.matchAll(/dangerouslySetInnerHTML\":\{\"__html\":\"([\s\S]*?)\"\}/g),
  ].map((match) => decodeFlightEscapedString(match[1]));

  return {
    summaryHtml: htmlMatches[0] ?? "",
    skillHtml: htmlMatches.at(-1) ?? "",
  };
}

/** 将 “Today / 3 days ago” 之类的时间文本转换成 ISO 字符串。 */
function parseFirstSeenLabel(input: string, now = new Date()) {
  const normalized = input.trim().toLowerCase();

  if (!normalized || normalized === "unknown") {
    return "";
  }

  if (normalized === "today") {
    return now.toISOString();
  }

  if (normalized === "yesterday") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }

  const match = normalized.match(/^([0-9]+)\s+(day|days|week|weeks|month|months|year|years)\s+ago$/);

  if (!match) {
    return "";
  }

  const amount = Number(match[1]);
  const unit = match[2];
  let days = 0;

  if (unit.startsWith("day")) {
    days = amount;
  } else if (unit.startsWith("week")) {
    days = amount * 7;
  } else if (unit.startsWith("month")) {
    days = amount * 30;
  } else if (unit.startsWith("year")) {
    days = amount * 365;
  }

  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** 从详情页中解析出工作区展示与导入需要的字段。 */
function parseSkillsShDetailPage(
  html: string,
  fallbackSummary: MarketSkillSummary,
  sourceRanking: MarketRanking,
): MarketSkillDetail {
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const installCommandMatch = html.match(/npx skills add[\s\S]*?<\/code>/);
  const repositoryMatch = html.match(
    /<a href="(https:\/\/github\.com\/[^"]+)"[^>]*title="([^"]+)"/,
  );
  const weeklyInstallsMatch = html.match(
    /<span>Weekly Installs<\/span><\/div><div class="text-3xl font-semibold font-mono tracking-tight text-foreground">([^<]+)<\/div>/,
  );
  const starsMatch = html.match(
    /<span>GitHub Stars<\/span><\/div><div class="flex items-center gap-1\.5 text-sm font-mono text-foreground">[\s\S]*?<span>([^<]+)<\/span><\/div>/,
  );
  const firstSeenMatch = html.match(
    /<span>First Seen<\/span><\/div><div class="text-sm font-mono text-foreground">([^<]+)<\/div>/,
  );
  const { summaryHtml, skillHtml } = parseDetailHtmlBlocks(html);
  const audits = parseAuditSummaries(html);
  const summaryText = stripHtml(summaryHtml);
  const skillBodyText = stripHtml(skillHtml);
  const externalLinks = [
    ...new Set(
      [...html.matchAll(/href="(https:\/\/[^"]+)"/g)].map((match) => match[1].trim()),
    ),
  ];
  const repositoryUrl = repositoryMatch?.[1] ?? fallbackSummary.repositoryUrl;
  const repositoryLabel = repositoryMatch?.[2] ?? fallbackSummary.repositoryLabel;
  const parsedCommand = stripHtml(installCommandMatch?.[0] ?? "").replace(/^\$\s*/, "");
  const weeklyInstallsLabel = decodeHtmlEntities(
    weeklyInstallsMatch?.[1]?.trim() ?? fallbackSummary.weeklyInstallsLabel,
  );
  const starsLabel = decodeHtmlEntities(starsMatch?.[1]?.trim() ?? fallbackSummary.starsLabel);
  const firstSeenLabel = decodeHtmlEntities(
    firstSeenMatch?.[1]?.trim() ?? fallbackSummary.firstSeenLabel,
  );
  const detailUrl = fallbackSummary.detailUrl;
  const parsedUrl = parseSkillUrl(detailUrl);

  return {
    ...fallbackSummary,
    ranking: sourceRanking,
    name: decodeHtmlEntities(titleMatch?.[1]?.trim() ?? fallbackSummary.name),
    slug: parsedUrl.slug,
    owner: parsedUrl.owner,
    repository: parsedUrl.repository,
    repositoryLabel,
    repositoryUrl,
    detailUrl,
    installCommand: parsedCommand || fallbackSummary.installCommand,
    description: summaryText.split("\n")[0] ?? fallbackSummary.description,
    weeklyInstalls: parseCompactNumber(weeklyInstallsLabel),
    weeklyInstallsLabel,
    stars: parseCompactNumber(starsLabel),
    starsLabel,
    firstSeenAt: parseFirstSeenLabel(firstSeenLabel),
    firstSeenLabel,
    auditsCount: audits.length,
    canImport: Boolean(repositoryUrl),
    importReason: repositoryUrl ? "可从对应 Git 仓库导入。" : "当前条目未提供仓库地址。",
    summaryText,
    skillBodyText,
    audits,
    externalLinks,
  };
}

/** 读取 skills.sh 的 HTML，并在失败时抛出明确错误。 */
async function fetchSkillsShHtml(routeOrUrl: string) {
  const targetUrl = routeOrUrl.startsWith("http")
    ? routeOrUrl
    : `${SKILLS_SH_BASE_URL}${routeOrUrl}`;
  const response = await fetch(targetUrl, {
    cache: "no-store",
    headers: MARKET_FETCH_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`技能市场请求失败（${response.status}）。`);
  }

  return response.text();
}

/** 按榜单类型从 skills.sh 拉取并解析列表数据。 */
async function fetchSkillsShRanking(ranking: Exclude<MarketRanking, "newest">) {
  const html = await fetchSkillsShHtml(RANKING_ROUTE_MAP[ranking]);
  return parseSkillsShLeaderboardPage(html, ranking);
}

/** 使用 all_time / trending / hot 的明细样本推导 newest 榜单。 */
async function buildNewestRanking() {
  const [allTime, trending, hot] = await Promise.all([
    fetchSkillsShRanking("all_time"),
    fetchSkillsShRanking("trending"),
    fetchSkillsShRanking("hot"),
  ]);
  const candidates = [...trending, ...hot, ...allTime];
  const deduped = new Map<string, MarketSkillSummary>();

  for (const item of candidates) {
    if (!deduped.has(item.detailUrl)) {
      deduped.set(item.detailUrl, item);
    }

    if (deduped.size >= NEWEST_DETAIL_SAMPLE_SIZE) {
      break;
    }
  }

  const details = await Promise.all(
    [...deduped.values()].map(async (item) => {
      try {
        return await fetchMarketSkillDetail({
          source: "skills_sh",
          skillUrl: item.detailUrl,
          ranking: "newest",
          fallback: item,
          refresh: true,
        });
      } catch {
        return {
          ...item,
          ranking: "newest",
          summaryText: item.description,
          skillBodyText: "",
          audits: [],
          externalLinks: [item.detailUrl, item.repositoryUrl],
        } satisfies MarketSkillDetail;
      }
    }),
  );

  const now = new Date().toISOString();

  return details
    .sort((a, b) => {
      if (a.firstSeenAt && b.firstSeenAt) {
        return b.firstSeenAt.localeCompare(a.firstSeenAt);
      }

      if (a.firstSeenAt) {
        return -1;
      }

      if (b.firstSeenAt) {
        return 1;
      }

      return (b.weeklyInstalls ?? 0) - (a.weeklyInstalls ?? 0);
    })
    .map(
      (item, index): MarketSkillSummary => ({
        ...item,
        ranking: "newest",
        rank: index + 1,
        updatedAt: now,
      }),
    );
}

/** 读取某个榜单，支持缓存命中与强制刷新。 */
export async function listMarketplaceSkills(options?: {
  source?: MarketSourceId;
  ranking?: MarketRanking;
  refresh?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const source = options?.source ?? "skills_sh";
  const ranking = options?.ranking ?? "trending";
  const refresh = options?.refresh ?? false;
  const normalized = normalizePagination(options?.page, options?.pageSize);
  const cacheKey = createCollectionCacheKey(source, ranking);
  const document = await readMarketCacheDocument();
  const cached = document.collections[cacheKey]?.data;

  if (!refresh && cached) {
    return paginateCollection(cached, normalized.page, normalized.pageSize);
  }

  try {
    const items =
      ranking === "newest"
        ? await buildNewestRanking()
        : await fetchSkillsShRanking(ranking);
    const collection: MarketSkillCollection = {
      source,
      ranking,
      fetchedAt: new Date().toISOString(),
      items,
      total: items.length,
      page: 1,
      pageSize: items.length || DEFAULT_MARKET_PAGE_SIZE,
      hasMore: false,
    };

    document.collections[cacheKey] = {
      fetchedAt: collection.fetchedAt,
      data: collection,
    };
    await writeMarketCacheDocument(document);

    return paginateCollection(collection, normalized.page, normalized.pageSize);
  } catch (error) {
    if (cached) {
      return paginateCollection(
        {
        ...cached,
        error: error instanceof Error ? error.message : "刷新技能市场失败。",
        },
        normalized.page,
        normalized.pageSize,
      );
    }

    return {
      source,
      ranking,
      fetchedAt: new Date().toISOString(),
      items: [],
      total: 0,
      page: normalized.page,
      pageSize: normalized.pageSize,
      hasMore: false,
      error: error instanceof Error ? error.message : "加载技能市场失败。",
    } satisfies MarketSkillCollection;
  }
}

/** 读取单个市场条目的详情信息，支持缓存命中与强制刷新。 */
export async function fetchMarketSkillDetail(options: {
  source?: MarketSourceId;
  skillUrl: string;
  repositoryUrl?: string;
  ranking?: MarketRanking;
  fallback?: MarketSkillSummary;
  refresh?: boolean;
}) {
  const source = options.source ?? "skills_sh";
  const refresh = options.refresh ?? false;
  const cacheKey = createDetailCacheKey(source, options.skillUrl);
  const document = await readMarketCacheDocument();
  const cached = document.details[cacheKey]?.data;

  if (!refresh && cached) {
    return cached;
  }

  const parsedUrl = parseSkillUrl(options.skillUrl);
  const fallback =
    options.fallback ??
    ({
      source,
      ranking: options.ranking ?? "trending",
      rank: 0,
      name: parsedUrl.slug,
      slug: parsedUrl.slug,
      owner: parsedUrl.owner,
      repository: parsedUrl.repository,
      repositoryLabel: `${parsedUrl.owner}/${parsedUrl.repository}`,
      repositoryUrl:
        options.repositoryUrl ??
        `https://github.com/${parsedUrl.owner}/${parsedUrl.repository}`,
      detailUrl: toAbsoluteSkillsShUrl(options.skillUrl),
      installCommand: `npx skills add https://github.com/${parsedUrl.owner}/${parsedUrl.repository} --skill ${parsedUrl.slug}`,
      description: "",
      tags: [],
      weeklyInstalls: null,
      weeklyInstallsLabel: "—",
      stars: null,
      starsLabel: "—",
      firstSeenAt: "",
      firstSeenLabel: "Unknown",
      auditsCount: 0,
      updatedAt: new Date().toISOString(),
      canImport: true,
      importReason: "可从对应 Git 仓库导入。",
    } satisfies MarketSkillSummary);

  const html = await fetchSkillsShHtml(fallback.detailUrl);
  const detail = parseSkillsShDetailPage(
    html,
    fallback,
    options.ranking ?? fallback.ranking,
  );

  document.details[cacheKey] = {
    fetchedAt: new Date().toISOString(),
    data: detail,
  };
  await writeMarketCacheDocument(document);

  return detail;
}

/** 尝试将 skills.sh 详情页对应的 skill 直接导入到本地受管目录。 */
export async function importMarketplaceSkill(input: {
  source?: MarketSourceId;
  skillUrl: string;
  repositoryUrl?: string;
}) {
  const source = input.source ?? "skills_sh";

  if (source !== "skills_sh") {
    throw new Error("暂不支持这个技能市场来源。");
  }

  const detail = await fetchMarketSkillDetail({
    source,
    skillUrl: input.skillUrl,
    repositoryUrl: input.repositoryUrl,
    refresh: true,
  });

  if (!detail.repositoryUrl) {
    throw new Error("该市场条目没有可用的仓库地址，无法导入。");
  }

  const targetSlug = sanitizeSkillId(detail.slug);
  const discovery = await discoverGitSkills(detail.repositoryUrl);
  const matched = discovery.skills.filter((skill) => skill.id === targetSlug);

  if (!matched.length) {
    throw new Error("仓库扫描完成，但没有找到与市场条目完全匹配的技能目录。");
  }

  if (matched.length > 1) {
    throw new Error("仓库内存在多个同名技能目录，无法安全导入。");
  }

  const candidate = matched[0];

  if (candidate.status !== "importable") {
    throw new Error(candidate.statusReason);
  }

  if (!candidate.sessionId || !candidate.relativeSkillPath) {
    throw new Error("仓库扫描结果不完整，请稍后重试。");
  }

  return importGitSkill(candidate.sessionId, candidate.relativeSkillPath);
}
