import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ROLE_HOME } from "@/lib/constants";

export default async function AppEntry() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(ROLE_HOME[session.role] ?? "/login");
}
