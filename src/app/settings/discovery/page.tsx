import { DiscoverySettingsForm } from "@/components/discovery-settings-form";
import {
  getDefaultDiscoveryRoots,
  readScanRootConfig,
} from "@/lib/skills/discovery-config";

/** 技能发现设置页，维护自动扫描来源与额外根目录。 */
export default async function SettingsDiscoveryPage() {
  const [scanRootConfig, defaultDiscoveryRoots] = await Promise.all([
    readScanRootConfig(),
    Promise.resolve(getDefaultDiscoveryRoots()),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="ui-chrome text-sm font-semibold text-slate-900">默认扫描来源</h2>
        <p className="ui-chrome mt-1 text-sm text-slate-500">
          系统会自动扫描用户主目录和当前工作区下的常见 Skill 目录。
        </p>
        <div className="mt-4 space-y-2">
          {defaultDiscoveryRoots.map((root) => (
            <div
              key={root.path}
              className="copy-content rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700"
            >
              <div className="ui-chrome text-xs text-slate-500">{root.label}</div>
              <div className="mt-1 break-all">{root.path}</div>
            </div>
          ))}
        </div>
      </section>

      <DiscoverySettingsForm initialExtraRoots={scanRootConfig.extraRoots} />
    </div>
  );
}
