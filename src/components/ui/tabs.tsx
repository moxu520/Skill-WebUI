import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/** 标签页根容器。 */
function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root className={cn("flex min-w-0 flex-col gap-4", className)} {...props} />
  );
}

/** 标签页按钮列表容器。 */
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex min-h-10 min-w-0 items-center rounded-lg bg-slate-100 p-1 text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

/** 单个标签页切换按钮。 */
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-8 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/** 当前标签页对应的内容区域。 */
function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "min-w-0 w-full outline-none data-[state=active]:animate-[fade-in_180ms_ease-out]",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
