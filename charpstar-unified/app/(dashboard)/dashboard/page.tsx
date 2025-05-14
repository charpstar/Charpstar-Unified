"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

// Mock data functions (replace with real API calls later)
function fetchAdminDashboardData() {
  return Promise.resolve({
    totalUsers: 1234,
    totalSales: 987,
    revenue: "$45,000",
    recentSales: [
      { product: "Widget Pro", amount: "$1,200", date: "2024-03-22" },
      { product: "Gadget X", amount: "$800", date: "2024-03-21" },
    ],
    systemHealth: "All systems operational",
  });
}

function fetchClientDashboardData() {
  return Promise.resolve({
    products: [
      { name: "Widget Pro", status: "Active", sales: 12 },
      { name: "Gadget X", status: "Inactive", sales: 0 },
    ],
    sales: [
      { product: "Widget Pro", amount: "$1,200", date: "2024-03-22" },
      { product: "Widget Pro", amount: "$1,000", date: "2024-03-20" },
    ],
    supportContact: "support@charpstar.com",
  });
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [adminData, setAdminData] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (role === "admin") {
      fetchAdminDashboardData().then((data) => {
        setAdminData(data);
        setLoading(false);
      });
    } else if (role === "client") {
      fetchClientDashboardData().then((data) => {
        setClientData(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [role]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        Loading dashboard...
      </div>
    );
  }

  if (role === "admin" && adminData) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900">Total Users</h3>
            <p className="text-3xl font-bold mt-2">{adminData.totalUsers}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900">Total Sales</h3>
            <p className="text-3xl font-bold mt-2">{adminData.totalSales}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900">Revenue</h3>
            <p className="text-3xl font-bold mt-2">{adminData.revenue}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900">System Health</h3>
            <p className="text-lg mt-2">{adminData.systemHealth}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-2">Recent Sales</h3>
          <ul className="space-y-1">
            {adminData.recentSales.map((s: any, i: number) => (
              <li key={i} className="text-gray-700">
                {s.product} - <span className="font-semibold">{s.amount}</span>{" "}
                <span className="text-xs text-gray-400">({s.date})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (role === "client" && clientData) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Client Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900">Your Products</h3>
            <ul className="mt-2 space-y-1">
              {clientData.products.map((p: any, i: number) => (
                <li key={i} className="text-gray-700">
                  {p.name}{" "}
                  <span className="text-xs text-gray-400">({p.status})</span> -
                  Sales: <span className="font-semibold">{p.sales}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-gray-900">Your Sales</h3>
            <ul className="mt-2 space-y-1">
              {clientData.sales.map((s: any, i: number) => (
                <li key={i} className="text-gray-700">
                  {s.product} -{" "}
                  <span className="font-semibold">{s.amount}</span>{" "}
                  <span className="text-xs text-gray-400">({s.date})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="font-semibold text-gray-900">Support</h3>
          <p className="mt-2">Contact: {clientData.supportContact}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 text-center text-gray-500">
      No dashboard data available for your role.
    </div>
  );
}
