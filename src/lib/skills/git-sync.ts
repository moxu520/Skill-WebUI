import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { readGitSyncConfig } from "@/lib/skills/git-sync-config";
import { findSkillFileName } from "@/lib/skills/git-import";
import { resolveSkillDir, sanitizeSkillId } from "@/lib/skills/path-guard";
import {
  computeSkillContentSignature,
  readSkillGitBinding,
  SKILL_INTERNAL_METADATA_FILE,
  writeSkillGitBinding,
} from "@/lib/skills/skill-metadata";
import type {
  GitSyncConfig,
  GitPushProgressEvent,
  SkillGitBinding,
  SkillGitSyncActivity,
  SkillGitSyncState,
  SkillGitSyncStatus,
} from "@/lib/types";

const execFileAsync = promisify(execFile);
const WORKTREE_PREFIX = path.join(os.tmpdir(), "skill-webui-git-sync-");

/** 负责执行单个 Skill 的 Git 状态检测与推拉同步。 */

type PreparedSkillTarget = {
  skillId: string;
  directory: string;
  binding?: SkillGitBinding;
  config: GitSyncConfig;
};

type RemoteHeadResult = {
  headCommit?: string;
  error?: string;
};

type PushSkillToGitOptions = {
  onProgress?: (event: GitPushProgressEvent) => void;
};

/** 对 Git 命令失败做统一格式化，确保接口错误可直接展示。 */
function toGitErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && "stderr" in error) {
    const stderr = String(error.stderr ?? "").trim();

    if (stderr) {
      return stderr;
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

/** 复制目录树时跳过内部同步元数据文件。 */
async function copyDirectory(source: string, target: string) {
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === SKILL_INTERNAL_METADATA_FILE) {
      continue;
    }

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

/** 删除目录中的全部内容，但保留内部同步元数据文件。 */
async function clearDirectoryExceptMetadata(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name === SKILL_INTERNAL_METADATA_FILE) {
        return;
      }

      await rm(path.join(directory, entry.name), { recursive: true, force: true });
    }),
  );
}

/** 为同步操作创建临时工作区，结束后由调用方负责清理。 */
async function createWorktreeDirectory() {
  return mkdtemp(WORKTREE_PREFIX);
}

/** 执行 Git 命令。 */
async function runGit(args: string[], cwd: string) {
  return execFileAsync("git", args, {
    cwd,
    timeout: 1000 * 60 * 2,
  });
}

/** 读取指定远端分支当前 HEAD 提交。 */
async function readRemoteHeadCommit(repositoryUrl: string, branch: string): Promise<RemoteHeadResult> {
  try {
    const { stdout } = await execFileAsync("git", ["ls-remote", "--heads", repositoryUrl, branch], {
      timeout: 1000 * 30,
    });
    const line = stdout
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find(Boolean);

    if (!line) {
      return {
        error: `远端分支 ${branch} 不存在。`,
      };
    }

    return {
      headCommit: line.split(/\s+/)[0],
    };
  } catch (error) {
    return {
      error: toGitErrorMessage(error, "读取远端分支状态失败。"),
    };
  }
}

/** 将仓库克隆到临时目录，供单次推拉操作使用。 */
async function cloneRepository(repositoryUrl: string, branch: string, target: string) {
  try {
    await execFileAsync(
      "git",
      ["clone", "--depth", "1", "--branch", branch, repositoryUrl, target],
      {
        timeout: 1000 * 60 * 2,
      },
    );
  } catch (error) {
    throw new Error(toGitErrorMessage(error, "克隆 Git 仓库失败。"));
  }
}

/** 将绝对路径安全转换为仓库相对路径。 */
function normalizeRelativePath(relativePath: string) {
  const trimmed = relativePath.trim();

  if (!trimmed || path.isAbsolute(trimmed)) {
    throw new Error("远端 Skill 路径不合法。");
  }

  const normalized = path.posix.normalize(trimmed.replaceAll("\\", "/"));

  if (normalized === "." || normalized.startsWith("../")) {
    throw new Error("远端 Skill 路径不合法。");
  }

  return normalized;
}

/** 读取技能当前绑定配置，不存在时按全局默认值构造未绑定状态。 */
async function prepareSkillTarget(skillId: string): Promise<PreparedSkillTarget> {
  const safeId = sanitizeSkillId(skillId);
  const directory = resolveSkillDir(safeId);
  const [binding, config] = await Promise.all([
    readSkillGitBinding(directory),
    readGitSyncConfig(),
  ]);

  return {
    skillId: safeId,
    directory,
    binding,
    config,
  };
}

/** 基于本地配置与当前文件签名构造 Git 状态。 */
export async function getLocalSkillGitSyncStatus(skillId: string): Promise<SkillGitSyncStatus | undefined> {
  const prepared = await prepareSkillTarget(skillId);

  return buildSkillGitSyncStatus(prepared);
}

/** 读取带远端对比的完整 Git 状态。 */
export async function getSkillGitSyncStatus(skillId: string): Promise<SkillGitSyncStatus> {
  const prepared = await prepareSkillTarget(skillId);
  return buildSkillGitSyncStatus(prepared, true);
}

/** 根据全局默认配置为未绑定技能生成首次发布跟踪信息。 */
async function createBindingFromConfig(skillId: string, config: GitSyncConfig): Promise<SkillGitBinding> {
  return {
    repositoryUrl: config.repositoryUrl,
    branch: config.branch,
    relativePath: normalizeRelativePath(path.posix.join(config.baseDirectory, skillId)),
    trackingEnabled: true,
  };
}

/** 判断技能当前绑定是否仍然指向全局 Git 设置对应的受管目标。 */
function isManagedBinding(
  binding: SkillGitBinding | undefined,
  config: GitSyncConfig,
  skillId: string,
) {
  if (!binding?.trackingEnabled) {
    return false;
  }

  return (
    binding.repositoryUrl === config.repositoryUrl &&
    binding.branch === config.branch &&
    binding.relativePath === normalizeRelativePath(path.posix.join(config.baseDirectory, skillId))
  );
}

/** 统一解析当前技能实际应使用的同步绑定。 */
async function resolveEffectiveBinding(prepared: PreparedSkillTarget) {
  if (isManagedBinding(prepared.binding, prepared.config, prepared.skillId)) {
    return prepared.binding;
  }

  return undefined;
}

/** 构造标准化的 Git 状态对象。 */
async function buildSkillGitSyncStatus(
  prepared: PreparedSkillTarget,
  includeRemote = false,
): Promise<SkillGitSyncStatus> {
  const binding = await resolveEffectiveBinding(prepared);

  if (!binding) {
    return {
      enabled: false,
      repositoryUrl: prepared.config.repositoryUrl,
      branch: prepared.config.branch,
      relativePath: normalizeRelativePath(
        path.posix.join(prepared.config.baseDirectory, prepared.skillId),
      ),
      status: "untracked",
      message: "当前 Skill 尚未绑定到全局 Git 仓库，首次推送会发布到默认目标。",
    };
  }
  const currentSignature = await computeSkillContentSignature(prepared.directory);
  const hasLocalChanges =
    Boolean(binding.lastSyncedSignature) && binding.lastSyncedSignature !== currentSignature;

  if (!includeRemote) {
    return {
      enabled: true,
      repositoryUrl: binding.repositoryUrl,
      branch: binding.branch,
      relativePath: binding.relativePath,
      status: hasLocalChanges ? "local_changes" : "synced",
      lastSyncedCommit: binding.lastSyncedCommit,
      message: hasLocalChanges ? "本地存在尚未推送的修改。" : "本地与最近同步基线一致。",
    };
  }

  const remoteHead = await readRemoteHeadCommit(binding.repositoryUrl, binding.branch);

  if (!remoteHead.headCommit) {
    return {
      enabled: true,
      repositoryUrl: binding.repositoryUrl,
      branch: binding.branch,
      relativePath: binding.relativePath,
      status: "error",
      lastSyncedCommit: binding.lastSyncedCommit,
      message: remoteHead.error ?? "无法读取远端状态。",
    };
  }

  const hasRemoteChanges =
    Boolean(binding.lastSyncedCommit) && remoteHead.headCommit !== binding.lastSyncedCommit;

  let status: SkillGitSyncState = "synced";
  let message = "本地与远端已同步。";

  if (hasLocalChanges && hasRemoteChanges) {
    status = "diverged";
    message = "本地和远端都有新的修改，需要先手动处理冲突。";
  } else if (hasLocalChanges) {
    status = "local_changes";
    message = "本地存在尚未推送的修改。";
  } else if (hasRemoteChanges) {
    status = "remote_changes";
    message = "远端存在尚未拉取的修改。";
  }

  return {
    enabled: true,
    repositoryUrl: binding.repositoryUrl,
    branch: binding.branch,
    relativePath: binding.relativePath,
    status,
    lastSyncedCommit: binding.lastSyncedCommit,
    message,
  };
}

/** 当技能目录标识发生变化时，同步修正默认受管仓库下的远端路径。 */
export async function syncSkillGitBindingAfterRename(previousId: string, nextId: string) {
  const nextDirectory = resolveSkillDir(nextId);
  const binding = await readSkillGitBinding(nextDirectory);
  const config = await readGitSyncConfig();

  if (!isManagedBinding(binding, config, previousId)) {
    return;
  }

  if (!binding) {
    return;
  }

  await writeSkillGitBinding(nextDirectory, {
    ...binding,
    branch: config.branch,
    repositoryUrl: config.repositoryUrl,
    relativePath: normalizeRelativePath(path.posix.join(config.baseDirectory, nextId)),
  });
}

/** 拉取远端 Skill 内容并更新本地同步基线。 */
export async function pullSkillFromGit(skillId: string) {
  const prepared = await prepareSkillTarget(skillId);
  const binding = await resolveEffectiveBinding(prepared);

  if (!binding) {
    throw new Error("当前 Skill 尚未绑定到全局 Git 仓库，无法拉取。");
  }

  const status = await buildSkillGitSyncStatus({ ...prepared, binding }, true);

  if (!binding.trackingEnabled || status.status === "untracked") {
    throw new Error("当前 Skill 尚未绑定远端仓库，无法拉取。");
  }

  if (status.status === "local_changes" || status.status === "diverged") {
    throw new Error("本地存在未同步修改，已阻止拉取覆盖。");
  }

  if (status.status === "error") {
    throw new Error(status.message ?? "读取远端状态失败。");
  }

  const worktree = await createWorktreeDirectory();

  try {
    await cloneRepository(binding.repositoryUrl, binding.branch, worktree);
    const repositorySkillDirectory = path.join(worktree, normalizeRelativePath(binding.relativePath));
    const repositorySkillStat = await stat(repositorySkillDirectory).catch(() => null);

    if (!repositorySkillStat?.isDirectory()) {
      throw new Error("远端仓库中不存在该 Skill 目录。");
    }

    await findSkillFileName(repositorySkillDirectory);
    await clearDirectoryExceptMetadata(prepared.directory);
    await copyDirectory(repositorySkillDirectory, prepared.directory);

    const [{ stdout }, signature] = await Promise.all([
      runGit(["rev-parse", "HEAD"], worktree),
      computeSkillContentSignature(prepared.directory),
    ]);

    await writeSkillGitBinding(prepared.directory, {
      ...binding,
      trackingEnabled: true,
      lastSyncedCommit: stdout.trim(),
      lastSyncedSignature: signature,
    });

    return {
      gitSync: await buildSkillGitSyncStatus(
        {
          ...prepared,
          binding: {
            ...binding,
            trackingEnabled: true,
            lastSyncedCommit: stdout.trim(),
            lastSyncedSignature: signature,
          },
        },
        true,
      ),
      activity: {
        action: "pull",
        commit: stdout.trim(),
        message: `已从 ${binding.branch} 拉取 ${skillId}。`,
        updatedAt: new Date().toISOString(),
      } satisfies SkillGitSyncActivity,
    };
  } finally {
    await rm(worktree, { recursive: true, force: true });
  }
}

/** 推送本地 Skill 到远端仓库，并刷新同步基线。 */
export async function pushSkillToGit(skillId: string, options?: PushSkillToGitOptions) {
  const prepared = await prepareSkillTarget(skillId);
  const binding = (await resolveEffectiveBinding(prepared)) ?? (await createBindingFromConfig(skillId, prepared.config));
  const status = await buildSkillGitSyncStatus({ ...prepared, binding }, true);

  if (status.status === "remote_changes" || status.status === "diverged") {
    throw new Error("远端分支已发生变化，已阻止非快进推送。");
  }

  if (status.status === "error") {
    throw new Error(status.message ?? "读取远端状态失败。");
  }

  const worktree = await createWorktreeDirectory();

  try {
    options?.onProgress?.({
      step: "prepare",
      title: "准备推送",
      description: `正在整理 ${skillId} 的本地内容并检查远端状态。`,
    });
    await cloneRepository(binding.repositoryUrl, binding.branch, worktree);

    const repositorySkillDirectory = path.join(worktree, normalizeRelativePath(binding.relativePath));
    await rm(repositorySkillDirectory, { recursive: true, force: true });
    await copyDirectory(prepared.directory, repositorySkillDirectory);

    /**
     * 目标仓库可能通过 `.gitignore` 忽略 `/skills` 目录。
     * 这里强制把当前 Skill 路径加入索引，避免把“被忽略的新 Skill”误判成“远端已最新”。
     */
    await runGit(["add", "-A", "-f", "--", normalizeRelativePath(binding.relativePath)], worktree);
    const { stdout: stagedOutput } = await runGit(
      ["diff", "--cached", "--name-only", "--", normalizeRelativePath(binding.relativePath)],
      worktree,
    );

    if (!stagedOutput.trim()) {
      const { stdout } = await runGit(["rev-parse", "HEAD"], worktree);
      const signature = await computeSkillContentSignature(prepared.directory);

      await writeSkillGitBinding(prepared.directory, {
        ...binding,
        trackingEnabled: true,
        lastSyncedCommit: stdout.trim(),
        lastSyncedSignature: signature,
      });

      return {
        gitSync: await buildSkillGitSyncStatus(
          {
            ...prepared,
            binding: {
              ...binding,
              trackingEnabled: true,
              lastSyncedCommit: stdout.trim(),
              lastSyncedSignature: signature,
            },
          },
          true,
        ),
        activity: {
          action: "push",
          commit: stdout.trim(),
          message: `远端已是 ${skillId} 的最新内容。`,
          updatedAt: new Date().toISOString(),
        } satisfies SkillGitSyncActivity,
      };
    }

    if (prepared.config.authorName) {
      await runGit(["config", "user.name", prepared.config.authorName], worktree);
    }

    if (prepared.config.authorEmail) {
      await runGit(["config", "user.email", prepared.config.authorEmail], worktree);
    }

    const commitMessage = binding.lastSyncedCommit
      ? `sync(skill): update ${skillId}`
      : `sync(skill): add ${skillId}`;
    options?.onProgress?.({
      step: "commit",
      title: "生成提交",
      description: `正在为 ${skillId} 生成 Git 提交记录。`,
    });
    await runGit(["commit", "-m", commitMessage], worktree);
    options?.onProgress?.({
      step: "push",
      title: "推送远端",
      description: `正在把 ${skillId} 推送到 ${binding.branch}。`,
    });
    await runGit(["push", "origin", binding.branch], worktree);

    const [{ stdout }, signature] = await Promise.all([
      runGit(["rev-parse", "HEAD"], worktree),
      computeSkillContentSignature(prepared.directory),
    ]);

    await writeSkillGitBinding(prepared.directory, {
      ...binding,
      trackingEnabled: true,
      lastSyncedCommit: stdout.trim(),
      lastSyncedSignature: signature,
    });

    return {
      gitSync: await buildSkillGitSyncStatus(
        {
          ...prepared,
          binding: {
            ...binding,
            trackingEnabled: true,
            lastSyncedCommit: stdout.trim(),
            lastSyncedSignature: signature,
          },
        },
        true,
      ),
      activity: {
        action: "push",
        commit: stdout.trim(),
        message: `已推送 ${skillId} 到 ${binding.branch}。`,
        updatedAt: new Date().toISOString(),
      } satisfies SkillGitSyncActivity,
    };
  } catch (error) {
    throw new Error(toGitErrorMessage(error, "推送 Skill 到远端失败。"));
  } finally {
    await rm(worktree, { recursive: true, force: true });
  }
}

/** 读取绑定中的最近同步提交，供导入场景初始化元数据。 */
export async function readRemoteHeadForConfig(repositoryUrl: string, branch: string) {
  return readRemoteHeadCommit(repositoryUrl, branch);
}
