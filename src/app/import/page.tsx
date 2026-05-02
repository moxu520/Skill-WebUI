import { AppShell } from "@/components/app-shell";
import { SkillImportForm } from "@/components/skill-import-form";

export default function ImportPage() {
  return (
    <AppShell
      title="导入技能"
      description="将现有本地技能目录复制到受管技能目录中。"
      currentPath="/import"
    >
      <SkillImportForm />
    </AppShell>
  );
}
