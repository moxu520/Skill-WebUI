"use client";

import { useState } from "react";
import { GitBranch, LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { GitSyncConfig } from "@/lib/types";

/** Git 配置表单的初始数据。 */
type GitSyncSettingsFormProps = {
  initialConfig: GitSyncConfig;
  defaultConfig: GitSyncConfig;
};

/** 管理默认仓库地址与分支的 Git 配置表单。 */
export function GitSyncSettingsForm({
  initialConfig,
  defaultConfig,
}: GitSyncSettingsFormProps) {
  const { toast } = useToast();
  const [repositoryUrl, setRepositoryUrl] = useState(initialConfig.repositoryUrl);
  const [branch, setBranch] = useState(initialConfig.branch);
  const [saving, setSaving] = useState(false);

  /** 将当前输入的 Git 配置写回本地配置文件。 */
  async function handleSave() {
    setSaving(true);

    const response = await fetch("/api/settings/git-sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repositoryUrl,
        branch,
      }),
    });
    const payload = (await response.json()) as {
      config?: GitSyncConfig;
      error?: string;
    };

    if (!response.ok || !payload.config) {
      toast({
        title: "保存 Git 配置失败",
        description: payload.error ?? "保存 Git 配置失败。",
        variant: "error",
      });
      setSaving(false);
      return;
    }

    setRepositoryUrl(payload.config.repositoryUrl);
    setBranch(payload.config.branch);
    toast({
      title: "Git 配置已更新",
      description: "默认仓库地址和分支已保存。",
      variant: "success",
    });
    setSaving(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="ui-chrome">
          <h2 className="text-sm font-semibold text-slate-900">默认同步目标</h2>
          <p className="mt-1 text-sm text-slate-500">
            Git 同步模块会默认使用这里配置的仓库与分支。认证凭据沿用系统 Git 环境。
          </p>
        </div>
        <div className="rounded-md bg-slate-50 p-2 text-slate-500">
          <GitBranch className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="ui-chrome text-sm font-medium text-slate-700">仓库地址</label>
          <Input
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            placeholder="https://github.com/moxu520/Skill-WebUI.git"
          />
        </div>
        <div className="space-y-2">
          <label className="ui-chrome text-sm font-medium text-slate-700">默认分支</label>
          <Input
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            placeholder="master"
          />
        </div>
      </div>

      <div className="mt-4 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
        <p>当前仓库推导默认值：</p>
        <p className="copy-content mt-2 font-mono text-xs text-slate-700">
          {defaultConfig.repositoryUrl}
        </p>
        <p className="copy-content mt-1 font-mono text-xs text-slate-700">
          {defaultConfig.branch}
        </p>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          {saving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          保存 Git 配置
        </Button>
      </div>
    </section>
  );
}
