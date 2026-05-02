import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** 通用弹窗根节点。 */
const Dialog = DialogPrimitive.Root;
/** 弹窗触发器。 */
const DialogTrigger = DialogPrimitive.Trigger;
/** 弹窗门户。 */
const DialogPortal = DialogPrimitive.Portal;
/** 弹窗关闭控制。 */
const DialogClose = DialogPrimitive.Close;

/** 弹窗背景遮罩。 */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm transition-opacity duration-200 data-[state=closed]:animate-[fade-out_180ms_ease-in] data-[state=open]:animate-[fade-in_180ms_ease-out]",
        className,
      )}
      {...props}
    />
  );
}

/** 带统一样式和关闭按钮的弹窗主体。 */
function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex w-[min(960px,calc(100vw-32px))] max-h-[calc(100vh-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl transition-opacity duration-200 data-[state=closed]:animate-[fade-out_160ms_ease-in] data-[state=open]:animate-[fade-in_200ms_ease-out]",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
          <X className="h-4 w-4" />
          <span className="sr-only">关闭</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/** 弹窗头部区域。 */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("shrink-0 flex flex-col gap-1 px-5 pt-5", className)} {...props} />
  );
}

/** 弹窗标题。 */
function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-lg font-semibold text-slate-900", className)}
      {...props}
    />
  );
}

/** 弹窗描述文本。 */
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-slate-500", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
