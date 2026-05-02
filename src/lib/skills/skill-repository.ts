import path from "node:path";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  buildSkillMarkdown,
  parseSkillMarkdown,
} from "@/lib/skills/skill-parser";
import { ensureSkillsRoot, skillsRoot } from "@/lib/skills/config";
import {
  assertInsideSkillsRoot,
  resolveSkillDir,
  sanitizeSkillId,
  validateImportSource,
} from "@/lib/skills/path-guard";
import type {
  CreateSkillInput,
  ImportSkillInput,
  SkillDetail,
  SkillSummary,
} from "@/lib/types";

const SKILL_FILE = "SKILL.md";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function readDirectoryNames() {
  await ensureSkillsRoot();
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function readSkillMarkdown(id: string) {
  const directory = resolveSkillDir(id);
  const filePath = path.join(directory, SKILL_FILE);
  const raw = await readFile(filePath, "utf8");
  const parsed = parseSkillMarkdown(raw, id);
  const directoryEntries = await readdir(directory, { withFileTypes: true });
  const skillStat = await stat(filePath);

  return {
    directory,
    filePath,
    raw,
    parsed,
    assets: directoryEntries
      .filter((entry) => entry.name !== SKILL_FILE)
      .map((entry) => entry.name),
    updatedAt: skillStat.mtime.toISOString(),
  };
}

async function directoryExists(id: string) {
  try {
    await stat(resolveSkillDir(id));
    return true;
  } catch {
    return false;
  }
}

function assertNonEmptyName(name: string) {
  if (!name.trim()) {
    throw new Error("技能名称不能为空。");
  }
}

async function copyDirectory(source: string, target: string) {
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function toSummary(id: string): Promise<SkillSummary | null> {
  try {
    const { parsed, updatedAt } = await readSkillMarkdown(id);

    return {
      id,
      name: parsed.title,
      description: parsed.description,
      path: path.relative(process.cwd(), resolveSkillDir(id)),
      updatedAt,
    };
  } catch {
    return null;
  }
}

export async function listSkills() {
  const directories = await readDirectoryNames();
  const skills = await Promise.all(directories.map((directory) => toSummary(directory)));

  return skills
    .filter((skill): skill is SkillSummary => skill !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSkill(id: string): Promise<SkillDetail> {
  const safeId = sanitizeSkillId(id);
  const { parsed, raw, assets, updatedAt } = await readSkillMarkdown(safeId);

  return {
    id: safeId,
    name: parsed.title,
    description: parsed.description,
    path: path.relative(process.cwd(), resolveSkillDir(safeId)),
    updatedAt,
    contentMarkdown: raw,
    bodyMarkdown: parsed.bodyMarkdown,
    assets,
  };
}

export async function createSkill(input: CreateSkillInput) {
  assertNonEmptyName(input.name);
  await ensureSkillsRoot();

  const slug = sanitizeSkillId(input.slug?.trim() || slugify(input.name) || "skill");

  if (await directoryExists(slug)) {
    throw new Error("相同目录标识的技能已存在。");
  }

  const directory = resolveSkillDir(slug);
  await mkdir(directory, { recursive: false });

  const markdown = buildSkillMarkdown({
    title: input.name,
    description: input.description,
    bodyMarkdown: input.bodyMarkdown,
  });

  await writeFile(path.join(directory, SKILL_FILE), markdown, "utf8");
  return getSkill(slug);
}

export async function updateSkill(id: string, input: CreateSkillInput) {
  const safeId = sanitizeSkillId(id);
  assertNonEmptyName(input.name);

  const currentDir = resolveSkillDir(safeId);
  const desiredSlug = sanitizeSkillId(input.slug?.trim() || safeId);
  let targetDir = currentDir;
  let targetId = safeId;

  if (desiredSlug !== safeId) {
    if (await directoryExists(desiredSlug)) {
      throw new Error("相同目录标识的技能已存在。");
    }

    targetDir = assertInsideSkillsRoot(path.join(skillsRoot, desiredSlug));
    await rename(currentDir, targetDir);
    targetId = desiredSlug;
  }

  const markdown = buildSkillMarkdown({
    title: input.name,
    description: input.description,
    bodyMarkdown: input.bodyMarkdown,
  });

  await writeFile(path.join(targetDir, SKILL_FILE), markdown, "utf8");
  return getSkill(targetId);
}

export async function deleteSkill(id: string) {
  const safeId = sanitizeSkillId(id);
  await rm(resolveSkillDir(safeId), { recursive: true, force: false });
}

export async function importSkill(input: ImportSkillInput) {
  const source = validateImportSource(input.sourcePath);
  const sourceStat = await stat(source);

  if (!sourceStat.isDirectory()) {
    throw new Error("导入路径必须指向一个目录。");
  }

  const skillFile = path.join(source, SKILL_FILE);

  try {
    await stat(skillFile);
  } catch {
    throw new Error("所选目录中不包含 SKILL.md。");
  }

  const targetId = sanitizeSkillId(path.basename(source));

  if (await directoryExists(targetId)) {
    throw new Error("同名目录的技能已存在。");
  }

  const targetDir = resolveSkillDir(targetId);
  await copyDirectory(source, targetDir);
  return getSkill(targetId);
}
