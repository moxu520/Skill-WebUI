import translate, {
  type googleTranslateApi,
} from "google-translate-api-x";
import { buildSkillMarkdown } from "@/lib/skills/skill-parser";
import { getTranslationProviderCatalogItem } from "@/lib/translation/catalog";
import type {
  SkillDetail,
  TranslateSkillInput,
  TranslationDirection,
  TranslationMeta,
  TranslationProviderId,
} from "@/lib/types";

/** 单次提交到翻译引擎的最大字符数，预留安全余量避免触发上限。 */
const MAX_TRANSLATION_CHUNK_SIZE = 4000;

/** 中英互译的语言配置。 */
const directionMap: Record<
  TranslationDirection,
  {
    sourceCode: string;
    sourceLabel: string;
    targetCode: string;
    targetLabel: string;
    slugSuffix: string;
    titleSuffix: string;
  }
> = {
  "zh-to-en": {
    sourceCode: "zh-CN",
    sourceLabel: "中文",
    targetCode: "en",
    targetLabel: "英文",
    slugSuffix: "en",
    titleSuffix: "（英文）",
  },
  "en-to-zh": {
    sourceCode: "en",
    sourceLabel: "英文",
    targetCode: "zh-CN",
    targetLabel: "中文",
    slugSuffix: "zh",
    titleSuffix: "（中文）",
  },
};

/** 单个字段翻译后的文本与探测到的源语言。 */
type FieldTranslationResult = {
  text: string;
  detectedLanguage: string | null;
};

/** 翻译后供仓储层落盘的文本数据。 */
export type TranslatedSkillContent = {
  name: string;
  description: string;
  bodyMarkdown: string;
  slugSuffix: string;
  titleSuffix: string;
  meta: TranslationMeta;
};

/** 翻译执行器的统一函数签名。 */
type ProviderExecutor = (input: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}) => Promise<FieldTranslationResult>;

/** 将 provider 标识映射到真正的执行器。 */
const providerExecutors: Partial<Record<TranslationProviderId, ProviderExecutor>> = {
  google: translateWithBuiltInAdapter,
  local_builtin: translateWithBuiltInAdapter,
};

/** 将任意长度文本切成适合翻译接口的片段，同时尽量保持段落边界。 */
function chunkText(input: string) {
  if (!input.trim()) {
    return [];
  }

  const paragraphs = input.split(/(\n\s*\n)/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      continue;
    }

    if (paragraph.length > MAX_TRANSLATION_CHUNK_SIZE) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      let remaining = paragraph;

      while (remaining.length > MAX_TRANSLATION_CHUNK_SIZE) {
        const slice = remaining.slice(0, MAX_TRANSLATION_CHUNK_SIZE);
        const boundaryIndex = Math.max(
          slice.lastIndexOf("\n"),
          slice.lastIndexOf(" "),
        );

        if (boundaryIndex > 0) {
          chunks.push(remaining.slice(0, boundaryIndex));
          remaining = remaining.slice(boundaryIndex);
          continue;
        }

        chunks.push(slice);
        remaining = remaining.slice(MAX_TRANSLATION_CHUNK_SIZE);
      }

      if (remaining) {
        currentChunk = remaining;
      }

      continue;
    }

    const nextChunk = currentChunk ? `${currentChunk}${paragraph}` : paragraph;

    if (nextChunk.length > MAX_TRANSLATION_CHUNK_SIZE) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
      continue;
    }

    currentChunk = nextChunk;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/** 调用应用内置翻译适配器执行一次文本翻译。 */
async function translateWithBuiltInAdapter(input: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<FieldTranslationResult> {
  const chunks = chunkText(input.text);

  if (!chunks.length) {
    return {
      text: input.text,
      detectedLanguage: null,
    };
  }

  const response = await translate(chunks, {
    from: input.sourceLanguage,
    to: input.targetLanguage,
    forceBatch: true,
    client: "gtx",
  } as googleTranslateApi.RequestOptions);
  const results = Array.isArray(response) ? response : [response];

  return {
    text: results.map((item) => item.text).join(""),
    detectedLanguage: results[0]?.from.language.iso ?? null,
  };
}

/** 根据翻译方向读取对应的源语言、目标语言和命名后缀。 */
export function getTranslationDirectionInfo(direction: TranslationDirection) {
  const info = directionMap[direction];

  if (!info) {
    throw new Error("不支持的翻译方向。");
  }

  return info;
}

/** 根据 provider、方向和保存方式组装统一的翻译元信息。 */
export function buildTranslationMeta(input: {
  provider: TranslationProviderId;
  direction: TranslationDirection;
  saveMode: "overwrite" | "fork";
  detectedLanguage?: string | null;
}): TranslationMeta {
  const directionInfo = getTranslationDirectionInfo(input.direction);

  return {
    provider: input.provider,
    sourceLanguage: input.detectedLanguage ?? directionInfo.sourceCode,
    targetLanguage: directionInfo.targetCode,
    saveMode: input.saveMode,
    createdFork: input.saveMode === "fork",
  };
}

/** 将翻译后的结构化文本重新拼装成可预览的 Markdown。 */
export function buildTranslatedSkillMarkdown(input: {
  name: string;
  description: string;
  bodyMarkdown: string;
}) {
  return buildSkillMarkdown({
    title: input.name,
    description: input.description,
    bodyMarkdown: input.bodyMarkdown,
  });
}

/** 校验请求参数并解析出可执行的翻译 provider。 */
function resolveProvider(input: TranslateSkillInput) {
  const provider = getTranslationProviderCatalogItem(input.provider);

  if (!provider) {
    throw new Error("未知的翻译服务。");
  }

  if (provider.status !== "available") {
    throw new Error(`${provider.label} 当前仍处于待对接状态。`);
  }

  const executor = providerExecutors[input.provider];

  if (!executor) {
    throw new Error(`${provider.label} 当前不可执行。`);
  }

  return { provider, executor };
}

/** 翻译单个字段文本，并保留第一段探测语言信息。 */
async function translateField(input: {
  executor: ProviderExecutor;
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}) {
  if (!input.text.trim()) {
    return {
      text: input.text,
      detectedLanguage: null,
    };
  }

  return input.executor({
    text: input.text,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
  });
}

/** 翻译单个技能的全部可编辑字段，并返回落盘所需结果。 */
export async function translateSkillContent(
  skill: SkillDetail,
  input: TranslateSkillInput,
): Promise<TranslatedSkillContent> {
  const directionInfo = getTranslationDirectionInfo(input.direction);
  const { provider, executor } = resolveProvider(input);
  const [translatedName, translatedDescription, translatedBody] = await Promise.all([
    translateField({
      executor,
      text: skill.name,
      sourceLanguage: directionInfo.sourceCode,
      targetLanguage: directionInfo.targetCode,
    }),
    translateField({
      executor,
      text: skill.description,
      sourceLanguage: directionInfo.sourceCode,
      targetLanguage: directionInfo.targetCode,
    }),
    translateField({
      executor,
      text: skill.bodyMarkdown,
      sourceLanguage: directionInfo.sourceCode,
      targetLanguage: directionInfo.targetCode,
    }),
  ]);

  return {
    name: translatedName.text,
    description: translatedDescription.text,
    bodyMarkdown: translatedBody.text,
    slugSuffix: directionInfo.slugSuffix,
    titleSuffix: directionInfo.titleSuffix,
    meta: buildTranslationMeta({
      provider: provider.id,
      direction: input.direction,
      saveMode: "fork",
      detectedLanguage:
        translatedName.detectedLanguage ??
        translatedDescription.detectedLanguage ??
        translatedBody.detectedLanguage,
    }),
  };
}
