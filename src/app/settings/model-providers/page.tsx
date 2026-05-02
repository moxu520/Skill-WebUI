import { SettingsPlaceholderPanel } from "@/components/settings-placeholder-panel";

/** 模型服务设置占位页。 */
export default function SettingsModelProvidersPage() {
  return (
    <SettingsPlaceholderPanel
      title="模型服务"
      description="这里会集中管理第三方模型供应商、鉴权信息和默认调用策略。"
      hint="首版先完成设置中心结构，后续可在此接入 OpenAI 兼容接口、本地模型服务或其他模型供应商。"
    />
  );
}
