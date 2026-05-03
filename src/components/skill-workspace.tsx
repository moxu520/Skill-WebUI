"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  Eye,
  Grid2x2,
  List,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { SkillCreateForm } from "@/components/skill-create-form";
import { SkillImportForm } from "@/components/skill-import-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { SkillDetail, SkillSummary, DiscoveredSkillSummary } from "@/lib/types";

/**
 * 技能工作区组件，负责管理左侧技能列表、自动发现候选、右侧详情面板
 * 以及导入/新建弹窗之间的交互状态。
 */
type SkillWorkspaceProps = {
  initialSkills: SkillSummary[];
  initialSelectedId?: string;
  skillsRoot: string;
};

type SortMode = "updated" | "name";
type ViewMode = "grid" | "list";

const DETAIL_PANEL_DEFAULT_WIDTH = 420;
const DETAIL_PANEL_MIN_WIDTH = 360;
const DETAIL_PANEL_MAX_WIDTH = 720;
const DETAIL_PANEL_MIN_LIST_WIDTH = 560;
const DETAIL_PANEL_KEYBOARD_STEP = 24;
const DETAIL_PANEL_STORAGE_KEY = "skill-workspace.detail-width";

/** 技能详情接口的成功返回结构。 */
type SkillDetailResponse = {
  skill: SkillDetail;
};

/** 技能列表接口的成功返回结构。 */
type SkillsResponse = {
  skills: SkillSummary[];
};

/** 子表单成功完成后回传给工作区的技能信息。 */
type SkillActionResult = {
  id: string;
  name: string;
};

/** 根据视口宽度计算详情栏当前允许的最大宽度。 */
function getDetailPanelMaxWidth(viewportWidth: number) {
  return Math.max(
    DETAIL_PANEL_MIN_WIDTH,
    Math.min(DETAIL_PANEL_MAX_WIDTH, viewportWidth - DETAIL_PANEL_MIN_LIST_WIDTH),
  );
}

/** 将详情栏宽度约束在当前允许的最小值和最大值之间。 */
function clampDetailPanelWidth(width: number, viewportWidth: number) {
  return Math.min(
    getDetailPanelMaxWidth(viewportWidth),
    Math.max(DETAIL_PANEL_MIN_WIDTH, width),
  );
}

/** 将技能更新时间格式化为工作区统一使用的文本。 */
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

/** 带提示文本的图标按钮，避免纯图标操作缺少语义。 */
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

/** 技能主工作区，串联列表、筛选、候选导入和详情编辑流程。 */
export function SkillWorkspace({
  initialSkills,
  initialSelectedId,
  skillsRoot,
}: SkillWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [skills, setSkills] = useState(initialSkills);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("updated");
  const [view, setView] = useState<ViewMode>("grid");
  const [detailMode, setDetailMode] = useState<"preview" | "edit">("preview");
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    bodyMarkdown: "",
    slug: "",
  });
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [discoveredSkillsCache, setDiscoveredSkillsCache] = useState<
    DiscoveredSkillSummary[]
  >([]);
  const [detailPanelWidth, setDetailPanelWidth] = useState(DETAIL_PANEL_DEFAULT_WIDTH);
  const [detailPanelMaxWidth, setDetailPanelMaxWidth] = useState(DETAIL_PANEL_MAX_WIDTH);
  const [isResizingDetailPanel, setIsResizingDetailPanel] = useState(false);
  const detailPanelWidthRef = useRef(DETAIL_PANEL_DEFAULT_WIDTH);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DETAIL_PANEL_DEFAULT_WIDTH);
  const selectedId = searchParams.get("skill") ?? initialSelectedId ?? "";

  /** 将详情栏宽度同步到本地存储，便于下次继续使用。 */
  const persistDetailPanelWidth = useCallback((width: number) => {
    window.localStorage.setItem(DETAIL_PANEL_STORAGE_KEY, String(width));
  }, []);

  /** 按当前视口约束详情栏宽度，并按需决定是否持久化。 */
  const applyDetailPanelWidth = useCallback(
    (width: number, persist = false) => {
      const nextWidth = clampDetailPanelWidth(width, window.innerWidth);
      detailPanelWidthRef.current = nextWidth;
      setDetailPanelWidth(nextWidth);

      if (persist) {
        persistDetailPanelWidth(nextWidth);
      }
    },
    [persistDetailPanelWidth],
  );

  /** 读取指定技能的详情数据。 */
  async function fetchSkillDetail(skillId: string) {
    const response = await fetch(`/api/skills/${encodeURIComponent(skillId)}`);
    const payload = (await response.json()) as Partial<SkillDetailResponse> & {
      error?: string;
    };

    return { response, payload };
  }

  /** 当路由中的技能标识变化时，加载右侧详情面板数据。 */
  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      setLoadingDetail(true);

      const { response, payload } = await fetchSkillDetail(selectedId);

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setSelectedSkill(null);
        toast({
          title: "加载技能详情失败",
          description: payload.error ?? "加载技能详情失败。",
          variant: "error",
        });
        setLoadingDetail(false);
        return;
      }

      if (!payload.skill) {
        setSelectedSkill(null);
        toast({
          title: "加载技能详情失败",
          description: "技能详情返回无效。",
          variant: "error",
        });
        setLoadingDetail(false);
        return;
      }

      setSelectedSkill(payload.skill);
      setDraft({
        name: payload.skill.name,
        description: payload.skill.description,
        bodyMarkdown: payload.skill.bodyMarkdown,
        slug: payload.skill.id,
      });
      setLoadingDetail(false);
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedId, toast]);

  /** 初始化详情栏宽度，并在首屏时按当前视口修正保存值。 */
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const savedWidth = window.localStorage.getItem(DETAIL_PANEL_STORAGE_KEY);
      const parsedWidth = savedWidth ? Number(savedWidth) : Number.NaN;
      const initialWidth = clampDetailPanelWidth(
        Number.isFinite(parsedWidth) ? parsedWidth : DETAIL_PANEL_DEFAULT_WIDTH,
        window.innerWidth,
      );
      const initialMaxWidth = getDetailPanelMaxWidth(window.innerWidth);

      setDetailPanelMaxWidth(initialMaxWidth);
      detailPanelWidthRef.current = initialWidth;
      setDetailPanelWidth(initialWidth);

      if (savedWidth && initialWidth !== parsedWidth) {
        persistDetailPanelWidth(initialWidth);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [persistDetailPanelWidth]);

  /** 在窗口尺寸变化时重新约束详情栏宽度，避免把左侧列表压塌。 */
  useEffect(() => {
    function handleResize() {
      const nextMaxWidth = getDetailPanelMaxWidth(window.innerWidth);
      const nextWidth = clampDetailPanelWidth(detailPanelWidthRef.current, window.innerWidth);

      setDetailPanelMaxWidth(nextMaxWidth);

      if (nextWidth !== detailPanelWidthRef.current) {
        detailPanelWidthRef.current = nextWidth;
        setDetailPanelWidth(nextWidth);
        persistDetailPanelWidth(nextWidth);
      }
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [persistDetailPanelWidth]);

  /** 在拖拽详情栏时接管指针移动与结束事件，并恢复页面状态。 */
  useEffect(() => {
    if (!isResizingDetailPanel) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const deltaX = event.clientX - resizeStartXRef.current;
      const nextWidth = resizeStartWidthRef.current - deltaX;
      applyDetailPanelWidth(nextWidth);
    }

    function handlePointerUp() {
      setIsResizingDetailPanel(false);
      persistDetailPanelWidth(detailPanelWidthRef.current);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [applyDetailPanelWidth, isResizingDetailPanel, persistDetailPanelWidth]);

  /** 根据搜索词和排序规则生成当前应显示的技能列表。 */
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

  /** 将当前选中的技能标识同步到地址栏查询参数。 */
  function updateQuery(nextId: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextId) {
      params.set("skill", nextId);
    } else {
      params.delete("skill");
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  /** 主动刷新受管技能列表。 */
  async function refreshSkills() {
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
    setSkills(nextSkills);

    if (!selectedId) {
      setRefreshing(false);
      return;
    }

    const stillExists = nextSkills.some((skill) => skill.id === selectedId);

    if (!stillExists) {
      setSelectedSkill(null);
      setDetailMode("preview");
      updateQuery("");
      setRefreshing(false);
      return;
    }

    setLoadingDetail(true);
    const detailResult = await fetchSkillDetail(selectedId);

    if (!detailResult.response.ok) {
      toast({
        title: "刷新技能详情失败",
        description: detailResult.payload.error ?? "刷新技能详情失败。",
        variant: "error",
      });
      setLoadingDetail(false);
      setRefreshing(false);
      return;
    }

    if (detailResult.payload.skill) {
      setSelectedSkill(detailResult.payload.skill);
      setDraft({
        name: detailResult.payload.skill.name,
        description: detailResult.payload.skill.description,
        bodyMarkdown: detailResult.payload.skill.bodyMarkdown,
        slug: detailResult.payload.skill.id,
      });
      setDetailMode("preview");
    }

    setLoadingDetail(false);
    setRefreshing(false);
  }

  /** 保存右侧编辑态中的技能修改，并保持列表同步。 */
  async function saveSkill() {
    if (!selectedId) {
      return;
    }

    setSaving(true);

    const response = await fetch(`/api/skills/${encodeURIComponent(selectedId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast({
        title: "保存技能失败",
        description: payload.error ?? "更新技能失败。",
        variant: "error",
      });
      setSaving(false);
      return;
    }

    setSelectedSkill(payload.skill);
    setDetailMode("preview");
    setSaving(false);
    toast({
      title: "技能已保存",
      description: `已保存 ${payload.skill.name}。`,
      variant: "success",
    });
    await refreshSkills();

    if (payload.skill.id !== selectedId) {
      updateQuery(payload.skill.id);
    }
  }

  /** 删除当前选中的技能目录，并关闭对应详情。 */
  async function deleteSelectedSkill() {
    if (!selectedId) {
      return;
    }

    const response = await fetch(`/api/skills/${encodeURIComponent(selectedId)}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      toast({
        title: "删除技能失败",
        description: payload.error ?? "删除技能失败。",
        variant: "error",
      });
      return;
    }

    setSelectedSkill(null);
    toast({
      title: "技能已删除",
      description: `已删除 ${selectedId}。`,
      variant: "success",
    });
    updateQuery("");
    await refreshSkills();
  }

  /** 开始拖拽详情栏分隔手柄。 */
  function handleDetailPanelResizeStart(event: React.PointerEvent<HTMLDivElement>) {
    if (window.innerWidth < 1280) {
      return;
    }

    event.preventDefault();
    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = detailPanelWidthRef.current;
    setIsResizingDetailPanel(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  /** 支持通过键盘微调详情栏宽度。 */
  function handleDetailPanelSeparatorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (window.innerWidth < 1280) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      applyDetailPanelWidth(detailPanelWidthRef.current + DETAIL_PANEL_KEYBOARD_STEP, true);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      applyDetailPanelWidth(detailPanelWidthRef.current - DETAIL_PANEL_KEYBOARD_STEP, true);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      applyDetailPanelWidth(DETAIL_PANEL_MIN_WIDTH, true);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      applyDetailPanelWidth(getDetailPanelMaxWidth(window.innerWidth), true);
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-[calc(100vh-115px)] min-h-[720px]">
        <section className="flex min-w-0 flex-1 flex-col border-r border-slate-200/80 xl:border-r-0">
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
                <Dialog open={importOpen} onOpenChange={setImportOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4" />
                      导入
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="h-[min(820px,calc(100vh-32px))]">
                    <DialogHeader>
                      <DialogTitle>导入技能</DialogTitle>
                      <DialogDescription>
                        从本地目录或 Git 仓库导入一个已有技能。
                      </DialogDescription>
                    </DialogHeader>
                    <SkillImportForm
                      compact
                      initialDiscoveredSkills={discoveredSkillsCache}
                      onDiscoveredSkillsChange={setDiscoveredSkillsCache}
                      onBatchSuccess={(skills) => {
                        const lastSkill = skills.at(-1);

                        setImportOpen(false);
                        toast({
                          title: "技能已同步",
                          description: `已同步 ${skills.length} 个技能。`,
                          variant: "success",
                        });
                        void refreshSkills();

                        if (lastSkill) {
                          updateQuery(lastSkill.id);
                        }
                      }}
                      onSuccess={(skill) => {
                        setImportOpen(false);
                        toast({
                          title: "技能已导入",
                          description: `已导入 ${skill.name}。`,
                          variant: "success",
                        });
                        void refreshSkills();
                        updateQuery(skill.id);
                      }}
                    />
                  </DialogContent>
                </Dialog>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4" />
                      新建技能
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>新建技能</DialogTitle>
                      <DialogDescription>
                        创建一个新的本地技能，并立即写入 `SKILL.md`。
                      </DialogDescription>
                    </DialogHeader>
                    <SkillCreateForm
                      compact
                      onSuccess={(skill: SkillActionResult) => {
                        setCreateOpen(false);
                        toast({
                          title: "技能已创建",
                          description: `已创建 ${skill.name}。`,
                          variant: "success",
                        });
                        void refreshSkills();
                        updateQuery(skill.id);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
              <Badge variant="muted">共 {filteredSkills.length} 个技能</Badge>
              <span className="copy-content truncate">{skillsRoot}</span>
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
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          className="min-w-0 cursor-pointer select-none text-left"
                          onClick={() => {
                            setDetailMode("preview");
                            updateQuery(skill.id);
                          }}
                        >
                          <CardTitle className="truncate text-base">{skill.name}</CardTitle>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                            {skill.description || "暂无描述"}
                          </p>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="-m-1.5 h-10 w-10 rounded-md p-2.5"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setDetailMode("preview");
                                updateQuery(skill.id);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              查看
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setDetailMode("edit");
                                updateQuery(skill.id);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
                    你可以先创建一个新技能，或者导入已有的本地目录。
                  </p>
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </section>

        <div
          role="separator"
          aria-label="调整详情栏宽度"
          aria-orientation="vertical"
          aria-valuemin={DETAIL_PANEL_MIN_WIDTH}
          aria-valuemax={detailPanelMaxWidth}
          aria-valuenow={detailPanelWidth}
          tabIndex={0}
          onPointerDown={handleDetailPanelResizeStart}
          onKeyDown={handleDetailPanelSeparatorKeyDown}
          className={`group hidden w-2 shrink-0 touch-none cursor-col-resize items-stretch justify-center bg-white outline-none transition xl:flex ${
            isResizingDetailPanel ? "bg-sky-50" : "hover:bg-slate-50 focus:bg-slate-50"
          }`}
        >
          <div
            className={`w-px flex-1 transition ${
              isResizingDetailPanel ? "bg-sky-400" : "bg-slate-200 group-hover:bg-slate-300"
            }`}
          />
        </div>

        <aside
          className="hidden min-h-0 shrink-0 bg-white xl:flex xl:flex-col"
          style={{ width: `${detailPanelWidth}px` }}
        >
          {!selectedId ? (
            <div className="flex h-full items-center justify-center px-10 text-center">
              <div className="ui-chrome">
                <p className="text-base font-medium text-slate-900">请选择一个技能</p>
                <p className="mt-1 text-sm text-slate-500">
                  选择左侧卡片后，可以在这里预览、编辑或删除该技能。
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
                  <div className="flex items-center gap-1">
                    <IconButton
                      label="预览"
                      onClick={() => setDetailMode("preview")}
                      variant={detailMode === "preview" ? "secondary" : "ghost"}
                    >
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="编辑"
                      onClick={() => setDetailMode("edit")}
                      variant={detailMode === "edit" ? "secondary" : "ghost"}
                    >
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除这个技能？</AlertDialogTitle>
                          <AlertDialogDescription>
                            这会删除整个技能目录，操作后无法恢复。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel asChild>
                            <Button variant="outline">取消</Button>
                          </AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button variant="destructive" onClick={() => void deleteSelectedSkill()}>
                              删除
                            </Button>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="accent">{selectedSkill.id}</Badge>
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
                <div className="min-w-0 p-5">
                  {detailMode === "preview" ? (
                    <div className="min-h-0 overflow-hidden pt-1">
                      <MarkdownViewer content={selectedSkill.contentMarkdown} />
                    </div>
                  ) : (
                    <div className="min-h-0 space-y-4 pt-1">
                      <div className="space-y-1">
                        <label className="ui-chrome text-sm font-medium text-slate-700">名称</label>
                        <Input
                          value={draft.name}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="ui-chrome text-sm font-medium text-slate-700">目录标识</label>
                        <Input
                          value={draft.slug}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, slug: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="ui-chrome text-sm font-medium text-slate-700">描述</label>
                        <Textarea
                          rows={3}
                          value={draft.description}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="ui-chrome text-sm font-medium text-slate-700">Markdown 正文</label>
                        <Textarea
                          rows={18}
                          value={draft.bodyMarkdown}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              bodyMarkdown: event.target.value,
                            }))
                          }
                          className="min-h-[360px] font-mono text-[13px]"
                        />
                      </div>
                      <Separator />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDetailMode("preview")}>
                          取消
                        </Button>
                        <Button onClick={() => void saveSkill()} disabled={saving}>
                          {saving ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                          保存修改
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </aside>
      </div>
    </TooltipProvider>
  );
}
