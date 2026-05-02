import { redirect } from "next/navigation";

/** 根路由入口，统一跳转到技能工作区。 */
export default function HomePage() {
  redirect("/skills");
}
