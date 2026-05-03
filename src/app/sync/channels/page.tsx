import { SettingsPlaceholderPanel } from "@/components/settings-placeholder-panel";

/** 多端同步模块中的更多渠道占位页。 */
export default function SyncChannelsPage() {
  return (
    <SettingsPlaceholderPanel
      title="更多渠道"
      description="为后续对象存储、第三方网盘或团队共享空间等同步目标预留入口。"
      hint="该同步方式尚未开发，后续会在这里接入更多跨端同步渠道。"
    />
  );
}
