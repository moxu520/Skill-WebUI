import { AppShell } from "@/components/app-shell";
import { DiscoverySettingsForm } from "@/components/discovery-settings-form";
import {
  discoveryConfigPath,
  getDefaultDiscoveryRoots,
  readScanRootConfig,
} from "@/lib/skills/discovery-config";
import { skillsRoot } from "@/lib/skills/config";

/** 设置页，展示受管目录和自动发现相关配置。 */
export default async function SettingsPage() {
  const [scanRootConfig, defaultDiscoveryRoots] = await Promise.all([
    readScanRootConfig(),
    Promise.resolve(getDefaultDiscoveryRoots()),
  ]);

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

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">默认扫描来源</h2>
          <p className="mt-1 text-sm text-slate-500">
            系统会自动扫描用户主目录和当前工作区下的常见 Skill 目录。
          </p>
          <div className="mt-4 space-y-2">
            {defaultDiscoveryRoots.map((root) => (
              <div
                key={root.path}
                className="rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700"
              >
                <div className="text-xs text-slate-500">{root.label}</div>
                <div className="mt-1 break-all">{root.path}</div>
              </div>
            ))}
          </div>
        </section>

        <DiscoverySettingsForm initialExtraRoots={scanRootConfig.extraRoots} />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">扫描配置文件</h2>
          <p className="mt-1 text-sm text-slate-500">
            额外扫描根目录会保存在项目内的本地 JSON 文件中。
          </p>
          <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">
            {discoveryConfigPath}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
