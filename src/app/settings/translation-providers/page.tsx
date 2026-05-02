import { SettingsPlaceholderPanel } from "@/components/settings-placeholder-panel";

/** 翻译服务设置占位页。 */
export default function SettingsTranslationProvidersPage() {
  return (
    <SettingsPlaceholderPanel
      title="翻译服务"
      description="这里会集中管理第三方翻译服务、密钥配置和默认翻译策略。"
      hint="首版先预留入口，后续可在此接入机器翻译供应商、自定义术语配置或多服务回退策略。"
    />
  );
}
