import path from "node:path";
import { mkdir } from "node:fs/promises";

export const skillsRoot = path.resolve(
  process.env.SKILLS_ROOT ?? path.join(process.cwd(), "skills"),
);

export async function ensureSkillsRoot() {
  await mkdir(skillsRoot, { recursive: true });
}
