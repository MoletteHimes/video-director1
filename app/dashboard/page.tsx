import { Sidebar } from "@/components/Sidebar";
import { DashboardClient } from "@/components/DashboardClient";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <div className="p-5 lg:pl-28 lg:pr-8 lg:py-8">
        <DashboardClient />
      </div>
    </main>
  );
}
