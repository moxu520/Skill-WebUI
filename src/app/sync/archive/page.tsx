import { SettingsPlaceholderPanel } from "@/components/settings-placeholder-panel";

/** 多端同步模块中的压缩包同步占位页。 */
export default function SyncArchivePage() {
  return (
    <SettingsPlaceholderPanel
      title="压缩包同步"
      description="通过导出或导入压缩包在不同设备之间搬运 Skill。"
      hint="该同步方式尚未开发，后续会在这里提供压缩包导入、导出和差异同步能力。"
    />
  );
}
