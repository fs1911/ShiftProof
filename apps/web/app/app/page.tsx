import { redirect } from "next/navigation";

/** /app has no screen of its own — send users to the dashboard. */
export default function AppIndexPage() {
  redirect("/app/dashboard");
}
