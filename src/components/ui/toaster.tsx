"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** 单条 Toast 消息的视觉类型。 */
type ToastVariant = "default" | "success" | "error";

/** 新建 Toast 时允许传入的数据结构。 */
type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

/** 运行中 Toast 的完整状态。 */
type ToastRecord = ToastInput & {
  id: string;
  open: boolean;
};

/** Toast 上下文暴露的操作接口。 */
type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** 根据不同 Toast 类型返回对应的图标。 */
function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }

  if (variant === "error") {
    return <CircleAlert className="h-4 w-4 text-red-600" />;
  }

  return <CheckCircle2 className="h-4 w-4 text-slate-500" />;
}

/** 根据不同 Toast 类型返回对应的容器样式。 */
function toastVariantClassName(variant: ToastVariant) {
  if (variant === "success") {
    return "border-emerald-200 bg-emerald-50/95";
  }

  if (variant === "error") {
    return "border-red-200 bg-red-50/95";
  }

  return "border-slate-200 bg-white/95";
}

/** 应用级 Toast Provider，负责管理全局提示消息。 */
export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  /** 关闭并移除指定的 Toast。 */
  const dismissToast = useCallback((id: string, open: boolean) => {
    if (open) {
      return;
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  /** 新增一条 Toast 消息。 */
  const toast = useCallback((input: ToastInput) => {
    const id =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((current) => [
      ...current,
      {
        id,
        open: true,
        variant: input.variant ?? "default",
        title: input.title,
        description: input.description,
      },
    ]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={3500}>
        {children}
        {toasts.map((toastItem) => (
          <ToastPrimitive.Root
            key={toastItem.id}
            open={toastItem.open}
            onOpenChange={(open) => dismissToast(toastItem.id, open)}
            className={cn(
              "group pointer-events-auto relative flex w-[min(360px,calc(100vw-24px))] items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg backdrop-blur transition-all data-[state=closed]:animate-[fade-out_120ms_ease-in] data-[state=open]:animate-[fade-in_160ms_ease-out] data-[swipe=end]:animate-[fade-out_120ms_ease-in] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
              toastVariantClassName(toastItem.variant ?? "default"),
            )}
          >
            <div className="mt-0.5 shrink-0">
              <ToastIcon variant={toastItem.variant ?? "default"} />
            </div>
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-medium text-slate-900">
                {toastItem.title}
              </ToastPrimitive.Title>
              {toastItem.description ? (
                <ToastPrimitive.Description className="mt-1 text-sm text-slate-600">
                  {toastItem.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close className="rounded-sm p-1 text-slate-400 transition hover:bg-white/60 hover:text-slate-700">
              <X className="h-4 w-4" />
              <span className="sr-only">关闭</span>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed right-0 top-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-3 outline-none sm:max-w-[420px]" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

/** 提供全局 Toast 调用入口。 */
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast 必须在 ToasterProvider 内使用。");
  }

  return context;
}
