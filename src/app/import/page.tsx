import { AppShell } from "@/components/app-shell";
import { SkillImportForm } from "@/components/skill-import-form";
import { listDiscoveredSkills } from "@/lib/skills/discovery";

/** 独立的技能导入页面，预加载自动发现候选列表。 */
export default async function ImportPage() {
  const discoveredSkills = await listDiscoveredSkills();

  return (
    <AppShell
      title="导入技能"
      description="从本地目录或 Git 仓库导入已有 Skill。"
      currentPath="/import"
    >
      <SkillImportForm initialDiscoveredSkills={discoveredSkills} />
    </AppShell>
  );
}
