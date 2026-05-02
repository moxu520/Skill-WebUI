import Link from "next/link";
import {
  AlertTriangle,
  Blocks,
  GitBranch,
  Languages,
  Settings,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNavigation = [
  { href: "/skills", label: "技能", icon: Blocks },
];

const upcomingNavigation = [
  { label: "翻译技能", icon: Languages },
  { label: "技能市场", icon: Store },
  { label: "Git 同步", icon: GitBranch },
  { label: "风险检测", icon: AlertTriangle },
];

const secondaryNavigation = [
  { href: "/settings", label: "全局设置", icon: Settings },
];

/** 应用壳层组件的输入参数。 */
type AppShellProps = {
  title: string;
  description: string;
  currentPath: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
};

/** 提供左侧导航、页头和主内容区的统一应用壳层。 */
export function AppShell({
  title,
  description,
  currentPath,
  toolbar,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-64 border-r border-slate-200/80 bg-white/80 px-4 py-5 lg:flex lg:flex-col">
        <div className="px-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Blocks className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Skill WebUI</p>
              <p className="text-xs text-slate-500">本地技能工作台</p>
            </div>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          {primaryNavigation.map((item) => {
            const Icon = item.icon;
            const active = currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {upcomingNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  待开发
                </span>
              </div>
            );
          })}
        </nav>

        <nav className="mt-auto space-y-1 pt-6">
          {secondaryNavigation.map((item) => {
            const Icon = item.icon;
            const active = currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
          <div className="flex flex-col gap-4 px-5 py-4 lg:px-8">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold tracking-normal">{title}</h1>
              <p className="text-sm text-slate-500">{description}</p>
            </div>
            {toolbar ? <div>{toolbar}</div> : null}
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
