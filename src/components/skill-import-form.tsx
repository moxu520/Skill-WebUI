"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Import, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SkillImportForm({
  compact = false,
  onSuccess,
}: {
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [sourcePath, setSourcePath] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const response = await fetch("/api/skills/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePath }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "导入技能失败。");
      setSaving(false);
      return;
    }

    onSuccess?.();
    router.push(`/skills?skill=${encodeURIComponent(payload.skill.id)}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? "flex flex-col gap-5 p-5" : "mx-auto flex max-w-3xl flex-col gap-6 p-5 lg:p-8"}
    >
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">导入本地技能目录</h2>
          <p className="text-sm text-slate-500">
            请输入一个绝对路径。目录中必须包含 `SKILL.md`，系统会将整个目录复制到受管技能根目录中。
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">来源路径</label>
          <Input
            value={sourcePath}
            onChange={(event) => setSourcePath(event.target.value)}
            placeholder="/Users/you/skills/my-skill"
            required
          />
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Import className="h-4 w-4" />
            )}
            导入技能
          </Button>
        </div>
      </section>
    </form>
  );
}
