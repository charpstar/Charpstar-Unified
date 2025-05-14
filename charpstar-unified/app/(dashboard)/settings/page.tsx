"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { usePagePermission } from "@/lib/usePagePermission";

export default function SettingsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { hasAccess, loading } = usePagePermission(role, "/settings");
  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    notifications: {
      email: true,
      push: false,
      marketing: true,
    },
    theme: "light",
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">Loading...</div>
    );
  }
  if (!hasAccess) {
    return <div className="p-6 text-center text-destructive">No Access</div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement settings update
    console.log("Settings updated:", formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold border-b pb-2">Profile</h2>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold border-b pb-2">
                Notifications
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Email Notifications
                    </h3>
                    <p className="text-sm text-gray-500">
                      Receive email updates about your account
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          email: !formData.notifications.email,
                        },
                      })
                    }
                    className={`${
                      formData.notifications.email
                        ? "bg-gray-900"
                        : "bg-gray-200"
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out`}
                  >
                    <span
                      className={`${
                        formData.notifications.email
                          ? "translate-x-6"
                          : "translate-x-1"
                      } inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out mt-1`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Push Notifications
                    </h3>
                    <p className="text-sm text-gray-500">
                      Receive push notifications in your browser
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          push: !formData.notifications.push,
                        },
                      })
                    }
                    className={`${
                      formData.notifications.push
                        ? "bg-gray-900"
                        : "bg-gray-200"
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out`}
                  >
                    <span
                      className={`${
                        formData.notifications.push
                          ? "translate-x-6"
                          : "translate-x-1"
                      } inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out mt-1`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Theme Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold border-b pb-2">
                Appearance
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Theme
                </label>
                <select
                  value={formData.theme}
                  onChange={(e) =>
                    setFormData({ ...formData, theme: e.target.value })
                  }
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-gray-900 focus:border-gray-900 rounded-md"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
