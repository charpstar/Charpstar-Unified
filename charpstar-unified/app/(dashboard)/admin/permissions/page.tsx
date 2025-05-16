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
  const [pending, setPending] = useState<string | null>(null);

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
    const key = getKey(role, page);
    setPermissions((prev) => ({ ...prev, [key]: value }));
    setPending(key);
    const { error } = await supabase
      .from("role_permissions")
      .upsert({ role, page, can_access: value }, { onConflict: "role,page" });
    setPending(null);
    if (error) {
      setPermissions((prev) => ({ ...prev, [key]: !value }));
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
      <h1 className="text-2xl font-semibold mb-4 text-foreground">
        Role Permissions Management
      </h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-muted-foreground">Page</TableHead>
            {roles.map((role) => (
              <TableHead
                key={role}
                className="capitalize text-muted-foreground"
              >
                {role}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((page) => (
            <TableRow key={page.key} className="bg-card border-b border-border">
              <TableCell className="text-foreground">{page.label}</TableCell>
              {roles.map((role) => {
                const key = getKey(role, page.key);
                return (
                  <TableCell key={role} className="text-foreground">
                    <input
                      type="checkbox"
                      checked={permissions[key] ?? false}
                      onChange={(e) =>
                        handleToggle(role, page.key, e.target.checked)
                      }
                      disabled={loading || pending === key}
                      className="accent-blue-500"
                    />
                    {pending === key && (
                      <span className="ml-2 animate-spin inline-block">⏳</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
