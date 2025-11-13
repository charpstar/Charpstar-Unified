import { useState, useCallback } from "react";
import { toast } from "@/components/ui/utilities";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  country?: string | null;
  avatar?: string | null;
}

type NewUser = {
  name: string;
  email: string;
  role: string;
};

export function useUsers(enabled: boolean) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticUsers, setOptimisticUsers] = useState<User[] | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err: unknown) {
      console.error("Client error while fetching users:", err);
      if (err instanceof Error) {
        setError(err.message || "Failed to load users");
      } else {
        setError("Failed to load users");
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const addUser = useCallback(
    async (formData: NewUser) => {
      setIsAddingUser(true);
      const tempId = `temp-${Date.now()}`;
      const optimisticUser: User = {
        id: tempId,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        created_at: new Date().toISOString(),
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

        await fetchUsers();
        setOptimisticUsers(null);
        toast({ title: "Success", description: "User created successfully" });
        return { success: true };
      } catch (err: unknown) {
        setOptimisticUsers(null);
        let message = "Failed to create user";
        if (err instanceof Error) {
          message = err.message;
        }
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        return { success: false, error: message };
      } finally {
        setIsAddingUser(false);
      }
    },
    [optimisticUsers, users, fetchUsers]
  );

  return {
    users: optimisticUsers ?? users,
    loading,
    error,
    fetchUsers,
    addUser,
    isAddingUser,
  };
}
