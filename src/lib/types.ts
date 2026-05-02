/** 列表页使用的技能摘要信息。 */
export type SkillSummary = {
  id: string;
  name: string;
  description: string;
  path: string;
  updatedAt: string;
};

/** 详情页使用的完整技能信息。 */
export type SkillDetail = SkillSummary & {
  contentMarkdown: string;
  bodyMarkdown: string;
  assets: string[];
};

/** 技能编辑草稿的公共字段。 */
export type SkillDraft = {
  name: string;
  description: string;
  bodyMarkdown: string;
};

/** 创建或更新技能时提交的数据结构。 */
export type CreateSkillInput = SkillDraft & {
  slug?: string;
};

/** 通过本地目录导入技能时的请求结构。 */
export type LocalImportSkillInput = {
  sourceType: "local";
  sourcePath: string;
};

/** 通过 Git 扫描会话导入技能时的请求结构。 */
export type GitImportSkillInput = {
  sourceType: "git";
  sessionId: string;
  relativeSkillPath: string;
};

/** 技能导入接口支持的全部请求结构。 */
export type ImportSkillInput = LocalImportSkillInput | GitImportSkillInput;

/** 自动发现候选技能时的可用状态。 */
export type DiscoveryStatus = "importable" | "conflict" | "invalid";

/** 自动发现列表中单个候选技能的摘要信息。 */
export type DiscoveredSkillSummary = {
  id: string;
  name: string;
  description: string;
  sourcePath: string;
  sourceKind: "discovered" | "git";
  sourceLabel: string;
  updatedAt: string;
  status: DiscoveryStatus;
  statusReason: string;
  repositoryUrl?: string;
  relativeSkillPath?: string;
  sessionId?: string;
};

/** 扫描根目录配置的持久化结构。 */
export type ScanRootConfig = {
  extraRoots: string[];
};

/** 翻译服务提供方的稳定标识。 */
export type TranslationProviderId =
  | "google"
  | "local_builtin"
  | "microsoft"
  | "remote_llm"
  | "local_llm";

/** 翻译方向，仅支持中英互译。 */
export type TranslationDirection = "zh-to-en" | "en-to-zh";

/** 翻译结果的保存策略。 */
export type TranslationSaveMode = "overwrite" | "fork";

/** 翻译提供方的接入状态。 */
export type TranslationProviderStatus = "available" | "planned";

/** 翻译页面和设置页通用的提供方目录项。 */
export type TranslationProviderCatalogItem = {
  id: TranslationProviderId;
  label: string;
  description: string;
  status: TranslationProviderStatus;
  kindLabel: string;
};

/** 发起单个技能翻译时提交的请求结构。 */
export type TranslateSkillInput = {
  provider: TranslationProviderId;
  direction: TranslationDirection;
};

/** 保存单个技能翻译结果时提交的请求结构。 */
export type SaveTranslatedSkillRequest = TranslateSkillInput & {
  saveMode: TranslationSaveMode;
  name: string;
  description: string;
  bodyMarkdown: string;
};

/** 翻译后返回给前端的元信息。 */
export type TranslationMeta = {
  provider: TranslationProviderId;
  sourceLanguage: string;
  targetLanguage: string;
  saveMode: TranslationSaveMode;
  createdFork: boolean;
};
