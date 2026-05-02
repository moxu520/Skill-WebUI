import { redirect } from "next/navigation";

/** 设置中心入口，统一跳转到默认子页。 */
export default function SettingsIndexPage() {
  redirect("/settings/general");
}
