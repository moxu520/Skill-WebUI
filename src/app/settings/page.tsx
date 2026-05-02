import { AppShell } from "@/components/app-shell";
import { skillsRoot } from "@/lib/skills/config";

export default function SettingsPage() {
  return (
    <AppShell
      title="设置"
      description="查看当前本地工作区配置。"
      currentPath="/settings"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-5 lg:p-8">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">受管技能根目录</h2>
          <p className="mt-1 text-sm text-slate-500">
            如果你希望界面指向其他目录，可以通过 `SKILLS_ROOT` 环境变量覆盖默认路径。
          </p>
          <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">
            {skillsRoot}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
