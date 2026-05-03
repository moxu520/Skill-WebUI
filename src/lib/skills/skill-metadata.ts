import path from "node:path";
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import type { SkillGitBinding, SkillInternalMetadata } from "@/lib/types";

export const SKILL_INTERNAL_METADATA_FILE = ".skill-webui.json";

/** 返回技能目录内部元数据文件的绝对路径。 */
export function resolveSkillMetadataPath(directory: string) {
  return path.join(directory, SKILL_INTERNAL_METADATA_FILE);
}

/** 读取单个技能目录的内部元数据；缺失时返回空对象。 */
export async function readSkillInternalMetadata(
  directory: string,
): Promise<SkillInternalMetadata> {
  try {
    const raw = await readFile(resolveSkillMetadataPath(directory), "utf8");
    const parsed = JSON.parse(raw) as SkillInternalMetadata;

    return {
      git: parsed.git ? normalizeSkillGitBinding(parsed.git) : undefined,
    };
  } catch {
    return {};
  }
}

/** 将内部元数据写回技能目录，供 Git 绑定和同步基线复用。 */
export async function writeSkillInternalMetadata(
  directory: string,
  metadata: SkillInternalMetadata,
) {
  const normalized: SkillInternalMetadata = {
    git: metadata.git ? normalizeSkillGitBinding(metadata.git) : undefined,
  };

  await writeFile(
    resolveSkillMetadataPath(directory),
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8",
  );
}

/** 更新技能目录中的 Git 绑定信息。 */
export async function writeSkillGitBinding(directory: string, binding: SkillGitBinding) {
  const metadata = await readSkillInternalMetadata(directory);
  metadata.git = normalizeSkillGitBinding(binding);
  await writeSkillInternalMetadata(directory, metadata);
}

/** 读取技能目录的 Git 绑定信息。 */
export async function readSkillGitBinding(directory: string) {
  const metadata = await readSkillInternalMetadata(directory);
  return metadata.git;
}

/** 为技能目录计算稳定内容签名，忽略内部同步元数据文件。 */
export async function computeSkillContentSignature(directory: string) {
  const digest = createHash("sha256");

  async function walk(currentDirectory: string) {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    const sortedEntries = [...entries].sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    for (const entry of sortedEntries) {
      if (entry.name === SKILL_INTERNAL_METADATA_FILE) {
        continue;
      }

      const absolutePath = path.join(currentDirectory, entry.name);
      const relativePath = path.relative(directory, absolutePath);

      if (entry.isDirectory()) {
        digest.update(`dir:${relativePath}\n`);
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const [content, fileStat] = await Promise.all([
        readFile(absolutePath),
        stat(absolutePath),
      ]);

      digest.update(`file:${relativePath}:${fileStat.size}\n`);
      digest.update(content);
      digest.update("\n");
    }
  }

  await walk(directory);
  return digest.digest("hex");
}

/** 对 Git 绑定信息做统一规范化，避免状态判断依赖脏数据。 */
function normalizeSkillGitBinding(binding: SkillGitBinding): SkillGitBinding {
  return {
    repositoryUrl: binding.repositoryUrl.trim(),
    branch: binding.branch.trim(),
    relativePath: binding.relativePath.trim(),
    lastSyncedCommit: binding.lastSyncedCommit?.trim() || undefined,
    trackingEnabled: Boolean(binding.trackingEnabled),
    lastSyncedSignature: binding.lastSyncedSignature?.trim() || undefined,
  };
}
