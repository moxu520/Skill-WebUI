"use client";

import { useMemo, useState } from "react";
import { ArrowUpToLine, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/toast";
import type {
  GitPushProgressEvent,
  GitSyncConfig,
  SkillGitSyncActivity,
  SkillGitSyncStatus,
  SkillSummary,
} from "@/lib/types";

/** 技能列表接口的成功返回结构。 */
type SkillsResponse = {
  skills: SkillSummary[];
};

/** Git 同步接口返回的完整结果。 */
type SkillGitSyncResponse = {
  gitSync: SkillGitSyncStatus;
  activity: SkillGitSyncActivity;
};

/** 推送至 Git 工作区组件输入参数。 */
type GitPushWorkspaceProps = {
  initialSkills: SkillSummary[];
  initialConfig: GitSyncConfig;
};

/** 将 ISO 时间格式化为界面可读文本。 */
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

/** 将 Git 状态映射为用户可读标签。 */
function formatGitStatusLabel(gitSync?: SkillGitSyncStatus) {
  if (!gitSync) {
    return "未配置";
  }

  const labels = {
    untracked: "未跟踪",
    synced: "已同步",
    local_changes: "待推送",
    remote_changes: "待拉取",
    diverged: "已分叉",
    error: "异常",
  } as const;

  return labels[gitSync.status];
}

/** 为 Git 状态选择对应的徽标视觉风格。 */
function gitStatusVariant(gitSync?: SkillGitSyncStatus) {
  if (!gitSync || gitSync.status === "untracked" || gitSync.status === "error") {
    return "muted" as const;
  }

  if (gitSync.status === "synced") {
    return "accent" as const;
  }

  return "default" as const;
}

/** 为卡片状态生成更直接的推送提示文案。 */
function buildGitPushHint(gitSync: SkillGitSyncStatus | undefined) {
  if (!gitSync) {
    return "这里展示的是推送目标位置，不代表该 Skill 已经成功同步到远端。";
  }

  if (gitSync.status === "untracked") {
    return "当前 Skill 尚未建立远端跟踪关系，首次推送会创建远端路径。";
  }

  if (gitSync.status === "local_changes") {
    return "本地有新修改，可继续推送到远端。";
  }

  if (gitSync.status === "synced") {
    return "当前本地与记录的远端基线一致，再次操作将使用本地内容覆盖远端目标路径。";
  }

  if (gitSync.status === "remote_changes") {
    return "远端已有新修改，当前页不建议直接覆盖，请先在技能模块处理同步到本地。";
  }

  if (gitSync.status === "diverged") {
    return "本地和远端都发生了修改，当前页不建议直接覆盖，请先处理冲突。";
  }

  return "当前无法确认远端状态，暂不建议直接覆盖。";
}

/** 根据 Git 状态决定当前按钮文案。 */
function getPushButtonLabel(gitSync?: SkillGitSyncStatus) {
  if (gitSync?.status === "synced") {
    return "覆盖";
  }

  return "推送";
}

/** 根据 Git 状态决定当前按钮是否允许直接操作。 */
function isPushActionDisabled(gitSync?: SkillGitSyncStatus) {
  return gitSync?.status === "remote_changes" || gitSync?.status === "diverged" || gitSync?.status === "error";
}

/** 推送至 Git 主工作区，负责列出本地 Skill 并执行推送。 */
export function GitPushWorkspace({
  initialSkills,
  initialConfig,
}: GitPushWorkspaceProps) {
  const { toast, updateToast } = useToast();
  const [skills, setSkills] = useState(initialSkills);
  const [search, setSearch] = useState("");
  const [refreshingSkills, setRefreshingSkills] = useState(false);
  const [activePushId, setActivePushId] = useState("");

  /** 按关键字过滤本地 Skill，便于聚焦需要推送的条目。 */
  const filteredSkills = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = skills.filter((skill) => {
      if (!normalizedSearch) {
        return true;
      }

      return [skill.name, skill.description, skill.path, skill.gitSync?.relativePath ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });

    return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [search, skills]);

  /** 主动刷新本地受管 Skill 列表和 Git 状态。 */
  async function refreshSkills() {
    setRefreshingSkills(true);

    const response = await fetch("/api/skills");
    const payload = (await response.json()) as Partial<SkillsResponse> & {
      error?: string;
    };

    if (!response.ok || !payload.skills) {
      toast({
        title: "刷新技能列表失败",
        description: payload.error ?? "刷新技能列表失败。",
        variant: "error",
      });
      setRefreshingSkills(false);
      return;
    }

    setSkills(payload.skills);
    setRefreshingSkills(false);
  }

  /** 执行单个本地 Skill 的 Git 推送。 */
  async function pushSkill(skill: SkillSummary) {
    const progressToastId = toast({
      title: "准备推送",
      description: `正在整理 ${skill.name} 的本地内容并检查远端状态。`,
    });
    setActivePushId(skill.id);

    const progressSteps: GitPushProgressEvent[] = [
      {
        step: "prepare",
        title: "准备推送",
        description: `正在整理 ${skill.name} 的本地内容并检查远端状态。`,
      },
      {
        step: "commit",
        title: "生成提交",
        description: `正在为 ${skill.name} 生成 Git 提交记录。`,
      },
      {
        step: "push",
        title: "推送远端",
        description: `正在把 ${skill.name} 推送到 ${skill.gitSync?.branch || initialConfig.branch}。`,
      },
    ];

    updateToast(progressToastId, progressSteps[0]);
    window.setTimeout(() => updateToast(progressToastId, progressSteps[1]), 300);
    window.setTimeout(() => updateToast(progressToastId, progressSteps[2]), 700);

    const response = await fetch(`/api/skills/${encodeURIComponent(skill.id)}/git-sync/push`, {
      method: "POST",
    });
    const payload = (await response.json()) as Partial<SkillGitSyncResponse> & {
      error?: string;
    };

    if (!response.ok || !payload.gitSync || !payload.activity) {
      updateToast(progressToastId, {
        title: "推送失败",
        description: payload.error ?? "推送 Skill 失败。",
        variant: "error",
      });
      setActivePushId("");
      return;
    }

    updateToast(progressToastId, {
      title: "推送完成",
      description: payload.activity.message,
      variant: "success",
    });
    setActivePushId("");
    await refreshSkills();
  }

  return (
    <Card className="min-h-[680px] overflow-hidden">
      <CardHeader className="border-b border-slate-200/80 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>推送至Git</CardTitle>
            <CardDescription>
              从当前受管 Skill 列表中选择条目并推送到默认仓库。未绑定 Skill 会在首次推送时自动建立跟踪关系。
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void refreshSkills()}
            disabled={refreshingSkills}
          >
            {refreshingSkills ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            刷新
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="muted" className="copy-content gap-1 px-2.5 py-1">
            <span className="ui-chrome text-slate-400">默认目标仓库</span>
            <span className="font-mono text-[11px] text-slate-700">
              {initialConfig.repositoryUrl}
            </span>
          </Badge>
          <Badge variant="muted" className="copy-content gap-1 px-2.5 py-1">
            <span className="ui-chrome text-slate-400">默认目标分支</span>
            <span className="font-mono text-[11px] text-slate-700">
              {initialConfig.branch}
            </span>
          </Badge>
        </div>
        <div className="relative mt-3 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索本地 Skill"
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 p-4">
            {filteredSkills.length ? (
              filteredSkills.map((skill) => {
                const gitSync = skill.gitSync;
                const isCurrentPush = activePushId === skill.id;
                const buttonLabel = getPushButtonLabel(gitSync);
                const pushDisabled = isPushActionDisabled(gitSync);

                return (
                  <div
                    key={skill.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {skill.name}
                          </p>
                          <Badge variant={gitStatusVariant(gitSync)}>
                            {formatGitStatusLabel(gitSync)}
                          </Badge>
                          <Badge variant="muted">{gitSync?.branch || initialConfig.branch}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {skill.description || gitSync?.message || "暂无描述"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void pushSkill(skill)}
                        disabled={isCurrentPush || pushDisabled}
                      >
                        {isCurrentPush ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowUpToLine className="h-4 w-4" />
                        )}
                        {buttonLabel}
                      </Button>
                    </div>

                    <div className="copy-content mt-3 rounded-md bg-white px-3 py-2 text-xs text-slate-500">
                      <div>
                        <span className="ui-chrome text-slate-400">本地目录：</span>
                        <span className="font-mono">{skill.path}</span>
                      </div>
                      <div className="mt-1 break-all">
                        <span className="ui-chrome text-slate-400">目标仓库：</span>
                        <span className="font-mono">
                          {gitSync?.repositoryUrl || initialConfig.repositoryUrl}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span className="ui-chrome text-slate-400">目标分支：</span>
                        <span className="font-mono">
                          {gitSync?.branch || initialConfig.branch}
                        </span>
                      </div>
                      <div className="mt-1 break-all">
                        <span className="ui-chrome text-slate-400">目标路径：</span>
                        <span className="font-mono">
                          {gitSync?.relativePath || `${initialConfig.baseDirectory}/${skill.id}`}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>{buildGitPushHint(gitSync)}</span>
                      <span>{formatDate(skill.updatedAt)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                <p className="text-sm font-medium text-slate-900">没有匹配的本地 Skill</p>
                <p className="mt-1 text-sm text-slate-500">
                  调整搜索关键字，或先在技能模块中创建、导入 Skill。
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
