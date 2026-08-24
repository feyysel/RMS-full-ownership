import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import InsightsClient from "./insights-client";

export default async function ManagerInsightsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "OWNER") redirect("/manager");

  return <InsightsClient />;
}
