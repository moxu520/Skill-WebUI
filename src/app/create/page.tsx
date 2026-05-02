import { AppShell } from "@/components/app-shell";
import { SkillCreateForm } from "@/components/skill-create-form";

export default function CreatePage() {
  return (
    <AppShell
      title="新建技能"
      description="创建一个新的本地技能，并编写初始 Markdown 内容。"
      currentPath="/create"
    >
      <SkillCreateForm />
    </AppShell>
  );
}
