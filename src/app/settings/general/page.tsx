import { discoveryConfigPath } from "@/lib/skills/discovery-config";
import { skillsRoot } from "@/lib/skills/config";

/** 通用设置页，展示全局基础配置。 */
export default function SettingsGeneralPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="ui-chrome text-sm font-semibold text-slate-900">受管技能根目录</h2>
        <p className="ui-chrome mt-1 text-sm text-slate-500">
          如果你希望界面指向其他目录，可以通过 `SKILLS_ROOT` 环境变量覆盖默认路径。
        </p>
        <div className="copy-content mt-4 rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">
          {skillsRoot}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="ui-chrome text-sm font-semibold text-slate-900">扫描配置文件</h2>
        <p className="ui-chrome mt-1 text-sm text-slate-500">
          技能发现相关的额外扫描根目录会保存在项目内的本地 JSON 文件中。
        </p>
        <div className="copy-content mt-4 rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">
          {discoveryConfigPath}
        </div>
      </section>
    </div>
  );
}
