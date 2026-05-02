import { AppShell } from "@/components/app-shell";
import { SkillWorkspace } from "@/components/skill-workspace";
import { skillsRoot } from "@/lib/skills/config";
import { listDiscoveredSkills } from "@/lib/skills/discovery";
import { listSkills } from "@/lib/skills/skill-repository";

/** 技能工作区页面，汇总受管技能与自动发现候选。 */
export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const params = await searchParams;
  const [skills, discoveredSkills] = await Promise.all([
    listSkills(),
    listDiscoveredSkills(),
  ]);

  return (
    <AppShell
      title="技能"
      description="在一个工作区内浏览并管理本地技能。"
      currentPath="/skills"
    >
      <SkillWorkspace
        initialSkills={skills}
        initialDiscoveredSkills={discoveredSkills}
        initialSelectedId={params.skill}
        skillsRoot={skillsRoot}
      />
    </AppShell>
  );
}
