import { AppShell } from "@/components/app-shell";
import { SkillWorkspace } from "@/components/skill-workspace";
import { skillsRoot } from "@/lib/skills/config";
import { listSkills } from "@/lib/skills/skill-repository";

/** 技能工作区页面，首屏只加载受管技能列表，自动发现延后到导入流程。 */
export default async function SkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const params = await searchParams;
  const skills = await listSkills();

  return (
    <AppShell
      title="技能"
      description="在一个工作区内浏览并管理本地技能。"
      currentPath="/skills"
    >
      <SkillWorkspace
        initialSkills={skills}
        initialSelectedId={params.skill}
        skillsRoot={skillsRoot}
      />
    </AppShell>
  );
}
