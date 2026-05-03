import { redirect } from "next/navigation";

/** 兼容旧的 Git 同步入口，统一跳转到新的多端同步默认子页。 */
export default function LegacyGitSyncPage() {
  redirect("/sync/git-push");
}
