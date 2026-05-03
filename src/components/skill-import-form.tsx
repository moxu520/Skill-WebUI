"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Import,
  LoaderCircle,
  FolderSearch2,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import type { DiscoveredSkillSummary, GitSyncConfig } from "@/lib/types";

/** 嵌入式导入成功后回传给父层的技能信息。 */
type ImportSuccessPayload = {
  id: string;
  name: string;
};

/** 单次导入接口返回的技能对象。 */
type ImportApiResponse = {
  skill?: ImportSuccessPayload;
  error?: string;
};

/** Git 仓库扫描接口的成功返回结构。 */
type GitDiscoveryResponse = {
  sessionId: string;
  repositoryUrl: string;
  branch: string;
  lastSyncedCommit?: string;
  skills: DiscoveredSkillSummary[];
};

/** Git 扫描或同步时在界面展示的轻量进度信息。 */
type GitProgressState = {
  current: number;
  total: number;
  message: string;
};

/** 将 ISO 时间格式化为界面可读的本地时间。 */
function formatDate(input: string) {
  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return input;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** 根据候选状态选择对应的徽标视觉风格。 */
function statusVariant(status: DiscoveredSkillSummary["status"]) {
  if (status === "importable") {
    return "accent";
  }

  return "muted";
}

/** 为不同来源的候选技能生成稳定的前端键值。 */
function getCandidateKey(skill: DiscoveredSkillSummary) {
  if (skill.sourceKind === "git") {
    return `${skill.sessionId ?? ""}:${skill.relativeSkillPath ?? skill.sourcePath}`;
  }

  return skill.sourcePath;
}

/** 返回候选技能在界面中应展示的路径文本。 */
function getCandidateLocation(skill: DiscoveredSkillSummary) {
  if (skill.sourceKind === "git") {
    return skill.relativeSkillPath ?? skill.sourcePath;
  }

  return skill.sourcePath;
}

/** 统一渲染候选技能列表，供本地扫描和 Git 扫描共用。 */
function ImportCandidateList({
  skills,
  loading,
  emptyTitle,
  emptyDescription,
  activeImportKey,
  saving,
  onImport,
}: {
  skills: DiscoveredSkillSummary[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  activeImportKey: string;
  saving: boolean;
  onImport: (skill: DiscoveredSkillSummary) => Promise<void>;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1 rounded-lg border border-slate-200 bg-slate-50/60">
      <div className="space-y-3 p-3 pb-4">
        {loading ? (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white">
            <LoaderCircle className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : skills.length ? (
          skills.map((skill) => {
            const isImportable = skill.status === "importable";
            const candidateKey = getCandidateKey(skill);
            const isCurrentImport = saving && activeImportKey === candidateKey;

            return (
              <div
                key={candidateKey}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="select-none truncate text-sm font-semibold text-slate-900">
                        {skill.name}
                      </p>
                      <Badge variant={statusVariant(skill.status)}>
                        {skill.status === "importable"
                          ? "可导入"
                          : skill.status === "conflict"
                            ? "已存在"
                            : "无效"}
                      </Badge>
                      <Badge variant="muted">{skill.sourceLabel}</Badge>
                    </div>
                    <p className="select-none mt-1 text-sm text-slate-500">
                      {skill.description || skill.statusReason}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onImport(skill)}
                    disabled={!isImportable || saving || isCurrentImport}
                  >
                    {isCurrentImport ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Import className="h-4 w-4" />
                    )}
                    导入
                  </Button>
                </div>

                {skill.sourceKind === "git" && skill.repositoryUrl ? (
                  <div className="copy-content mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <div className="truncate font-mono">{skill.repositoryUrl}</div>
                    {skill.branch ? <div className="mt-1 font-mono">{skill.branch}</div> : null}
                    <div className="mt-1 font-mono">{getCandidateLocation(skill)}</div>
                  </div>
                ) : (
                  <div className="copy-content mt-3 rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
                    {getCandidateLocation(skill)}
                  </div>
                )}

                <div className="ui-chrome mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{skill.statusReason}</span>
                  <span>{formatDate(skill.updatedAt)}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="ui-chrome rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">{emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

/** 技能导入表单，支持自动发现、本地路径与 Git 仓库三种导入模式。 */
export function SkillImportForm({
  compact = false,
  initialDiscoveredSkills = [],
  onDiscoveredSkillsChange,
  onBatchSuccess,
  onSuccess,
}: {
  compact?: boolean;
  initialDiscoveredSkills?: DiscoveredSkillSummary[];
  onDiscoveredSkillsChange?: (skills: DiscoveredSkillSummary[]) => void;
  onBatchSuccess?: (skills: ImportSuccessPayload[]) => void;
  onSuccess?: (skill: ImportSuccessPayload) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [sourcePath, setSourcePath] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [repositoryBranch, setRepositoryBranch] = useState("");
  const [mode, setMode] = useState("discover");
  const [discoveredSkills, setDiscoveredSkills] =
    useState<DiscoveredSkillSummary[]>(initialDiscoveredSkills);
  const [gitSkills, setGitSkills] = useState<DiscoveredSkillSummary[]>([]);
  const [loadingDiscovered, setLoadingDiscovered] = useState(false);
  const [loadingGitSkills, setLoadingGitSkills] = useState(false);
  const [activeImportKey, setActiveImportKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [gitProgress, setGitProgress] = useState<GitProgressState | null>(null);
  const importableGitSkills = gitSkills.filter((skill) => skill.status === "importable");
  const hasLoadedDiscoveredRef = useRef(initialDiscoveredSkills.length > 0);

  /** 首次挂载时读取全局 Git 配置，作为仓库扫描的默认值。 */
  useEffect(() => {
    let cancelled = false;

    async function loadGitConfig() {
      const response = await fetch("/api/settings/git-sync");
      const payload = (await response.json()) as {
        config?: GitSyncConfig;
      };

      if (cancelled || !response.ok || !payload.config) {
        return;
      }

      setRepositoryUrl((current) => current || payload.config?.repositoryUrl || "");
      setRepositoryBranch((current) => current || payload.config?.branch || "");
    }

    void loadGitConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  /** 在导入成功后关闭本次流程，并跳转或回传结果。 */
  function handleImportSuccess(skill: ImportSuccessPayload) {
    if (onSuccess) {
      onSuccess(skill);
      return;
    }

    toast({
      title: "技能已导入",
      description: `已导入 ${skill.name}。`,
      variant: "success",
    });
    router.push(`/skills?skill=${encodeURIComponent(skill.id)}`);
  }

  /** 调用导入接口，并返回统一的成功或错误结果。 */
  async function requestImport(payload: object) {
    const response = await fetch("/api/skills/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as ImportApiResponse;

    if (!response.ok || !body.skill) {
      return {
        error: body.error ?? "导入技能失败。",
      };
    }

    return {
      skill: body.skill,
    };
  }

  /** 将已同步的 Git 候选即时标记为冲突，避免重复导入。 */
  function markGitSkillsImported(relativeSkillPaths: string[]) {
    const importedPathSet = new Set(relativeSkillPaths);

    setGitSkills((current) =>
      current.map((skill) => {
        if (
          skill.sourceKind !== "git" ||
          !skill.relativeSkillPath ||
          !importedPathSet.has(skill.relativeSkillPath)
        ) {
          return skill;
        }

        return {
          ...skill,
          status: "conflict",
          statusReason: "已同步到受管技能目录。",
        };
      }),
    );
  }

  /** 执行导入请求，并统一处理成功与错误提示。 */
  async function submitImport(payload: object, importKey: string) {
    setSaving(true);
    setActiveImportKey(importKey);
    const result = await requestImport(payload);

    if (!result.skill) {
      toast({
        title: "导入失败",
        description: result.error ?? "导入技能失败。",
        variant: "error",
      });
      setSaving(false);
      setActiveImportKey("");
      return;
    }

    handleImportSuccess(result.skill);
    setSaving(false);
    setActiveImportKey("");
  }

  /** 主动刷新自动发现候选列表。 */
  const loadDiscoveredSkills = useCallback(async () => {
    setLoadingDiscovered(true);

    const response = await fetch("/api/skills/discovery");
    const payload = (await response.json()) as {
      error?: string;
      skills?: DiscoveredSkillSummary[];
    };

    if (!response.ok || !payload.skills) {
      toast({
        title: "加载扫描结果失败",
        description: payload.error ?? "加载扫描结果失败。",
        variant: "error",
      });
      setLoadingDiscovered(false);
      return;
    }

    setDiscoveredSkills(payload.skills);
    onDiscoveredSkillsChange?.(payload.skills);
    hasLoadedDiscoveredRef.current = true;
    setLoadingDiscovered(false);
  }, [onDiscoveredSkillsChange, toast]);

  /** 首次进入自动发现标签时再异步扫描，减少技能页首屏阻塞。 */
  useEffect(() => {
    if (mode !== "discover" || hasLoadedDiscoveredRef.current || loadingDiscovered) {
      return;
    }

    hasLoadedDiscoveredRef.current = true;
    void loadDiscoveredSkills();
  }, [loadDiscoveredSkills, loadingDiscovered, mode]);

  /** 扫描 Git 仓库中的 skill 候选目录。 */
  async function loadGitSkills() {
    setLoadingGitSkills(true);
    setGitProgress({
      current: 1,
      total: 3,
      message: "正在连接仓库并拉取默认分支…",
    });

    const response = await fetch("/api/skills/import/git/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repositoryUrl, branch: repositoryBranch }),
    });
    setGitProgress({
      current: 2,
      total: 3,
      message: "正在解析仓库结构并查找 Skill…",
    });
    const payload = (await response.json()) as Partial<GitDiscoveryResponse> & {
      error?: string;
    };

    if (!response.ok || !payload.skills) {
      toast({
        title: "扫描 Git 仓库失败",
        description: payload.error ?? "扫描 Git 仓库失败。",
        variant: "error",
      });
      setLoadingGitSkills(false);
      setGitProgress(null);
      return;
    }

    setGitSkills(payload.skills);
    setRepositoryBranch(payload.branch ?? repositoryBranch);
    setLoadingGitSkills(false);
    setGitProgress({
      current: 3,
      total: 3,
      message: `扫描完成，找到 ${payload.skills.length} 个 Skill 候选。`,
    });
  }

  /** 按指定本地路径执行导入。 */
  async function importFromPath(nextPath: string) {
    await submitImport(
      {
        sourceType: "local",
        sourcePath: nextPath,
      },
      nextPath,
    );
  }

  /** 从 Git 扫描结果中导入单个 skill 目录。 */
  async function importFromGit(skill: DiscoveredSkillSummary) {
    if (!skill.sessionId || !skill.relativeSkillPath) {
      toast({
        title: "导入失败",
        description: "Git 扫描结果不完整，请重新扫描仓库。",
        variant: "error",
      });
      return;
    }

    await submitImport(
      {
        sourceType: "git",
        sessionId: skill.sessionId,
        relativeSkillPath: skill.relativeSkillPath,
        repositoryUrl: skill.repositoryUrl,
        branch: skill.branch,
        lastSyncedCommit: skill.lastSyncedCommit,
      },
      getCandidateKey(skill),
    );
  }

  /** 一次性同步当前仓库里全部可导入的技能目录。 */
  async function syncAllGitSkills() {
    if (!importableGitSkills.length) {
      toast({
        title: "没有可同步的技能",
        description: "当前扫描结果里没有可批量导入的 Git Skill。",
        variant: "error",
      });
      return;
    }

    setSaving(true);
    setActiveImportKey("__git-bulk-sync__");
    setGitProgress({
      current: 0,
      total: importableGitSkills.length,
      message: `准备同步 ${importableGitSkills.length} 个 Skill…`,
    });

    const importedSkills: ImportSuccessPayload[] = [];
    const importedPaths: string[] = [];
    const failedSkills: string[] = [];

    for (const skill of importableGitSkills) {
      if (!skill.sessionId || !skill.relativeSkillPath) {
        failedSkills.push(skill.name);
        continue;
      }

      setGitProgress({
        current: importedSkills.length + failedSkills.length + 1,
        total: importableGitSkills.length,
        message: `正在同步 ${skill.name}…`,
      });

      const result = await requestImport({
        sourceType: "git",
        sessionId: skill.sessionId,
        relativeSkillPath: skill.relativeSkillPath,
        repositoryUrl: skill.repositoryUrl,
        branch: skill.branch,
        lastSyncedCommit: skill.lastSyncedCommit,
      });

      if (result.skill) {
        importedSkills.push(result.skill);
        importedPaths.push(skill.relativeSkillPath);
        continue;
      }

      failedSkills.push(skill.name);
    }

    setSaving(false);
    setActiveImportKey("");

    if (importedPaths.length) {
      markGitSkillsImported(importedPaths);
    }

    if (!importedSkills.length) {
      toast({
        title: "同步失败",
        description: failedSkills.length
          ? `共 ${failedSkills.length} 个 Skill 同步失败，请检查仓库扫描结果后重试。`
          : "没有成功同步任何 Skill。",
        variant: "error",
      });
      setGitProgress({
        current: importableGitSkills.length,
        total: importableGitSkills.length,
        message: `同步结束，成功 0 个，失败 ${failedSkills.length} 个。`,
      });
      return;
    }

    setGitProgress({
      current: importableGitSkills.length,
      total: importableGitSkills.length,
      message:
        failedSkills.length > 0
          ? `同步结束，成功 ${importedSkills.length} 个，失败 ${failedSkills.length} 个。`
          : `同步完成，已导入 ${importedSkills.length} 个 Skill。`,
    });

    if (onBatchSuccess) {
      onBatchSuccess(importedSkills);
      return;
    }

    const lastImportedSkill = importedSkills.at(-1);

    toast({
      title: "同步完成",
      description:
        failedSkills.length > 0
          ? `已同步 ${importedSkills.length} 个 Skill，另有 ${failedSkills.length} 个失败。`
          : `已同步 ${importedSkills.length} 个 Skill。`,
      variant: "success",
    });

    if (lastImportedSkill) {
      router.push(`/skills?skill=${encodeURIComponent(lastImportedSkill.id)}`);
    }
  }

  /** 处理手动路径导入表单的提交行为。 */
  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await importFromPath(sourcePath);
  }

  /** 处理 Git 仓库扫描表单的提交行为。 */
  async function handleGitSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadGitSkills();
  }

  return (
    <div
      className={
        compact
          ? "flex min-h-0 flex-1 flex-col overflow-hidden p-5"
          : "mx-auto flex max-w-3xl flex-col gap-6 p-5 lg:p-8"
      }
    >
      <section
        className={
          compact
            ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            : "rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        }
      >
        <div className="mb-5 space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">导入技能</h2>
          <p className="text-sm text-slate-500">
            支持自动扫描常见目录、手动输入本地绝对路径，或从 Git 仓库扫描并导入 Skill。
          </p>
        </div>

        <Tabs
          value={mode}
          onValueChange={setMode}
          className={compact ? "min-h-0 flex-1 gap-5" : "gap-5"}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="discover" className="gap-2">
              <Search className="h-4 w-4" />
              自动扫描
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <FolderSearch2 className="h-4 w-4" />
              手动路径
            </TabsTrigger>
            <TabsTrigger value="git" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Git 仓库
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="discover"
            className={
              compact
                ? "mt-0 flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden"
                : "mt-0 flex min-h-[420px] flex-col space-y-4"
            }
          >
            <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span>扫描 `.codex`、`.claude`、`.agent` 以及自定义根目录。</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void loadDiscoveredSkills()}
                disabled={loadingDiscovered}
              >
                {loadingDiscovered ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                刷新
              </Button>
            </div>

            <ImportCandidateList
              skills={discoveredSkills}
              loading={loadingDiscovered}
              emptyTitle="没有扫描到可识别的 Skill"
              emptyDescription="你可以在设置页添加更多扫描根目录，或切换到其他导入方式。"
              activeImportKey={activeImportKey}
              saving={saving}
              onImport={async (skill) => importFromPath(skill.sourcePath)}
            />
          </TabsContent>

          <TabsContent
            value="manual"
            className={compact ? "mt-0 min-h-0 flex-1 overflow-hidden" : "mt-0 min-h-[420px]"}
          >
            <form
              onSubmit={handleManualSubmit}
              className={
                compact
                  ? "flex h-full min-h-0 flex-col rounded-lg border border-slate-200 bg-slate-50/60 p-4"
                  : "flex h-full min-h-[420px] flex-col rounded-lg border border-slate-200 bg-slate-50/60 p-4"
              }
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">来源路径</label>
                <Input
                  value={sourcePath}
                  onChange={(event) => setSourcePath(event.target.value)}
                  placeholder="/Users/you/skills/my-skill"
                  required
                />

                <p className="text-sm text-slate-500">
                  请输入绝对路径，目录中需要包含 `SKILL.md` 或 `skill.md`。
                </p>
              </div>

              <div className="mt-auto flex justify-end pt-6">
                <Button type="submit" disabled={saving && activeImportKey === sourcePath}>
                  {saving && activeImportKey === sourcePath ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Import className="h-4 w-4" />
                  )}
                  导入技能
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent
            value="git"
            className={
              compact
                ? "mt-0 flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden"
                : "mt-0 flex min-h-[420px] flex-col space-y-4"
            }
          >
            <form
              onSubmit={handleGitSubmit}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">仓库地址</label>
                <div className="flex items-center gap-3">
                  <Input
                    value={repositoryUrl}
                    onChange={(event) => setRepositoryUrl(event.target.value)}
                    placeholder="https://github.com/anthropics/skills"
                    required
                  />
                  <Button type="submit" disabled={loadingGitSkills}>
                    {loadingGitSkills ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <GitBranch className="h-4 w-4" />
                    )}
                    扫描仓库
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void syncAllGitSkills()}
                    disabled={saving || loadingGitSkills || !importableGitSkills.length}
                  >
                    {saving && activeImportKey === "__git-bulk-sync__" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Import className="h-4 w-4" />
                    )}
                    全部同步
                  </Button>
                </div>
                <p className="text-sm text-slate-500">
                  使用当前默认分支 `{repositoryBranch || "master"}` 扫描，自动递归查找仓库内所有 `SKILL.md` 与 `skill.md`。
                </p>
                {gitProgress ? (
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      {(loadingGitSkills || saving) && (
                        <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />
                      )}
                      <span>{gitProgress.message}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-[width] duration-300"
                        style={{
                          width:
                            gitProgress.total > 0
                              ? `${Math.max(
                                  8,
                                  Math.min(100, (gitProgress.current / gitProgress.total) * 100),
                                )}%`
                              : "8%",
                        }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {gitProgress.total > 0
                        ? `${Math.min(gitProgress.current, gitProgress.total)}/${gitProgress.total}`
                        : "0/0"}
                    </div>
                  </div>
                ) : null}
              </div>
            </form>

            <ImportCandidateList
              skills={gitSkills}
              loading={loadingGitSkills}
              emptyTitle="尚未扫描 Git 仓库"
              emptyDescription="输入仓库地址后扫描，系统会列出仓库中所有可识别的 Skill。"
              activeImportKey={activeImportKey}
              saving={saving}
              onImport={importFromGit}
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
