"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** 自动发现扫描设置表单，维护额外扫描根目录列表。 */
export function DiscoverySettingsForm({
  initialExtraRoots,
}: {
  initialExtraRoots: string[];
}) {
  const [value, setValue] = useState(initialExtraRoots.join("\n"));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const previewCount = useMemo(
    () =>
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean).length,
    [value],
  );

  /** 将当前文本框中的路径列表写回扫描配置文件。 */
  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");

    const extraRoots = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const response = await fetch("/api/settings/discovery-roots", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraRoots }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "保存扫描设置失败。");
      setSaving(false);
      return;
    }

    setValue(payload.config.extraRoots.join("\n"));
    setMessage("扫描根目录已更新。");
    setSaving(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            自定义扫描根目录
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            每行一个绝对路径。这里只影响自动发现候选，不会修改受管技能根目录。
          </p>
        </div>
        <div className="rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
          {previewCount} 个目录
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <label className="text-sm font-medium text-slate-700">
          额外扫描路径
        </label>
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={"/Users/you/.local-skills\n/Volumes/team-shared/skills"}
          className="min-h-32 font-mono text-sm"
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          保存扫描配置
        </Button>
      </div>
    </section>
  );
}
