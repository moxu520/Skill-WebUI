import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { MultiSyncShell } from "@/components/multi-sync-shell";

/** 多端同步模块布局，挂载全局壳层与模块级二级菜单。 */
export default function SyncLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <AppShell
      title="多端同步"
      description="集中管理当前工作区的多端同步方式，已接入功能和后续能力都统一收口在这里。"
      currentPath="/sync"
    >
      <MultiSyncShell>{children}</MultiSyncShell>
    </AppShell>
  );
}
