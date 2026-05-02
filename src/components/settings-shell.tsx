"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { settingsNavigationItems } from "@/lib/settings/navigation";
import { cn } from "@/lib/utils";

/** 设置中心局部布局参数。 */
type SettingsShellProps = {
  children: ReactNode;
};

/** 提供设置中心二级菜单和内容区的双栏布局。 */
export function SettingsShell({ children }: SettingsShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex w-full flex-1 flex-col gap-6 p-5 lg:flex-row lg:gap-6 lg:px-8 lg:py-8">
      <aside className="w-full shrink-0 lg:w-72">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="px-2 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">设置分组</h2>
            <p className="mt-1 text-sm text-slate-500">
              统一管理本地工作区与后续外部服务接入配置。
            </p>
          </div>

          <nav className="space-y-1" aria-label="设置导航">
            {settingsNavigationItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-16 items-start gap-3 rounded-lg px-3 py-3 transition-colors",
                    active
                      ? "bg-slate-100 text-slate-950"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                      active ? "bg-white text-slate-900 shadow-sm" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{item.label}</div>
                    {item.description ? (
                      <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
