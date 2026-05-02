import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";

/** 警示确认弹窗根节点。 */
const AlertDialog = AlertDialogPrimitive.Root;
/** 警示确认弹窗触发器。 */
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
/** 警示确认弹窗门户。 */
const AlertDialogPortal = AlertDialogPrimitive.Portal;
/** 警示确认操作按钮。 */
const AlertDialogAction = AlertDialogPrimitive.Action;
/** 警示取消按钮。 */
const AlertDialogCancel = AlertDialogPrimitive.Cancel;

/** 警示弹窗背景遮罩。 */
function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn("fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm", className)}
      {...props}
    />
  );
}

/** 警示弹窗主体容器。 */
function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-xl",
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

/** 警示弹窗头部区域。 */
function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

/** 警示弹窗底部操作区。 */
function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}

/** 警示弹窗标题。 */
function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn("text-base font-semibold text-slate-900", className)}
      {...props}
    />
  );
}

/** 警示弹窗说明文本。 */
function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-sm text-slate-500", className)}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
