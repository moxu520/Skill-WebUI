import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { ScanRootConfig } from "@/lib/types";

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

export type DiscoveryScanRoot = {
  path: string;
  label: string;
  kind: "default" | "custom";
};

function toAbsolute(input: string) {
  return path.resolve(input.trim());
}

function dedupePaths(paths: string[]) {
  return [...new Set(paths.map(toAbsolute))];
}

function buildDefaultRoots(basePath: string) {
  return DEFAULT_HIDDEN_DIRS.flatMap((hiddenDir) =>
    DEFAULT_SKILL_DIRS.map((skillDir) => ({
      path: path.join(basePath, hiddenDir, skillDir),
      label: `${hiddenDir}/${skillDir}`,
      kind: "default" as const,
    })),
  );
}

function normalizeExtraRoots(extraRoots: string[]) {
  return dedupePaths(extraRoots.filter((root) => root.trim() !== ""));
}

export function getDefaultDiscoveryRoots() {
  return dedupeDiscoveryRoots([
    ...buildDefaultRoots(os.homedir()),
    ...buildDefaultRoots(process.cwd()),
  ]);
}

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

export async function listDiscoveryScanRoots() {
  const config = await readScanRootConfig();
  const customRoots = config.extraRoots.map((root) => ({
    path: toAbsolute(root),
    label: "自定义",
    kind: "custom" as const,
  }));

  return dedupeDiscoveryRoots([...getDefaultDiscoveryRoots(), ...customRoots]);
}
