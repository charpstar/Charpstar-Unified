"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const pages = [
  { key: "/dashboard", label: "Dashboard" },
  { key: "/users", label: "Users" },
  { key: "/settings", label: "Settings" },
];

const roles = [
  "admin",
  "manager",
  "user",
  "client",
  "qa",
  "qamanager",
  "modeler",
  "modelermanager",
];

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Helper to get permission key
  const getKey = (role: string, page: string) => `${role}:${page}`;

  useEffect(() => {
    async function fetchPermissions() {
      setLoading(true);
      const { data, error } = await supabase.from("role_permissions").select();
      if (error) {
        toast({
          title: "Error",
          description: "Failed to load permissions",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const perms: Record<string, boolean> = {};
      data.forEach((row: any) => {
        perms[getKey(row.role, row.page)] = row.can_access;
      });
      setPermissions(perms);
      setLoading(false);
    }
    fetchPermissions();
  }, []);

  const handleToggle = async (role: string, page: string, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [getKey(role, page)]: value }));
    // Upsert the permission
    const { error } = await supabase.from("role_permissions").upsert(
      {
        role,
        page,
        can_access: value,
      },
      { onConflict: "role,page" }
    );
    if (error) {
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Permission updated for ${role} on ${page}`,
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold mb-4">
        Role Permissions Management
      </h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
            {roles.map((role) => (
              <TableHead key={role} className="capitalize">
                {role}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((page) => (
            <TableRow key={page.key}>
              <TableCell>{page.label}</TableCell>
              {roles.map((role) => (
                <TableCell key={role}>
                  <input
                    type="checkbox"
                    checked={permissions[getKey(role, page.key)] ?? false}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleToggle(role, page.key, e.target.checked)
                    }
                    disabled={loading}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
