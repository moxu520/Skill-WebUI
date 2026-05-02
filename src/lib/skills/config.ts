import path from "node:path";
import { mkdir } from "node:fs/promises";

/** 受管技能目录的绝对路径。 */
export const skillsRoot = path.resolve(
  process.env.SKILLS_ROOT ?? path.join(process.cwd(), "skills"),
);

/** 确保受管技能根目录存在，不存在时自动创建。 */
export async function ensureSkillsRoot() {
  await mkdir(skillsRoot, { recursive: true });
}
