import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { skillsRoot } from "@/lib/skills/config";
import { readGitSyncConfig } from "@/lib/skills/git-sync-config";
import { sanitizeSkillId } from "@/lib/skills/path-guard";
import { parseSkillMarkdown } from "@/lib/skills/skill-parser";
import type { DiscoveredSkillSummary } from "@/lib/types";

const execFileAsync = promisify(execFile);
const GIT_IMPORT_ROOT = path.join(os.tmpdir(), "skill-webui-git-imports");
const GIT_REPOSITORY_DIR = "repository";
const UPPERCASE_SKILL_FILE = "SKILL.md";
const LOWERCASE_SKILL_FILE = "skill.md";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;
const SKIPPED_DIRECTORY_NAMES = new Set([".git", "node_modules"]);

type GitDiscoveryCandidate = {
  directory: string;
  relativeSkillPath: string;
  skillFileName: string;
};

/** 校验 Git 仓库地址非空，并返回去首尾空格后的结果。 */
export function validateRepositoryUrl(repositoryUrl: string) {
  const trimmed = repositoryUrl.trim();

  if (!trimmed) {
    throw new Error("Git 仓库地址不能为空。");
  }

  return trimmed;
}

/** 返回单次 Git 导入会话所在的绝对路径。 */
function resolveSessionDir(sessionId: string) {
  return path.join(GIT_IMPORT_ROOT, sanitizeSkillId(sessionId));
}

/** 返回某个 Git 导入会话中的仓库目录绝对路径。 */
function resolveSessionRepositoryDir(sessionId: string) {
  return path.join(resolveSessionDir(sessionId), GIT_REPOSITORY_DIR);
}

/** 判断目录项是否是可识别的技能主文件。 */
function isSkillFileName(fileName: string) {
  return fileName === UPPERCASE_SKILL_FILE || fileName === LOWERCASE_SKILL_FILE;
}

/** 判断候选目录是否已经位于受管技能根目录内。 */
function isInsideManagedRoot(target: string) {
  const root = path.resolve(skillsRoot);
  const absoluteTarget = path.resolve(target);

  return absoluteTarget === root || absoluteTarget.startsWith(`${root}${path.sep}`);
}

/** 读取受管技能根目录下已有目录标识集合。 */
async function readManagedSkillIds() {
  try {
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    return new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  } catch {
    return new Set<string>();
  }
}

/** 清理过期 Git 导入会话目录，避免临时文件持续堆积。 */
export async function cleanupExpiredGitImportSessions() {
  try {
    const entries = await readdir(GIT_IMPORT_ROOT, { withFileTypes: true });

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const directory = path.join(GIT_IMPORT_ROOT, entry.name);

          try {
            const directoryStat = await stat(directory);

            if (Date.now() - directoryStat.mtimeMs > SESSION_MAX_AGE_MS) {
              await rm(directory, { recursive: true, force: true });
            }
          } catch {
            return;
          }
        }),
    );
  } catch {
    return;
  }
}

/** 为新的 Git 扫描结果创建独立会话目录。 */
async function createSessionDirectory() {
  await mkdir(GIT_IMPORT_ROOT, { recursive: true });
  const sessionId = randomUUID();
  const sessionDir = resolveSessionDir(sessionId);
  await mkdir(sessionDir, { recursive: false });

  return { sessionId, sessionDir, repositoryDir: resolveSessionRepositoryDir(sessionId) };
}

/** 判断克隆失败是否由远端不存在指定分支引起。 */
function isMissingRemoteBranchError(stderr: string) {
  const normalized = stderr.toLowerCase();

  return normalized.includes("remote branch") && normalized.includes("not found");
}

/** 读取浅克隆后仓库当前实际检出的分支名。 */
async function readCheckedOutBranch(repositoryDir: string) {
  const { stdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repositoryDir,
    timeout: 5000,
  });

  return stdout.trim();
}

/** 通过系统 `git` 命令浅克隆目标仓库到指定目录。 */
async function cloneRepository(
  repositoryUrl: string,
  repositoryDir: string,
  branch?: string,
) {
  const normalizedBranch = branch?.trim();

  try {
    const args = ["clone", "--depth", "1"];

    if (normalizedBranch) {
      args.push("--branch", normalizedBranch);
    }

    args.push(repositoryUrl, repositoryDir);
    await execFileAsync("git", args, {
      timeout: 1000 * 60 * 2,
    });
  } catch (error) {
    const stderr = error instanceof Error && "stderr" in error ? String(error.stderr ?? "") : "";

    if (normalizedBranch && isMissingRemoteBranchError(stderr)) {
      await execFileAsync("git", ["clone", "--depth", "1", repositoryUrl, repositoryDir], {
        timeout: 1000 * 60 * 2,
      });

      return {
        branch: await readCheckedOutBranch(repositoryDir),
        usedFallbackBranch: true,
      };
    }

    const message = stderr.trim() || "无法克隆该 Git 仓库。";
    throw new Error(message);
  }

  return {
    branch: normalizedBranch || (await readCheckedOutBranch(repositoryDir)),
    usedFallbackBranch: false,
  };
}

/** 在仓库目录中递归扫描所有 skill 根目录。 */
async function scanRepositoryForSkills(rootDirectory: string) {
  const found = new Map<string, GitDiscoveryCandidate>();

  async function walk(currentDirectory: string) {
    let entries;

    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
          await walk(absolutePath);
        }

        continue;
      }

      if (!entry.isFile() || !isSkillFileName(entry.name)) {
        continue;
      }

      const skillDirectory = currentDirectory;
      const relativeSkillPath = path.relative(rootDirectory, skillDirectory) || ".";
      const existing = found.get(relativeSkillPath);

      if (!existing || existing.skillFileName !== UPPERCASE_SKILL_FILE) {
        found.set(relativeSkillPath, {
          directory: skillDirectory,
          relativeSkillPath,
          skillFileName: entry.name,
        });
      }
    }
  }

  await walk(rootDirectory);
  return [...found.values()];
}

/** 根据技能主文件名读取并解析候选目录中的基础信息。 */
async function parseCandidateSkill(candidate: GitDiscoveryCandidate) {
  const skillFilePath = path.join(candidate.directory, candidate.skillFileName);
  const [rawMarkdown, skillStat] = await Promise.all([
    readFile(skillFilePath, "utf8"),
    stat(skillFilePath),
  ]);
  const id = path.basename(candidate.directory);
  const parsed = parseSkillMarkdown(rawMarkdown, id);

  return {
    id,
    parsed,
    updatedAt: skillStat.mtime.toISOString(),
  };
}

/** 将 Git 扫描结果转换成前端可展示的候选技能摘要。 */
export async function discoverGitSkillsFromRepository(
  repositoryUrl: string,
  branch?: string,
) {
  const safeRepositoryUrl = validateRepositoryUrl(repositoryUrl);
  const configuredBranch = branch?.trim() || (await readGitSyncConfig()).branch;
  await cleanupExpiredGitImportSessions();

  const { sessionId, sessionDir, repositoryDir } = await createSessionDirectory();

  try {
    const cloneResult = await cloneRepository(safeRepositoryUrl, repositoryDir, configuredBranch);
    const resolvedBranch = cloneResult.branch;
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryDir,
      timeout: 5000,
    });
    const headCommit = stdout.trim();

    const [candidates, managedIds] = await Promise.all([
      scanRepositoryForSkills(repositoryDir),
      readManagedSkillIds(),
    ]);
    const duplicateIds = new Set<string>();
    const seenIds = new Set<string>();

    for (const candidate of candidates) {
      const nextId = sanitizeSkillId(path.basename(candidate.directory));

      if (seenIds.has(nextId)) {
        duplicateIds.add(nextId);
      }

      seenIds.add(nextId);
    }

    const skills = await Promise.all(
      candidates.map(async (candidate): Promise<DiscoveredSkillSummary> => {
        const fallbackId = path.basename(candidate.directory);

        try {
          const { id, parsed, updatedAt } = await parseCandidateSkill(candidate);
          const sanitizedId = sanitizeSkillId(id);

          if (duplicateIds.has(sanitizedId)) {
            return {
              id: sanitizedId,
              name: parsed.title,
              description: parsed.description,
              sourcePath: candidate.relativeSkillPath,
              sourceKind: "git",
              sourceLabel: "Git 仓库",
              updatedAt,
              status: "conflict",
              statusReason: "同一仓库中存在同名技能目录。",
              repositoryUrl: safeRepositoryUrl,
              branch: resolvedBranch,
              relativeSkillPath: candidate.relativeSkillPath,
              sessionId,
              lastSyncedCommit: headCommit,
            };
          }

          if (managedIds.has(sanitizedId) || isInsideManagedRoot(candidate.directory)) {
            return {
              id: sanitizedId,
              name: parsed.title,
              description: parsed.description,
              sourcePath: candidate.relativeSkillPath,
              sourceKind: "git",
              sourceLabel: "Git 仓库",
              updatedAt,
              status: "managed",
              statusReason: "该 Skill 已在本地受管目录中，可继续拉取或推送。",
              repositoryUrl: safeRepositoryUrl,
              branch: resolvedBranch,
              relativeSkillPath: candidate.relativeSkillPath,
              sessionId,
              lastSyncedCommit: headCommit,
            };
          }

          return {
            id: sanitizedId,
            name: parsed.title,
            description: parsed.description,
            sourcePath: candidate.relativeSkillPath,
            sourceKind: "git",
            sourceLabel: "Git 仓库",
            updatedAt,
            status: "importable",
            statusReason: cloneResult.usedFallbackBranch
              ? `已自动回退到远端默认分支 ${resolvedBranch}。`
              : "可导入",
            repositoryUrl: safeRepositoryUrl,
            branch: resolvedBranch,
            relativeSkillPath: candidate.relativeSkillPath,
            sessionId,
            lastSyncedCommit: headCommit,
          };
        } catch (error) {
          return {
            id: fallbackId,
            name: fallbackId,
            description: "",
            sourcePath: candidate.relativeSkillPath,
            sourceKind: "git",
            sourceLabel: "Git 仓库",
            updatedAt: new Date(0).toISOString(),
            status: "invalid",
            statusReason: error instanceof Error ? error.message : "无法读取这个技能目录。",
            repositoryUrl: safeRepositoryUrl,
            branch: resolvedBranch,
            relativeSkillPath: candidate.relativeSkillPath,
            sessionId,
            lastSyncedCommit: headCommit,
          };
        }
      }),
    );

    return {
      sessionId,
      repositoryUrl: safeRepositoryUrl,
      branch: resolvedBranch,
      lastSyncedCommit: headCommit,
      skills: skills.sort((a, b) => {
        const statusOrder = {
          importable: 0,
          managed: 1,
          conflict: 2,
          invalid: 3,
        } as const;

        return (
          statusOrder[a.status] - statusOrder[b.status] ||
          a.sourcePath.localeCompare(b.sourcePath) ||
          a.name.localeCompare(b.name)
        );
      }),
    };
  } catch (error) {
    await rm(sessionDir, { recursive: true, force: true });
    throw error;
  }
}

/** 根据会话标识与仓库内相对路径解析出单个 skill 根目录。 */
export async function resolveGitSkillDirectory(sessionId: string, relativeSkillPath: string) {
  const repositoryDir = resolveSessionRepositoryDir(sessionId);
  const repositoryStat = await stat(repositoryDir).catch(() => null);

  if (!repositoryStat?.isDirectory()) {
    throw new Error("Git 导入会话不存在或已过期，请重新扫描仓库。");
  }

  const trimmedRelativePath = relativeSkillPath.trim();

  if (!trimmedRelativePath) {
    throw new Error("仓库中的技能路径不能为空。");
  }

  const targetDirectory = path.resolve(repositoryDir, trimmedRelativePath);

  if (
    targetDirectory !== repositoryDir &&
    !targetDirectory.startsWith(`${repositoryDir}${path.sep}`)
  ) {
    throw new Error("仓库中的技能路径不合法。");
  }

  const targetStat = await stat(targetDirectory).catch(() => null);

  if (!targetStat?.isDirectory()) {
    throw new Error("指定的技能目录不存在，请重新扫描仓库。");
  }

  return targetDirectory;
}

/** 在导入后把小写技能主文件重命名成统一的大写文件名。 */
export async function normalizeImportedSkillFile(directory: string) {
  const uppercasePath = path.join(directory, UPPERCASE_SKILL_FILE);
  const lowercasePath = path.join(directory, LOWERCASE_SKILL_FILE);
  const uppercaseStat = await stat(uppercasePath).catch(() => null);

  if (uppercaseStat?.isFile()) {
    return;
  }

  const lowercaseStat = await stat(lowercasePath).catch(() => null);

  if (lowercaseStat?.isFile()) {
    await rename(lowercasePath, uppercasePath);
  }
}

/** 返回技能目录中当前存在的主文件名，优先使用大写文件名。 */
export async function findSkillFileName(directory: string) {
  const uppercasePath = path.join(directory, UPPERCASE_SKILL_FILE);
  const uppercaseStat = await stat(uppercasePath).catch(() => null);

  if (uppercaseStat?.isFile()) {
    return UPPERCASE_SKILL_FILE;
  }

  const lowercasePath = path.join(directory, LOWERCASE_SKILL_FILE);
  const lowercaseStat = await stat(lowercasePath).catch(() => null);

  if (lowercaseStat?.isFile()) {
    return LOWERCASE_SKILL_FILE;
  }

  throw new Error("所选目录中不包含 SKILL.md。");
}
