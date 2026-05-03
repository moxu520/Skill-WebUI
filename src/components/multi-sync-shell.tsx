"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { multiSyncNavigationItems } from "@/lib/sync/navigation";
import { cn } from "@/lib/utils";

/** 多端同步局部布局参数。 */
type MultiSyncShellProps = {
  children: ReactNode;
};

/** 提供多端同步模块二级菜单和内容区的双栏布局。 */
export function MultiSyncShell({ children }: MultiSyncShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex w-full flex-1 flex-col gap-6 p-5 lg:flex-row lg:gap-6 lg:px-8 lg:py-8">
      <aside className="ui-chrome w-full shrink-0 lg:w-72">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="px-2 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">同步方式</h2>
            <p className="mt-1 text-sm text-slate-500">
              管理当前工作区的多端同步能力，已接入功能和后续能力都统一收口在这里。
            </p>
          </div>

          <nav className="space-y-1" aria-label="多端同步导航">
            {multiSyncNavigationItems.map((item) => {
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.status === "planned" ? (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          未开发
                        </span>
                      ) : null}
                    </div>
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
