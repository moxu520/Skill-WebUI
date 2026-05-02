import type { TranslationProviderCatalogItem } from "@/lib/types";

/** 翻译服务目录，统一驱动工作区和设置页中的提供方展示。 */
export const translationProviderCatalog: TranslationProviderCatalogItem[] = [
  {
    id: "google",
    label: "Google",
    description: "基于 Google Translate 的应用内置翻译通道。",
    status: "available",
    kindLabel: "已接入",
  },
  {
    id: "local_builtin",
    label: "本地翻译",
    description: "项目内置 provider，首版作为本地可选执行通道。",
    status: "available",
    kindLabel: "已接入",
  },
  {
    id: "microsoft",
    label: "微软翻译",
    description: "后续可扩展为 Microsoft Translator 接入。",
    status: "planned",
    kindLabel: "待对接",
  },
  {
    id: "remote_llm",
    label: "线上大模型",
    description: "后续可扩展为 OpenAI 兼容或其他远程模型翻译。",
    status: "planned",
    kindLabel: "待对接",
  },
  {
    id: "local_llm",
    label: "本地大模型",
    description: "后续可扩展为本地模型服务或 OpenAI 兼容本地端点。",
    status: "planned",
    kindLabel: "待对接",
  },
];

/** 返回当前实际可执行的翻译提供方列表。 */
export function listExecutableTranslationProviders() {
  return translationProviderCatalog.filter((provider) => provider.status === "available");
}

/** 通过稳定标识读取单个翻译提供方配置。 */
export function getTranslationProviderCatalogItem(id: string) {
  return translationProviderCatalog.find((provider) => provider.id === id) ?? null;
}
