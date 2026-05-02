import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** 徽标组件的视觉变体配置。 */
const badgeVariants = cva(
  "inline-flex select-none items-center rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700",
        accent: "bg-sky-100 text-sky-700",
        muted: "bg-slate-50 text-slate-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/** 用于展示状态或分类的小型徽标组件。 */
function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
