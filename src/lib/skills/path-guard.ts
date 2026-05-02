import path from "node:path";
import { skillsRoot } from "@/lib/skills/config";

function normalizeAbsolute(target: string) {
  return path.resolve(target);
}

export function assertInsideSkillsRoot(target: string) {
  const root = normalizeAbsolute(skillsRoot);
  const absoluteTarget = normalizeAbsolute(target);

  if (
    absoluteTarget !== root &&
    !absoluteTarget.startsWith(`${root}${path.sep}`)
  ) {
    throw new Error("目标路径超出了受管技能目录范围。");
  }

  return absoluteTarget;
}

export function sanitizeSkillId(rawId: string) {
  const id = decodeURIComponent(rawId).trim();

  if (!id || id.includes("/") || id.includes("\\") || id === "." || id === "..") {
    throw new Error("技能标识不合法。");
  }

  return id;
}

export function resolveSkillDir(id: string) {
  return assertInsideSkillsRoot(path.join(skillsRoot, sanitizeSkillId(id)));
}

export function validateImportSource(sourcePath: string) {
  const trimmed = sourcePath.trim();

  if (!path.isAbsolute(trimmed)) {
    throw new Error("导入路径必须是绝对路径。");
  }

  const absolute = path.resolve(trimmed);

  return absolute;
}
