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
  discoverGitSkillsFromRepository,
  findSkillFileName,
  normalizeImportedSkillFile,
  resolveGitSkillDirectory,
} from "@/lib/skills/git-import";
import {
  getLocalSkillGitSyncStatus,
  getSkillGitSyncStatus,
  syncSkillGitBindingAfterRename,
} from "@/lib/skills/git-sync";
import { SKILL_INTERNAL_METADATA_FILE } from "@/lib/skills/skill-metadata";
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
  TranslationMeta,
} from "@/lib/types";

/**
 * 负责受管技能目录的读写、增删改查与导入流程。
 * 该模块是本地 Skill 数据访问的统一入口。
 */

const SKILL_FILE = "SKILL.md";

/** 将技能名称转换为稳定的目录标识。 */
function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** 为派生技能分配一个可用的目录标识，必要时自动追加递增后缀。 */
async function allocateDerivedSkillId(baseId: string) {
  let attempt = sanitizeSkillId(baseId);
  let suffix = 2;

  while (await directoryExists(attempt)) {
    attempt = sanitizeSkillId(`${baseId}-${suffix}`);
    suffix += 1;
  }

  return attempt;
}

/** 列出受管技能根目录下的所有子目录名称。 */
async function readDirectoryNames() {
  await ensureSkillsRoot();
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

/** 读取单个技能目录中的 Markdown、资源列表和更新时间。 */
async function readSkillMarkdown(id: string) {
  const directory = resolveSkillDir(id);
  const fileName = await findSkillFileName(directory);
  const filePath = path.join(directory, fileName);
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
      .filter(
        (entry) =>
          entry.name !== SKILL_FILE &&
          entry.name !== "skill.md" &&
          entry.name !== SKILL_INTERNAL_METADATA_FILE,
      )
      .map((entry) => entry.name),
    updatedAt: skillStat.mtime.toISOString(),
  };
}

/** 判断指定技能目录是否已存在。 */
async function directoryExists(id: string) {
  try {
    await stat(resolveSkillDir(id));
    return true;
  } catch {
    return false;
  }
}

/** 保证技能名称非空，避免生成无效的技能文件。 */
function assertNonEmptyName(name: string) {
  if (!name.trim()) {
    throw new Error("技能名称不能为空。");
  }
}

/** 递归复制整个技能目录，用于导入外部技能。 */
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

/** 校验目录中是否存在技能主文件，不存在时抛出明确错误。 */
async function assertSkillFileExists(directory: string) {
  await findSkillFileName(directory);
}

/** 将技能目录转换成列表页需要的轻量摘要。 */
async function toSummary(id: string): Promise<SkillSummary | null> {
  try {
    const [{ parsed, updatedAt }, gitSync] = await Promise.all([
      readSkillMarkdown(id),
      getLocalSkillGitSyncStatus(id),
    ]);

    return {
      id,
      name: parsed.title,
      description: parsed.description,
      path: path.relative(process.cwd(), resolveSkillDir(id)),
      updatedAt,
      gitSync,
    };
  } catch {
    return null;
  }
}

/** 列出受管目录中的全部技能摘要，按最近更新时间倒序排序。 */
export async function listSkills() {
  const directories = await readDirectoryNames();
  const skills = await Promise.all(directories.map((directory) => toSummary(directory)));

  return skills
    .filter((skill): skill is SkillSummary => skill !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 读取单个技能的完整详情，包括 Markdown 原文与资源列表。 */
export async function getSkill(id: string): Promise<SkillDetail> {
  const safeId = sanitizeSkillId(id);
  const [{ parsed, assets, updatedAt }, gitSync] = await Promise.all([
    readSkillMarkdown(safeId),
    getSkillGitSyncStatus(safeId),
  ]);

  return {
    id: safeId,
    name: parsed.title,
    description: parsed.description,
    path: path.relative(process.cwd(), resolveSkillDir(safeId)),
    updatedAt,
    contentMarkdown: buildSkillMarkdown({
      title: parsed.title,
      description: parsed.description,
      bodyMarkdown: parsed.bodyMarkdown,
    }),
    bodyMarkdown: parsed.bodyMarkdown,
    assets,
    gitSync,
  };
}

/** 创建一个新的技能目录，并生成初始 `SKILL.md`。 */
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

/** 更新技能内容；当目录标识变化时会同步重命名目录。 */
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
    await syncSkillGitBindingAfterRename(safeId, targetId);
  }

  const markdown = buildSkillMarkdown({
    title: input.name,
    description: input.description,
    bodyMarkdown: input.bodyMarkdown,
  });

  await writeFile(path.join(targetDir, SKILL_FILE), markdown, "utf8");
  return getSkill(targetId);
}

/** 删除整个技能目录。 */
export async function deleteSkill(id: string) {
  const safeId = sanitizeSkillId(id);
  await rm(resolveSkillDir(safeId), { recursive: true, force: false });
}

/** 从外部本地目录导入技能，并复制到受管目录中。 */
export async function importSkill(input: ImportSkillInput) {
  if (input.sourceType === "git") {
    return importGitSkill(
      input.sessionId,
      input.relativeSkillPath,
      input.repositoryUrl,
      input.branch,
      input.lastSyncedCommit,
    );
  }

  const source = validateImportSource(input.sourcePath);
  const sourceStat = await stat(source);

  if (!sourceStat.isDirectory()) {
    throw new Error("导入路径必须指向一个目录。");
  }

  await assertSkillFileExists(source);

  const targetId = sanitizeSkillId(path.basename(source));

  if (await directoryExists(targetId)) {
    throw new Error("同名目录的技能已存在。");
  }

  const targetDir = resolveSkillDir(targetId);

  try {
    await copyDirectory(source, targetDir);
    await normalizeImportedSkillFile(targetDir);
    await assertSkillFileExists(targetDir);
    return await getSkill(targetId);
  } catch (error) {
    await rm(targetDir, { recursive: true, force: true });

    throw error instanceof Error ? error : new Error("导入技能失败。");
  }
}

/** 扫描 Git 仓库中的可导入技能目录，并返回候选列表。 */
export async function discoverGitSkills(repositoryUrl: string, branch?: string) {
  return discoverGitSkillsFromRepository(repositoryUrl, branch);
}

/** 从 Git 扫描会话中导入指定技能目录。 */
export async function importGitSkill(
  sessionId: string,
  relativeSkillPath: string,
  _repositoryUrl?: string,
  _branch?: string,
  _lastSyncedCommit?: string,
) {
  void _repositoryUrl;
  void _branch;
  void _lastSyncedCommit;

  const source = await resolveGitSkillDirectory(sessionId, relativeSkillPath);
  await assertSkillFileExists(source);

  const targetId = sanitizeSkillId(path.basename(source));

  if (await directoryExists(targetId)) {
    throw new Error("同名目录的技能已存在。");
  }

  const targetDir = resolveSkillDir(targetId);

  try {
    await copyDirectory(source, targetDir);
    await normalizeImportedSkillFile(targetDir);
    await assertSkillFileExists(targetDir);
    return await getSkill(targetId);
  } catch (error) {
    await rm(targetDir, { recursive: true, force: true });

    throw error instanceof Error ? error : new Error("导入技能失败。");
  }
}

/** 翻译结果保存时需要的输入结构。 */
export type SaveTranslatedSkillInput = {
  sourceId: string;
  name: string;
  description: string;
  bodyMarkdown: string;
  saveMode: "overwrite" | "fork";
  slugSuffix: string;
  titleSuffix: string;
  meta: TranslationMeta;
};

/** 保存翻译后的技能内容，支持覆盖原技能或生成同目录副本。 */
export async function saveTranslatedSkill(input: SaveTranslatedSkillInput) {
  const sourceId = sanitizeSkillId(input.sourceId);

  if (input.saveMode === "overwrite") {
    const skill = await updateSkill(sourceId, {
      name: input.name,
      description: input.description,
      bodyMarkdown: input.bodyMarkdown,
      slug: sourceId,
    });

    return { skill, translationMeta: input.meta };
  }

  const sourceDirectory = resolveSkillDir(sourceId);
  const targetId = await allocateDerivedSkillId(`${sourceId}-${input.slugSuffix}`);
  const targetDirectory = resolveSkillDir(targetId);

  try {
    await copyDirectory(sourceDirectory, targetDirectory);

    const markdown = buildSkillMarkdown({
      title: input.name.trim()
        ? `${input.name.trim()}${input.titleSuffix}`.trim()
        : `${sourceId}${input.titleSuffix}`.trim(),
      description: input.description,
      bodyMarkdown: input.bodyMarkdown,
    });

    await writeFile(path.join(targetDirectory, SKILL_FILE), markdown, "utf8");

    return {
      skill: await getSkill(targetId),
      translationMeta: input.meta,
    };
  } catch (error) {
    await rm(targetDirectory, { recursive: true, force: true });
    throw error instanceof Error ? error : new Error("保存翻译结果失败。");
  }
}
