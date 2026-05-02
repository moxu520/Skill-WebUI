"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  Globe2,
  Grid2x2,
  HardDrive,
  Languages,
  List,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildSkillMarkdown,
  parseSkillMarkdown,
} from "@/lib/skills/skill-parser";
import type {
  SaveTranslatedSkillRequest,
  SkillDetail,
  SkillSummary,
  TranslateSkillInput,
  TranslationMeta,
  TranslationProviderCatalogItem,
  TranslationProviderId,
} from "@/lib/types";

type SortMode = "updated" | "name";
type ViewMode = "grid" | "list";

/** 技能详情接口的成功返回结构。 */
type SkillDetailResponse = {
  skill: SkillDetail;
};

/** 技能列表接口的成功返回结构。 */
type SkillsResponse = {
  skills: SkillSummary[];
};

/** 翻译接口的预览返回结构。 */
type TranslatePreviewResponse = {
  translatedSkill: {
    name: string;
    description: string;
    bodyMarkdown: string;
  };
  translationMeta: TranslationMeta;
};

/** 翻译接口的保存返回结构。 */
type SaveTranslatedSkillResponse = {
  skill: SkillDetail;
  translationMeta: TranslationMeta;
};

/** 翻译工作区组件参数。 */
type TranslationWorkspaceProps = {
  initialSkills: SkillSummary[];
  initialSelectedId?: string;
  providers: TranslationProviderCatalogItem[];
};

/** 带图标的下拉选项定义。 */
type DropdownOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
};

/** 将技能更新时间格式化为统一的工作区文本。 */
function formatDate(input: string) {
  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return input;
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

/** 带提示文本的图标按钮，确保纯图标操作仍有清晰语义。 */
function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** 统一风格的带图标下拉选择器。 */
function IconSelect<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onSelect: (value: T) => void;
}) {
  const selected = options.find((item) => item.value === value) ?? options[0];
  const SelectedIcon = selected.icon;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-between px-3"
          >
            <span className="flex min-w-0 items-center gap-2">
              <SelectedIcon className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="truncate">{selected.label}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {options.map((item) => {
            const ItemIcon = item.icon;
            const active = item.value === value;

            return (
              <DropdownMenuItem
                key={item.value}
                onSelect={() => onSelect(item.value)}
                className="gap-3 px-3 py-2"
              >
                <ItemIcon className="h-4 w-4 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">{item.label}</div>
                  {item.description ? (
                    <div className="mt-0.5 text-xs text-slate-500">
                      {item.description}
                    </div>
                  ) : null}
                </div>
                {active ? <Check className="h-4 w-4 shrink-0 text-sky-600" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** 翻译页面主工作区，复用技能页的布局密度与操作节奏。 */
export function TranslationWorkspace({
  initialSkills,
  initialSelectedId,
  providers,
}: TranslationWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const executableProviders = useMemo(
    () => providers.filter((provider) => provider.status === "available"),
    [providers],
  );
  const providerOptions = useMemo<DropdownOption<TranslationProviderId>[]>(() => {
    return executableProviders.map((provider) => ({
      value: provider.id,
      label: provider.label,
      description: provider.description,
      icon: provider.id === "google" ? Globe2 : HardDrive,
    }));
  }, [executableProviders]);
  const directionOptions = useMemo<
    DropdownOption<TranslateSkillInput["direction"]>[]
  >(
    () => [
      {
        value: "en-to-zh",
        label: "英文 -> 中文",
        description: "默认方向，适合把英文技能本地化到中文。",
        icon: Languages,
      },
      {
        value: "zh-to-en",
        label: "中文 -> 英文",
        description: "适合把中文技能翻译成英文版本。",
        icon: ArrowRightLeft,
      },
    ],
    [],
  );
  const [skills, setSkills] = useState(initialSkills);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("updated");
  const [view, setView] = useState<ViewMode>("grid");
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [translatedMarkdown, setTranslatedMarkdown] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [provider, setProvider] = useState<TranslationProviderId>("local_builtin");
  const [direction, setDirection] =
    useState<TranslateSkillInput["direction"]>("en-to-zh");
  const [lastTranslationMeta, setLastTranslationMeta] =
    useState<TranslationMeta | null>(null);
  const selectedId = searchParams.get("skill") ?? initialSelectedId ?? "";

  /** 根据当前选择读取技能详情。 */
  async function fetchSkillDetail(skillId: string) {
    const response = await fetch(`/api/skills/${encodeURIComponent(skillId)}`);
    const payload = (await response.json()) as Partial<SkillDetailResponse> & {
      error?: string;
    };

    return { response, payload };
  }

  /** 将所选技能同步到地址栏，保持状态可分享。 */
  function updateQuery(nextId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextId) {
      params.set("skill", nextId);
    } else {
      params.delete("skill");
      setSelectedSkill(null);
      setTranslatedMarkdown("");
      setLastTranslationMeta(null);
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  /** 主动刷新受管技能列表，并同步当前选中的详情。 */
  async function refreshSkills(nextSelectedId?: string) {
    setRefreshing(true);

    const response = await fetch("/api/skills");
    const payload = (await response.json()) as Partial<SkillsResponse> & {
      error?: string;
    };

    if (!response.ok) {
      toast({
        title: "刷新技能列表失败",
        description: payload.error ?? "刷新技能列表失败。",
        variant: "error",
      });
      setRefreshing(false);
      return;
    }

    const nextSkills = payload.skills ?? [];
    const activeId = nextSelectedId ?? selectedId;

    setSkills(nextSkills);

    if (!activeId) {
      setRefreshing(false);
      return;
    }

    const exists = nextSkills.some((skill) => skill.id === activeId);

    if (!exists) {
      updateQuery("");
      setRefreshing(false);
      return;
    }

    const detailResult = await fetchSkillDetail(activeId);

    if (detailResult.response.ok && detailResult.payload.skill) {
      setSelectedSkill(detailResult.payload.skill);
    }

    setRefreshing(false);
  }

  /** 当路由中的技能发生变化时，加载右侧详情并清空上一次翻译预览。 */
  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      setLoadingDetail(true);
      setTranslatedMarkdown("");
      setLastTranslationMeta(null);

      const { response, payload } = await fetchSkillDetail(selectedId);

      if (cancelled) {
        return;
      }

      if (!response.ok || !payload.skill) {
        setSelectedSkill(null);
        toast({
          title: "加载技能详情失败",
          description: payload.error ?? "技能详情返回无效。",
          variant: "error",
        });
        setLoadingDetail(false);
        return;
      }

      setSelectedSkill(payload.skill);
      setLoadingDetail(false);
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedId, toast]);

  /** 根据搜索词和排序规则生成当前翻译候选列表。 */
  const filteredSkills = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = skills.filter((skill) => {
      if (!normalizedSearch) {
        return true;
      }

      return [skill.name, skill.description, skill.path]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });

    next.sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }

      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return next;
  }, [search, skills, sort]);

  /** 执行翻译并更新右侧结果预览，但不直接落盘。 */
  async function handleTranslate() {
    if (!selectedId) {
      return;
    }

    setTranslating(true);
    const payload: TranslateSkillInput = {
      provider,
      direction,
    };
    const response = await fetch(`/api/skills/${encodeURIComponent(selectedId)}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as Partial<TranslatePreviewResponse> & {
      error?: string;
    };

    if (!response.ok || !result.translatedSkill || !result.translationMeta) {
      toast({
        title: "执行翻译失败",
        description: result.error ?? "执行翻译失败。",
        variant: "error",
      });
      setTranslating(false);
      return;
    }

    setTranslatedMarkdown(
      buildSkillMarkdown({
        title: result.translatedSkill.name,
        description: result.translatedSkill.description,
        bodyMarkdown: result.translatedSkill.bodyMarkdown,
      }),
    );
    setLastTranslationMeta(result.translationMeta);
    toast({
      title: "翻译已生成",
      description: "请确认结果后点击保存。",
      variant: "success",
    });
    setTranslating(false);
  }

  /** 将当前翻译预览按指定保存策略写回工作区。 */
  async function handleSave(saveMode: SaveTranslatedSkillRequest["saveMode"]) {
    if (!selectedId || !translatedMarkdown.trim()) {
      return;
    }

    setSaving(true);
    const parsedMarkdown = parseSkillMarkdown(
      translatedMarkdown,
      selectedSkill?.name ?? "translated-skill",
    );
    const payload: SaveTranslatedSkillRequest = {
      provider,
      direction,
      saveMode,
      name: parsedMarkdown.title,
      description: parsedMarkdown.description,
      bodyMarkdown: parsedMarkdown.bodyMarkdown,
    };
    const response = await fetch(`/api/skills/${encodeURIComponent(selectedId)}/translate`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as Partial<SaveTranslatedSkillResponse> & {
      error?: string;
    };

    if (!response.ok || !result.skill || !result.translationMeta) {
      toast({
        title: "保存翻译结果失败",
        description: result.error ?? "保存翻译结果失败。",
        variant: "error",
      });
      setSaving(false);
      return;
    }

    setLastTranslationMeta(result.translationMeta);
    setSaveDialogOpen(false);
    setTranslatedMarkdown("");
    setSelectedSkill(result.skill);
    updateQuery(result.skill.id);
    await refreshSkills(result.skill.id);
    toast({
      title: "翻译结果已保存",
      description:
        saveMode === "fork"
          ? `已生成 ${result.skill.name}。`
          : `已更新 ${result.skill.name}。`,
      variant: "success",
    });
    setSaving(false);
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <div className="flex h-[calc(100vh-115px)] min-h-[720px]">
          <section className="flex min-w-0 flex-1 flex-col border-r border-slate-200/80">
            <div className="border-b border-slate-200/80 bg-white px-5 py-4 lg:px-8">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative max-w-sm flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="搜索技能"
                      className="pl-9"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <ToggleGroup
                      type="single"
                      value={view}
                      onValueChange={(value) => value && setView(value as ViewMode)}
                    >
                      <ToggleGroupItem value="grid" aria-label="网格视图">
                        <Grid2x2 className="h-4 w-4" />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="list" aria-label="列表视图">
                        <List className="h-4 w-4" />
                      </ToggleGroupItem>
                    </ToggleGroup>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSort((current) => (current === "updated" ? "name" : "updated"))
                      }
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      {sort === "updated" ? "最近更新" : "名称排序"}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <IconButton label="刷新" onClick={() => void refreshSkills()}>
                    {refreshing ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </IconButton>
                  <Button
                    size="sm"
                    onClick={() => void handleTranslate()}
                    disabled={!selectedId || translating || saving || !executableProviders.length}
                  >
                    {translating ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    执行翻译
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSaveDialogOpen(true)}
                    disabled={!translatedMarkdown.trim() || translating || saving}
                  >
                    <Save className="h-4 w-4" />
                    保存
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
                <Badge variant="muted">共 {filteredSkills.length} 个技能</Badge>
                <span>默认使用本地翻译，默认方向为英文转中文。</span>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div
                className={
                  view === "grid"
                    ? "grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3 lg:p-8"
                    : "flex flex-col gap-3 p-5 lg:p-8"
                }
              >
                {filteredSkills.map((skill) => {
                  const active = skill.id === selectedId;

                  return (
                    <Card
                      key={skill.id}
                      className={
                        active
                          ? "border-sky-300 bg-sky-50/50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300"
                      }
                    >
                      <CardHeader className="gap-3 pb-3">
                        <button
                          type="button"
                          className="min-w-0 cursor-pointer select-none text-left"
                          onClick={() => updateQuery(skill.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <CardTitle className="truncate text-base">
                                {skill.name}
                              </CardTitle>
                              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                                {skill.description || "暂无描述"}
                              </p>
                            </div>
                            {active ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                            ) : null}
                          </div>
                        </button>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="copy-content rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          {skill.path}
                        </div>
                        <div className="ui-chrome flex items-center justify-between text-xs text-slate-400">
                          <span>更新于</span>
                          <span>{formatDate(skill.updatedAt)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {!filteredSkills.length ? (
                  <div className="ui-chrome col-span-full rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                    <p className="text-base font-medium text-slate-900">没有找到技能</p>
                    <p className="mt-1 text-sm text-slate-500">
                      请调整搜索词，或先回到技能页创建和导入技能。
                    </p>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </section>

          <aside className="hidden min-h-0 w-[420px] shrink-0 bg-white xl:flex xl:flex-col">
            {!selectedId ? (
              <div className="flex h-full items-center justify-center px-10 text-center">
                <div className="ui-chrome">
                  <p className="text-base font-medium text-slate-900">请选择一个技能</p>
                  <p className="mt-1 text-sm text-slate-500">
                    选择左侧卡片后，可以在这里查看内容并执行翻译。
                  </p>
                </div>
              </div>
            ) : loadingDetail || !selectedSkill ? (
              <div className="flex h-full items-center justify-center">
                <LoaderCircle className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-slate-200/80 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="ui-chrome min-w-0">
                      <h2 className="truncate text-lg font-semibold">{selectedSkill.name}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {selectedSkill.description || "暂无描述"}
                      </p>
                    </div>
                    <Badge variant={translatedMarkdown.trim() ? "accent" : "muted"}>
                      {translatedMarkdown.trim() ? "可编辑" : "待翻译"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="muted">{selectedSkill.id}</Badge>
                    <Badge variant="muted">{formatDate(selectedSkill.updatedAt)}</Badge>
                    {selectedSkill.assets.length ? (
                      <Badge variant="muted">{selectedSkill.assets.length} 个资源</Badge>
                    ) : null}
                  </div>
                  <div className="copy-content mt-4 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {selectedSkill.path}
                  </div>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="min-w-0 space-y-5 p-5">
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-900">翻译参数</h3>
                        {lastTranslationMeta ? (
                          <Badge variant="accent">
                            {lastTranslationMeta.sourceLanguage} {"->"}{" "}
                            {lastTranslationMeta.targetLanguage}
                          </Badge>
                        ) : null}
                      </div>

                      <IconSelect
                        label="翻译服务"
                        value={provider}
                        options={providerOptions}
                        onSelect={setProvider}
                      />

                      <IconSelect
                        label="翻译方向"
                        value={direction}
                        options={directionOptions}
                        onSelect={setDirection}
                      />
                    </section>

                    <Separator />

                    <section className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {translatedMarkdown.trim() ? "翻译结果编辑器" : "源 Markdown"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {translatedMarkdown.trim()
                            ? "这里是普通 Markdown 文本，可直接修改后再保存。"
                            : "这里显示原始 Markdown 文本，执行翻译后会切换成可编辑结果。"}
                        </p>
                      </div>
                      <Textarea
                        value={
                          translatedMarkdown.trim()
                            ? translatedMarkdown
                            : selectedSkill.contentMarkdown
                        }
                        onChange={(event) => setTranslatedMarkdown(event.target.value)}
                        readOnly={!translatedMarkdown.trim()}
                        className="min-h-[420px] resize-none overflow-x-auto font-mono text-sm"
                        spellCheck={false}
                      />
                    </section>
                  </div>
                </ScrollArea>
              </div>
            )}
          </aside>
        </div>

        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>保存翻译结果</DialogTitle>
            <DialogDescription>
              选择这次翻译结果的保存方式。覆盖会直接改写当前技能，另存会生成同目录副本。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 px-5 pb-5 pt-4">
            <button
              type="button"
              onClick={() => void handleSave("fork")}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="text-sm font-medium text-slate-900">另存为新技能</div>
              <p className="mt-1 text-sm text-slate-500">
                复制整个目录，并生成一个翻译后的新技能副本。
              </p>
            </button>

            <button
              type="button"
              onClick={() => void handleSave("overwrite")}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="text-sm font-medium text-slate-900">覆盖原技能</div>
              <p className="mt-1 text-sm text-slate-500">
                直接写回当前技能目录，不会保留原始文本版本。
              </p>
            </button>

            {saving ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在保存翻译结果...
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
