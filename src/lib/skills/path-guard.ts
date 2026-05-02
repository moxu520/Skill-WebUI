import path from "node:path";
import { skillsRoot } from "@/lib/skills/config";

/**
 * 负责所有技能路径相关的安全校验，避免读写操作越出受管根目录。
 */

/** 将任意路径规范化为绝对路径，便于后续比较。 */
function normalizeAbsolute(target: string) {
  return path.resolve(target);
}

/** 校验目标路径是否位于受管技能根目录内，非法时直接抛错。 */
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

/** 校验并清洗技能目录标识，阻止路径穿越和非法目录名。 */
export function sanitizeSkillId(rawId: string) {
  const id = decodeURIComponent(rawId).trim();

  if (!id || id.includes("/") || id.includes("\\") || id === "." || id === "..") {
    throw new Error("技能标识不合法。");
  }

  return id;
}

/** 根据技能标识解析出技能目录的绝对路径。 */
export function resolveSkillDir(id: string) {
  return assertInsideSkillsRoot(path.join(skillsRoot, sanitizeSkillId(id)));
}

/** 校验导入源路径必须为绝对路径，并返回规范化后的结果。 */
export function validateImportSource(sourcePath: string) {
  const trimmed = sourcePath.trim();

  if (!path.isAbsolute(trimmed)) {
    throw new Error("导入路径必须是绝对路径。");
  }

  const absolute = path.resolve(trimmed);

  return absolute;
}
