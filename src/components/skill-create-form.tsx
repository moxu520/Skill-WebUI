"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** 新建技能表单，支持页面态和弹窗态两种展示方式。 */
export function SkillCreateForm({
  compact = false,
  onSuccess,
}: {
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const formClassName = compact
    ? "flex flex-col gap-5 p-5"
    : "mx-auto flex max-w-5xl flex-col gap-6 p-5 lg:p-8";
  const gridClassName = compact
    ? "grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"
    : "grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]";
  const editorClassName = compact
    ? "min-h-[420px] font-mono text-[13px]"
    : "min-h-[560px] font-mono text-[13px]";
  const [form, setForm] = useState({
    name: "",
    description: "",
    bodyMarkdown: "",
    slug: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /** 提交新技能创建请求，并在成功后跳转到详情视图。 */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const response = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "创建技能失败。");
      setSaving(false);
      return;
    }

    onSuccess?.();
    router.push(`/skills?skill=${encodeURIComponent(payload.skill.id)}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={formClassName}>
      <div className={gridClassName}>
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">名称</label>
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="请输入技能名称"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">目录标识</label>
            <Input
              value={form.slug}
              onChange={(event) =>
                setForm((current) => ({ ...current, slug: event.target.value }))
              }
              placeholder="可选，例如 my-skill"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">描述</label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="用于列表卡片展示的简短描述"
            />
          </div>
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            创建技能
          </Button>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Markdown 正文</h2>
            <p className="text-sm text-slate-500">
              标题和描述会单独存储，并在保存时一并写入 `SKILL.md`。
            </p>
          </div>
          <Textarea
            rows={24}
            value={form.bodyMarkdown}
            onChange={(event) =>
              setForm((current) => ({ ...current, bodyMarkdown: event.target.value }))
            }
            placeholder="## 用法&#10;&#10;在这里描述这个技能的用途、输入和输出..."
            className={editorClassName}
          />
        </section>
      </div>
    </form>
  );
}
