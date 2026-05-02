import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { SettingsShell } from "@/components/settings-shell";

/** 设置中心布局，挂载全局壳层与二级菜单。 */
export default function SettingsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <AppShell
      title="设置"
      description="管理当前本地工作区配置，并为后续外部服务接入预留入口。"
      currentPath="/settings"
    >
      <SettingsShell>{children}</SettingsShell>
    </AppShell>
  );
}
