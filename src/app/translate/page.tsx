import { AppShell } from "@/components/app-shell";
import { TranslationWorkspace } from "@/components/translation-workspace";
import { listSkills } from "@/lib/skills/skill-repository";
import { translationProviderCatalog } from "@/lib/translation/catalog";

/** 翻译技能页面，提供受管技能选择与翻译执行工作区。 */
export default async function TranslatePage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const params = await searchParams;
  const skills = await listSkills();

  return (
    <AppShell
      title="翻译技能"
      description="选择受管技能并生成中英互译结果。"
      currentPath="/translate"
    >
      <TranslationWorkspace
        initialSkills={skills}
        initialSelectedId={params.skill}
        providers={translationProviderCatalog}
      />
    </AppShell>
  );
}
