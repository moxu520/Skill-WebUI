import { GitPushWorkspace } from "@/components/git-push-workspace";
import { readGitSyncConfig } from "@/lib/skills/git-sync-config";
import { listSkills } from "@/lib/skills/skill-repository";

/** 多端同步模块中的推送至 Git 页面。 */
export default async function SyncGitPushPage() {
  const [skills, config] = await Promise.all([listSkills(), readGitSyncConfig()]);

  return <GitPushWorkspace initialSkills={skills} initialConfig={config} />;
}
