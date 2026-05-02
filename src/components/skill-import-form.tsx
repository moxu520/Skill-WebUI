"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Import,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import type { DiscoveredSkillSummary } from "@/lib/types";

/** 嵌入式导入成功后回传给父层的技能信息。 */
type ImportSuccessPayload = {
  id: string;
  name: string;
};

/** Git 仓库扫描接口的成功返回结构。 */
type GitDiscoveryResponse = {
  sessionId: string;
  repositoryUrl: string;
  skills: DiscoveredSkillSummary[];
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
                      <p className="truncate text-sm font-semibold text-slate-900">
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
                    <p className="mt-1 text-sm text-slate-500">
                      {skill.description || skill.statusReason}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void onImport(skill)}
                    disabled={!isImportable || isCurrentImport}
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
                  <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <div className="truncate font-mono">{skill.repositoryUrl}</div>
                    <div className="mt-1 font-mono">{getCandidateLocation(skill)}</div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
                    {getCandidateLocation(skill)}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{skill.statusReason}</span>
                  <span>{formatDate(skill.updatedAt)}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
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
  onSuccess,
}: {
  compact?: boolean;
  initialDiscoveredSkills?: DiscoveredSkillSummary[];
  onSuccess?: (skill: ImportSuccessPayload) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [sourcePath, setSourcePath] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [mode, setMode] = useState("discover");
  const [discoveredSkills, setDiscoveredSkills] =
    useState<DiscoveredSkillSummary[]>(initialDiscoveredSkills);
  const [gitSkills, setGitSkills] = useState<DiscoveredSkillSummary[]>([]);
  const [loadingDiscovered, setLoadingDiscovered] = useState(false);
  const [loadingGitSkills, setLoadingGitSkills] = useState(false);
  const [activeImportKey, setActiveImportKey] = useState("");
  const [saving, setSaving] = useState(false);

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

  /** 执行导入请求，并统一处理成功与错误提示。 */
  async function submitImport(payload: object, importKey: string) {
    setSaving(true);
    setActiveImportKey(importKey);

    const response = await fetch("/api/skills/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      error?: string;
      skill?: ImportSuccessPayload;
    };

    if (!response.ok || !body.skill) {
      toast({
        title: "导入失败",
        description: body.error ?? "导入技能失败。",
        variant: "error",
      });
      setSaving(false);
      setActiveImportKey("");
      return;
    }

    handleImportSuccess(body.skill);
    setSaving(false);
    setActiveImportKey("");
  }

  /** 主动刷新自动发现候选列表。 */
  async function loadDiscoveredSkills() {
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
    setLoadingDiscovered(false);
  }

  /** 扫描 Git 仓库中的 skill 候选目录。 */
  async function loadGitSkills() {
    setLoadingGitSkills(true);

    const response = await fetch("/api/skills/import/git/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repositoryUrl }),
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
      return;
    }

    setGitSkills(payload.skills);
    setLoadingGitSkills(false);
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
      },
      getCandidateKey(skill),
    );
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
            <TabsTrigger value="discover">自动扫描</TabsTrigger>
            <TabsTrigger value="manual">手动路径</TabsTrigger>
            <TabsTrigger value="git">Git 仓库</TabsTrigger>
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
                </div>
                <p className="text-sm text-slate-500">
                  只扫描默认分支，自动递归查找仓库内所有 `SKILL.md` 与 `skill.md`。
                </p>
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
