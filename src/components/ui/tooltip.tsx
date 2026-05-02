import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/** Tooltip 上下文提供器。 */
const TooltipProvider = TooltipPrimitive.Provider;
/** Tooltip 根容器。 */
const Tooltip = TooltipPrimitive.Root;
/** Tooltip 触发器。 */
const TooltipTrigger = TooltipPrimitive.Trigger;

/** 统一样式的提示浮层内容。 */
function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-md",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
