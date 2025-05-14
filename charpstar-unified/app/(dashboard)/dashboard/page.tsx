"use client";

import { usePagePermission } from "@/lib/usePagePermission";
import { useSession } from "next-auth/react";

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { hasAccess, loading } = usePagePermission(role, "/dashboard");

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">Loading...</div>
    );
  }
  if (!hasAccess) {
    return <div className="p-6 text-center text-destructive">No Access</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {session?.user?.name}
        </h1>
        <p className="text-gray-500">
          Here's what's happening with your account today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sample dashboard cards */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="font-semibold text-gray-900">Total Users</h3>
          <p className="text-3xl font-bold mt-2">1,234</p>
          <p className="text-sm text-gray-500 mt-1">+12% from last month</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="font-semibold text-gray-900">Active Projects</h3>
          <p className="text-3xl font-bold mt-2">56</p>
          <p className="text-sm text-gray-500 mt-1">+3 new this week</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="font-semibold text-gray-900">Total Revenue</h3>
          <p className="text-3xl font-bold mt-2">$45,678</p>
          <p className="text-sm text-gray-500 mt-1">+8% from last month</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Recent Activity
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  {i}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Activity {i} Title
                  </p>
                  <p className="text-sm text-gray-500">
                    Some description about the activity
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
