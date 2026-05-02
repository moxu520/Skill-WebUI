import path from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";
import { listDiscoveryScanRoots } from "@/lib/skills/discovery-config";
import { skillsRoot } from "@/lib/skills/config";
import { sanitizeSkillId } from "@/lib/skills/path-guard";
import { parseSkillMarkdown } from "@/lib/skills/skill-parser";
import type { DiscoveredSkillSummary } from "@/lib/types";

/**
 * 负责从常见技能目录和自定义扫描根中发现可导入的 Skill 候选。
 * 该模块只做发现与判定，不直接写入受管目录。
 */

const SKILL_FILE = "SKILL.md";
const MAX_SCAN_DEPTH = 2;
const SKIPPED_DIRECTORY_NAMES = new Set([".git", "node_modules"]);

type DiscoveryCandidate = {
  directory: string;
  sourceLabel: string;
};

/** 将任意路径规范化为绝对路径，便于目录范围比较。 */
function normalizeAbsolute(target: string) {
  return path.resolve(target);
}

/** 判断候选路径是否已经位于受管技能根目录之内。 */
function isInsideManagedRoot(target: string) {
  const root = normalizeAbsolute(skillsRoot);
  const absoluteTarget = normalizeAbsolute(target);

  return (
    absoluteTarget === root || absoluteTarget.startsWith(`${root}${path.sep}`)
  );
}

/** 判断某个目录下是否存在可识别的 `SKILL.md` 文件。 */
async function hasSkillFile(directory: string) {
  try {
    const fileStat = await stat(path.join(directory, SKILL_FILE));
    return fileStat.isFile();
  } catch {
    return false;
  }
}

/** 在限定深度内递归扫描单个根目录，收集候选技能目录。 */
async function walkDiscoveryRoot(
  rootPath: string,
  sourceLabel: string,
  depth: number,
  found: Map<string, DiscoveryCandidate>,
) {
  let directoryEntries;

  try {
    directoryEntries = await readdir(rootPath, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    directoryEntries.map(async (entry) => {
      if (!entry.isDirectory() || SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
        return;
      }

      const directory = path.join(rootPath, entry.name);
      const nextDepth = depth + 1;

      if (nextDepth > MAX_SCAN_DEPTH) {
        return;
      }

      if (await hasSkillFile(directory)) {
        found.set(directory, { directory, sourceLabel });
      }

      if (nextDepth < MAX_SCAN_DEPTH) {
        await walkDiscoveryRoot(directory, sourceLabel, nextDepth, found);
      }
    }),
  );
}

/** 读取当前受管技能目录中的已有技能标识集合。 */
async function readManagedSkillIds() {
  try {
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    return new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  } catch {
    return new Set<string>();
  }
}

/** 将候选目录转换成前端可直接展示的发现结果摘要。 */
async function toDiscoveredSummary(
  candidate: DiscoveryCandidate,
  managedIds: Set<string>,
): Promise<DiscoveredSkillSummary> {
  const id = path.basename(candidate.directory);

  try {
    const skillFilePath = path.join(candidate.directory, SKILL_FILE);
    const [rawMarkdown, skillStat] = await Promise.all([
      readFile(skillFilePath, "utf8"),
      stat(skillFilePath),
    ]);
    const parsed = parseSkillMarkdown(rawMarkdown, id);
    const sanitizedId = sanitizeSkillId(id);

    if (managedIds.has(sanitizedId) || isInsideManagedRoot(candidate.directory)) {
      return {
        id: sanitizedId,
        name: parsed.title,
        description: parsed.description,
        sourcePath: candidate.directory,
        sourceKind: "discovered",
        sourceLabel: candidate.sourceLabel,
        updatedAt: skillStat.mtime.toISOString(),
        status: "conflict",
        statusReason: "受管目录中已存在同名技能。",
      };
    }

    return {
      id: sanitizedId,
      name: parsed.title,
      description: parsed.description,
      sourcePath: candidate.directory,
      sourceKind: "discovered",
      sourceLabel: candidate.sourceLabel,
      updatedAt: skillStat.mtime.toISOString(),
      status: "importable",
      statusReason: "可导入",
    };
  } catch (error) {
    return {
      id,
      name: id,
      description: "",
      sourcePath: candidate.directory,
      sourceKind: "discovered",
      sourceLabel: candidate.sourceLabel,
      updatedAt: new Date(0).toISOString(),
      status: "invalid",
      statusReason:
        error instanceof Error ? error.message : "无法读取这个技能目录。",
    };
  }
}

/** 扫描所有发现根目录，并返回按状态排序的候选技能列表。 */
export async function listDiscoveredSkills() {
  const scanRoots = await listDiscoveryScanRoots();
  const found = new Map<string, DiscoveryCandidate>();

  await Promise.all(
    scanRoots.map(async (scanRoot) => {
      try {
        const rootStat = await stat(scanRoot.path);

        if (!rootStat.isDirectory()) {
          return;
        }
      } catch {
        return;
      }

      if (await hasSkillFile(scanRoot.path)) {
        found.set(scanRoot.path, {
          directory: scanRoot.path,
          sourceLabel: scanRoot.label,
        });
      }

      await walkDiscoveryRoot(scanRoot.path, scanRoot.label, 0, found);
    }),
  );

  const managedIds = await readManagedSkillIds();
  const discovered = await Promise.all(
    [...found.values()]
      .filter((candidate) => !isInsideManagedRoot(candidate.directory))
      .map((candidate) => toDiscoveredSummary(candidate, managedIds)),
  );

  return discovered.sort((a, b) => {
    const statusOrder = {
      importable: 0,
      conflict: 1,
      invalid: 2,
    } as const;

    return (
      statusOrder[a.status] - statusOrder[b.status] ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.name.localeCompare(b.name)
    );
  });
}
