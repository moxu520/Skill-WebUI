import { AppShell } from "@/components/app-shell";
import { SkillCreateForm } from "@/components/skill-create-form";

/** 独立的新建技能页面，适合非弹窗场景使用。 */
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
