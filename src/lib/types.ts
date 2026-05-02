export type SkillSummary = {
  id: string;
  name: string;
  description: string;
  path: string;
  updatedAt: string;
};

export type SkillDetail = SkillSummary & {
  contentMarkdown: string;
  bodyMarkdown: string;
  assets: string[];
};

export type SkillDraft = {
  name: string;
  description: string;
  bodyMarkdown: string;
};

export type CreateSkillInput = SkillDraft & {
  slug?: string;
};

export type ImportSkillInput = {
  sourcePath: string;
};

export type DiscoveryStatus = "importable" | "conflict" | "invalid";

export type DiscoveredSkillSummary = {
  id: string;
  name: string;
  description: string;
  sourcePath: string;
  sourceKind: "discovered";
  sourceLabel: string;
  updatedAt: string;
  status: DiscoveryStatus;
  statusReason: string;
};

export type ScanRootConfig = {
  extraRoots: string[];
};
