import * as React from "react";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { getUserNotificationFeed } from "@/features/notifications/queries";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, notificationsFeed] = await Promise.all([
    requireActiveProfile(),
    getUserNotificationFeed(8),
  ]);

  const userPayload = {
    id: profile.id,
    email: profile.email,
    full_name: profile.fullName,
    role: profile.role,
  };

  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Desktop Sidebar */}
      <AppSidebar user={userPayload} />

      {/* Main Content Column */}
      <div className="flex flex-1 flex-col min-w-0 md:h-screen md:overflow-hidden">
        <AppHeader user={userPayload} notificationsFeed={notificationsFeed} />
        <main className="flex-1 md:overflow-y-auto px-4 py-6 sm:px-6 md:px-8 lg:px-10 xl:px-12 md:py-8">
          <div className="w-full max-w-[1560px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
