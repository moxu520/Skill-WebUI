import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitSyncConfig } from "@/lib/types";

const execFileAsync = promisify(execFile);
const CONFIG_DIRECTORY = path.join(process.cwd(), ".skill-webui");
export const gitSyncConfigPath = path.join(CONFIG_DIRECTORY, "git-sync.json");
const DEFAULT_BASE_DIRECTORY = "skills";
const DEFAULT_BRANCH = "master";
const DEFAULT_REPOSITORY_URL = "https://github.com/moxu520/Skill-WebUI.git";

/** 规范化 Git 仓库地址，确保保存前去掉无意义空白。 */
function normalizeRepositoryUrl(repositoryUrl: string) {
  const trimmed = repositoryUrl.trim();

  if (!trimmed) {
    throw new Error("Git 仓库地址不能为空。");
  }

  return trimmed;
}

/** 规范化 Git 分支名，避免落入空字符串。 */
function normalizeBranch(branch: string) {
  const trimmed = branch.trim();

  if (!trimmed) {
    throw new Error("默认分支不能为空。");
  }

  return trimmed;
}

/** 规范化远端基础目录，兼容未来用户自定义仓库布局。 */
function normalizeBaseDirectory(baseDirectory: string | undefined) {
  const trimmed = baseDirectory?.trim() ?? "";

  return trimmed || DEFAULT_BASE_DIRECTORY;
}

/** 从当前项目仓库读取默认的远端地址，失败时回退到内置默认值。 */
async function readDefaultOriginUrl() {
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
      cwd: process.cwd(),
      timeout: 5000,
    });

    return normalizeRepositoryUrl(stdout);
  } catch {
    return DEFAULT_REPOSITORY_URL;
  }
}

/** 从当前项目仓库读取默认远端分支，失败时回退到 `master`。 */
async function readDefaultOriginBranch() {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"],
      {
        cwd: process.cwd(),
        timeout: 5000,
      },
    );

    const ref = stdout.trim();
    const branch = ref.split("/").at(-1);

    return normalizeBranch(branch ?? DEFAULT_BRANCH);
  } catch {
    return DEFAULT_BRANCH;
  }
}

/** 返回当前工作区 Git 同步设置的默认值。 */
export async function getDefaultGitSyncConfig(): Promise<GitSyncConfig> {
  const [repositoryUrl, branch] = await Promise.all([
    readDefaultOriginUrl(),
    readDefaultOriginBranch(),
  ]);

  return {
    repositoryUrl,
    branch,
    baseDirectory: DEFAULT_BASE_DIRECTORY,
  };
}

/** 统一清洗 Git 同步配置，保证写盘和读盘结构稳定。 */
function normalizeGitSyncConfig(
  config: Partial<GitSyncConfig>,
  defaults: GitSyncConfig,
): GitSyncConfig {
  return {
    repositoryUrl: normalizeRepositoryUrl(config.repositoryUrl ?? defaults.repositoryUrl),
    branch: normalizeBranch(config.branch ?? defaults.branch),
    baseDirectory: normalizeBaseDirectory(config.baseDirectory ?? defaults.baseDirectory),
    authorName: config.authorName?.trim() || undefined,
    authorEmail: config.authorEmail?.trim() || undefined,
    commitMessageTemplate: config.commitMessageTemplate?.trim() || undefined,
  };
}

/** 读取 Git 同步配置；文件缺失时回退到当前仓库推导值。 */
export async function readGitSyncConfig(): Promise<GitSyncConfig> {
  const defaults = await getDefaultGitSyncConfig();

  try {
    const raw = await readFile(gitSyncConfigPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<GitSyncConfig>;

    return normalizeGitSyncConfig(parsed, defaults);
  } catch {
    return defaults;
  }
}

/** 写入 Git 同步配置，并返回清洗后的最终值。 */
export async function writeGitSyncConfig(config: Partial<GitSyncConfig>) {
  const defaults = await getDefaultGitSyncConfig();
  const normalized = normalizeGitSyncConfig(config, defaults);

  await mkdir(CONFIG_DIRECTORY, { recursive: true });
  await writeFile(gitSyncConfigPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  return normalized;
}
