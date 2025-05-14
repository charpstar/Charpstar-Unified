import { useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "@/components/ui/use-toast";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function useUsers(enabled: boolean) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticUsers, setOptimisticUsers] = useState<User[] | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, email, profiles!profiles_user_id_fkey(role)")
        .order("created_at", { ascending: false });
      if (usersError) throw usersError;
      const transformedUsers: User[] = (usersData as any[]).map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: Array.isArray(user.profiles)
          ? user.profiles[0]?.role || "User"
          : user.profiles?.role || "User",
      }));
      setUsers(transformedUsers);
    } catch (err: any) {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Fetch users on mount if enabled
  // (The component should call fetchUsers when appropriate)

  const addUser = useCallback(
    async (formData: any) => {
      setIsAddingUser(true);
      const tempId = `temp-${Date.now()}`;
      const optimisticUser = {
        id: tempId,
        name: formData.name,
        email: formData.email,
        role: formData.role,
      };
      setOptimisticUsers([optimisticUser, ...(optimisticUsers ?? users)]);
      try {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "Failed to create user");
        setUsers((prev) => [
          {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
          },
          ...prev.filter((u) => u.id !== tempId),
        ]);
        setOptimisticUsers(null);
        toast({ title: "Success", description: "User created successfully" });
        return { success: true };
      } catch (err: any) {
        setOptimisticUsers(null);
        toast({
          title: "Error",
          description: err.message || "Failed to create user",
          variant: "destructive",
        });
        return { success: false, error: err.message };
      } finally {
        setIsAddingUser(false);
      }
    },
    [optimisticUsers, users]
  );

  const updateUser = useCallback(
    async (userId: string, formData: any) => {
      setOptimisticUsers(
        (optimisticUsers ?? users).map((u) =>
          u.id === userId
            ? {
                ...u,
                name: formData.name,
                email: formData.email,
                role: formData.role,
              }
            : u
        )
      );
      try {
        const { error: userError } = await supabase
          .from("users")
          .update({ name: formData.name, email: formData.email })
          .eq("id", userId);
        if (userError) throw userError;
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ role: formData.role.toLowerCase() })
          .eq("user_id", userId);
        if (profileError) throw profileError;
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  name: formData.name,
                  email: formData.email,
                  role: formData.role,
                }
              : u
          )
        );
        setOptimisticUsers(null);
        toast({ title: "Success", description: "User updated successfully" });
        return { success: true };
      } catch (err: any) {
        setOptimisticUsers(null);
        toast({
          title: "Error",
          description: "Failed to update user. Please try again.",
          variant: "destructive",
        });
        return { success: false, error: err.message };
      }
    },
    [optimisticUsers, users]
  );

  const deleteUser = useCallback(
    async (user: User) => {
      setIsDeletingUser(true);
      setPendingUserId(user.id);
      setOptimisticUsers(
        (optimisticUsers ?? users).filter((u) => u.id !== user.id)
      );
      try {
        const [profileRes, userRes] = await Promise.all([
          supabase.from("profiles").delete().eq("user_id", user.id),
          supabase.from("users").delete().eq("id", user.id),
        ]);
        if (profileRes.error) throw profileRes.error;
        if (userRes.error) throw userRes.error;
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        setOptimisticUsers(null);
        toast({ title: "Success", description: "User deleted successfully" });
        return { success: true };
      } catch (err: any) {
        setOptimisticUsers(null);
        toast({
          title: "Error",
          description: "Failed to delete user. Please try again.",
          variant: "destructive",
        });
        return { success: false, error: err.message };
      } finally {
        setIsDeletingUser(false);
        setPendingUserId(null);
      }
    },
    [optimisticUsers, users]
  );

  return {
    users: optimisticUsers ?? users,
    loading,
    error,
    addUser,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
    isAddingUser,
    isDeletingUser,
    pendingUserId,
  };
}
