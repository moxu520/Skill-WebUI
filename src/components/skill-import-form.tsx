"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Import, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { DiscoveredSkillSummary } from "@/lib/types";

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

function statusVariant(status: DiscoveredSkillSummary["status"]) {
  if (status === "importable") {
    return "accent";
  }

  return "muted";
}

export function SkillImportForm({
  compact = false,
  initialDiscoveredSkills = [],
  onSuccess,
}: {
  compact?: boolean;
  initialDiscoveredSkills?: DiscoveredSkillSummary[];
  onSuccess?: (skillId: string) => void;
}) {
  const router = useRouter();
  const [sourcePath, setSourcePath] = useState("");
  const [mode, setMode] = useState("discover");
  const [discoveredSkills, setDiscoveredSkills] =
    useState<DiscoveredSkillSummary[]>(initialDiscoveredSkills);
  const [loadingDiscovered, setLoadingDiscovered] = useState(false);
  const [activeImportPath, setActiveImportPath] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadDiscoveredSkills() {
    setLoadingDiscovered(true);
    setError("");

    const response = await fetch("/api/skills/discovery");
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "加载扫描结果失败。");
      setLoadingDiscovered(false);
      return;
    }

    setDiscoveredSkills(payload.skills);
    setLoadingDiscovered(false);
  }

  async function importFromPath(nextPath: string) {
    setSaving(true);
    setActiveImportPath(nextPath);
    setError("");

    const response = await fetch("/api/skills/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePath: nextPath }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "导入技能失败。");
      setSaving(false);
      setActiveImportPath("");
      return;
    }

    onSuccess?.(payload.skill.id);
    router.push(`/skills?skill=${encodeURIComponent(payload.skill.id)}`);
    router.refresh();
    setSaving(false);
    setActiveImportPath("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await importFromPath(sourcePath);
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
          <h2 className="text-sm font-semibold text-slate-900">导入本地技能目录</h2>
          <p className="text-sm text-slate-500">
            自动扫描常见 Skill 目录，或手动输入绝对路径。导入时会把整个目录复制到受管技能根目录中。
          </p>
        </div>

        <Tabs
          value={mode}
          onValueChange={setMode}
          className={compact ? "min-h-0 flex-1 gap-5" : "gap-5"}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="discover">自动扫描</TabsTrigger>
            <TabsTrigger value="manual">手动路径</TabsTrigger>
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

            <ScrollArea className="min-h-0 flex-1 rounded-lg border border-slate-200 bg-slate-50/60">
              <div className="space-y-3 p-3 pb-4">
                {loadingDiscovered ? (
                  <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white">
                    <LoaderCircle className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : discoveredSkills.length ? (
                  discoveredSkills.map((skill) => {
                    const isImportable = skill.status === "importable";
                    const isCurrentImport = saving && activeImportPath === skill.sourcePath;

                    return (
                      <div
                        key={skill.sourcePath}
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
                            onClick={() => void importFromPath(skill.sourcePath)}
                            disabled={!isImportable || saving}
                          >
                            {isCurrentImport ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Import className="h-4 w-4" />
                            )}
                            导入
                          </Button>
                        </div>

                        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
                          {skill.sourcePath}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                          <span>{skill.statusReason}</span>
                          <span>{formatDate(skill.updatedAt)}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                    <p className="text-sm font-medium text-slate-900">没有扫描到可识别的 Skill</p>
                    <p className="mt-1 text-sm text-slate-500">
                      你可以在设置页添加更多扫描根目录，或切换到手动路径导入。
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="manual"
            className={compact ? "mt-0 min-h-0 flex-1 overflow-hidden" : "mt-0 min-h-[420px]"}
          >
            <form
              onSubmit={handleSubmit}
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
                  请输入绝对路径，目录中必须包含 `SKILL.md`。
                </p>
              </div>

              <div className="mt-auto flex justify-end pt-6">
                <Button type="submit" disabled={saving}>
                  {saving && activeImportPath === sourcePath ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Import className="h-4 w-4" />
                  )}
                  导入技能
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
