import { useState, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";

export interface User {
  [x: string]: string | Blob | undefined;
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

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
      const users: User[] = await response.json();

      console.log("Fetched users from API:", users);

      setUsers(users);
    } catch (err: any) {
      console.error("Client error while fetching users:", err);
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const addUser = useCallback(
    async (formData: any) => {
      setIsAddingUser(true);
      const tempId = `temp-${Date.now()}`;
      const optimisticUser = {
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

        // Refresh the users list to get the new user with correct data
        await fetchUsers();
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
