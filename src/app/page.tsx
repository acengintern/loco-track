import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/auth";

export default async function RootPage() {
  const profile = await getCurrentProfile();
  if (profile && profile.isActive) {
    redirect("/dashboard");
  }
  redirect("/login");
}
