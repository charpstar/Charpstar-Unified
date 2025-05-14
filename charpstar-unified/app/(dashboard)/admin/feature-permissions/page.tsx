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

const features = [
  { key: "edit_user", label: "Edit User" },
  { key: "delete_user", label: "Delete User" },
  { key: "add_user", label: "Add User" },
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

export default function FeaturePermissionsPage() {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const getKey = (role: string, feature: string) => `${role}:${feature}`;

  useEffect(() => {
    async function fetchPermissions() {
      setLoading(true);
      const { data, error } = await supabase
        .from("role_feature_permissions")
        .select();
      if (error) {
        toast({
          title: "Error",
          description: "Failed to load feature permissions",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const perms: Record<string, boolean> = {};
      data.forEach((row: any) => {
        perms[getKey(row.role, row.feature)] = row.can_access;
      });
      setPermissions(perms);
      setLoading(false);
    }
    fetchPermissions();
  }, []);

  const handleToggle = async (
    role: string,
    feature: string,
    value: boolean
  ) => {
    const key = getKey(role, feature);
    setPermissions((prev) => ({ ...prev, [key]: value }));
    setPending(key);
    const { error } = await supabase
      .from("role_feature_permissions")
      .upsert(
        { role, feature, can_access: value },
        { onConflict: "role,feature" }
      );
    setPending(null);
    if (error) {
      setPermissions((prev) => ({ ...prev, [key]: !value }));
      toast({
        title: "Error",
        description: "Failed to update feature permission",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Feature permission updated for ${role} on ${feature}`,
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold mb-4">
        Feature Permissions Management
      </h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feature</TableHead>
            {roles.map((role) => (
              <TableHead key={role} className="capitalize">
                {role}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((feature) => (
            <TableRow key={feature.key}>
              <TableCell>{feature.label}</TableCell>
              {roles.map((role) => (
                <TableCell key={role}>
                  <input
                    type="checkbox"
                    checked={permissions[getKey(role, feature.key)] ?? false}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleToggle(role, feature.key, e.target.checked)
                    }
                    disabled={loading || pending === getKey(role, feature.key)}
                  />
                  {pending === getKey(role, feature.key) && (
                    <span className="ml-2 animate-spin">⏳</span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
