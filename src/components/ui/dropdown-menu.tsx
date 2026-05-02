import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

/** 下拉菜单根节点。 */
const DropdownMenu = DropdownMenuPrimitive.Root;
/** 下拉菜单触发器。 */
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
/** 下拉菜单浮层门户。 */
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
/** 带统一样式的下拉菜单内容容器。 */
const DropdownMenuContent = ({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) => (
  <DropdownMenuPortal>
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg",
        className,
      )}
      {...props}
    />
  </DropdownMenuPortal>
);

/** 带统一样式的下拉菜单选项。 */
const DropdownMenuItem = ({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) => (
  <DropdownMenuPrimitive.Item
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-slate-700 outline-none transition hover:bg-slate-100 focus:bg-slate-100",
      className,
    )}
    {...props}
  />
);

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
};
