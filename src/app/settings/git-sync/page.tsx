import { GitSyncSettingsForm } from "@/components/git-sync-settings-form";
import {
  getDefaultGitSyncConfig,
  gitSyncConfigPath,
  readGitSyncConfig,
} from "@/lib/skills/git-sync-config";

/** Git 配置设置页，维护默认仓库地址与分支。 */
export default async function SettingsGitSyncPage() {
  const [config, defaultConfig] = await Promise.all([
    readGitSyncConfig(),
    getDefaultGitSyncConfig(),
  ]);

  return (
    <div className="space-y-6">
      <GitSyncSettingsForm initialConfig={config} defaultConfig={defaultConfig} />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="ui-chrome text-sm font-semibold text-slate-900">配置文件位置</h2>
        <p className="ui-chrome mt-1 text-sm text-slate-500">
          Git 配置保存在项目内的本地 JSON 文件中，不会写入 Skill 正文，也不会在这里直接执行同步。
        </p>
        <div className="copy-content mt-4 rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700">
          {gitSyncConfigPath}
        </div>
      </section>
    </div>
  );
}
