import * as React from "react";
import { cn } from "@/lib/utils";

/** 基础卡片容器。 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200/80 bg-white shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/** 卡片头部区域。 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />;
}

/** 卡片标题。 */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("select-none text-sm font-semibold tracking-normal text-slate-900", className)}
      {...props}
    />
  );
}

/** 卡片描述文本。 */
function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("select-none text-sm text-slate-500", className)} {...props} />;
}

/** 卡片主体内容区域。 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
