import { redirect } from "next/navigation";

/** 多端同步模块入口，统一跳转到默认子页。 */
export default function SyncIndexPage() {
  redirect("/sync/git-push");
}
