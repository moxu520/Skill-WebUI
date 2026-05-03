import type { ComponentType } from "react";
import { Archive, GitBranch, Waypoints } from "lucide-react";

/** 多端同步模块单个导航项的定义。 */
export type MultiSyncNavigationItem = {
  href: string;
  label: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  status: "available" | "planned";
};

/** 多端同步模块的二级导航定义。 */
export const multiSyncNavigationItems: MultiSyncNavigationItem[] = [
  {
    href: "/sync/git-push",
    label: "推送至Git",
    description: "本地 Skill 推送到默认 Git 仓库",
    icon: GitBranch,
    status: "available",
  },
  {
    href: "/sync/archive",
    label: "压缩包同步",
    description: "通过压缩包进行跨端同步",
    icon: Archive,
    status: "planned",
  },
  {
    href: "/sync/channels",
    label: "更多渠道",
    description: "预留给后续更多同步目标",
    icon: Waypoints,
    status: "planned",
  },
];
