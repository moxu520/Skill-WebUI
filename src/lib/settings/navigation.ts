import type { ComponentType } from "react";
import {
  FolderSearch,
  Languages,
  Settings2,
  Waypoints,
} from "lucide-react";

/** 设置中心单个导航项的定义。 */
export type SettingsNavigationItem = {
  href: string;
  label: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
};

/** 设置中心的二级导航定义。 */
export const settingsNavigationItems: SettingsNavigationItem[] = [
  {
    href: "/settings/general",
    label: "通用",
    description: "当前工作区的全局基础配置",
    icon: Settings2,
  },
  {
    href: "/settings/discovery",
    label: "技能发现",
    description: "自动扫描来源与额外根目录",
    icon: FolderSearch,
  },
  {
    href: "/settings/model-providers",
    label: "模型服务",
    description: "第三方模型服务接入配置",
    icon: Waypoints,
  },
  {
    href: "/settings/translation-providers",
    label: "翻译服务",
    description: "第三方翻译服务接入配置",
    icon: Languages,
  },
];
