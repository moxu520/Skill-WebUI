import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { ScanRootConfig } from "@/lib/types";

/** 自动发现功能的本地配置文件路径。 */
const DEFAULT_HIDDEN_DIRS = [".codex", ".claude", ".agent"] as const;
const DEFAULT_SKILL_DIRS = ["skill", "skills"] as const;
const CONFIG_DIRECTORY = path.join(process.cwd(), ".skill-webui");
export const discoveryConfigPath = path.join(
  CONFIG_DIRECTORY,
  "discovery-roots.json",
);

const defaultScanRootConfig: ScanRootConfig = {
  extraRoots: [],
};

/** 单个扫描根目录的结构化描述。 */
export type DiscoveryScanRoot = {
  path: string;
  label: string;
  kind: "default" | "custom";
};

/** 将扫描路径统一转换为绝对路径。 */
function toAbsolute(input: string) {
  return path.resolve(input.trim());
}

/** 对路径数组去重，避免重复扫描同一路径。 */
function dedupePaths(paths: string[]) {
  return [...new Set(paths.map(toAbsolute))];
}

/** 根据一个基础目录生成默认的隐藏技能目录候选。 */
function buildDefaultRoots(basePath: string) {
  return DEFAULT_HIDDEN_DIRS.flatMap((hiddenDir) =>
    DEFAULT_SKILL_DIRS.map((skillDir) => ({
      path: path.join(basePath, hiddenDir, skillDir),
      label: `${hiddenDir}/${skillDir}`,
      kind: "default" as const,
    })),
  );
}

/** 清洗用户维护的额外扫描目录。 */
function normalizeExtraRoots(extraRoots: string[]) {
  return dedupePaths(extraRoots.filter((root) => root.trim() !== ""));
}

/** 返回系统默认的自动发现扫描根目录集合。 */
export function getDefaultDiscoveryRoots() {
  return dedupeDiscoveryRoots([
    ...buildDefaultRoots(os.homedir()),
    ...buildDefaultRoots(process.cwd()),
  ]);
}

/** 对扫描根目录按绝对路径去重，并保留来源标签。 */
function dedupeDiscoveryRoots(roots: DiscoveryScanRoot[]) {
  const seen = new Set<string>();
  const result: DiscoveryScanRoot[] = [];

  for (const root of roots) {
    const absolutePath = toAbsolute(root.path);

    if (seen.has(absolutePath)) {
      continue;
    }

    seen.add(absolutePath);
    result.push({
      ...root,
      path: absolutePath,
    });
  }

  return result;
}

/** 读取自动发现扫描配置；文件缺失时回退到默认空配置。 */
export async function readScanRootConfig(): Promise<ScanRootConfig> {
  try {
    const raw = await readFile(discoveryConfigPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ScanRootConfig>;

    return {
      extraRoots: normalizeExtraRoots(
        Array.isArray(parsed.extraRoots) ? parsed.extraRoots : [],
      ),
    };
  } catch {
    return defaultScanRootConfig;
  }
}

/** 写入自动发现扫描配置，并返回规范化后的结果。 */
export async function writeScanRootConfig(config: ScanRootConfig) {
  const normalized: ScanRootConfig = {
    extraRoots: normalizeExtraRoots(config.extraRoots),
  };

  await mkdir(CONFIG_DIRECTORY, { recursive: true });
  await writeFile(
    discoveryConfigPath,
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8",
  );

  return normalized;
}

/** 汇总默认扫描目录和用户自定义扫描目录，返回最终扫描根列表。 */
export async function listDiscoveryScanRoots() {
  const config = await readScanRootConfig();
  const customRoots = config.extraRoots.map((root) => ({
    path: toAbsolute(root),
    label: "自定义",
    kind: "custom" as const,
  }));

  return dedupeDiscoveryRoots([...getDefaultDiscoveryRoots(), ...customRoots]);
}
