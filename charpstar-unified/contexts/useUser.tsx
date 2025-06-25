"use client";

import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { getUserWithMetadata } from "@/supabase/getUser";

type UserOrNull = Awaited<ReturnType<typeof getUserWithMetadata>> | null;

export const UserContext = React.createContext<UserOrNull | undefined>(
  undefined
);

export const UserProvider = ({ children }: React.PropsWithChildren<{}>) => {
  const [user, setUser] = React.useState<UserOrNull>(null);

  React.useEffect(() => {
    // Helper to fetch and set user with metadata
    const fetchUser = async () => {
      const newUser = await getUserWithMetadata(supabase);
      setUser(newUser);
    };

    fetchUser(); // Initial fetch

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, _session) => {
        fetchUser(); // Refetch user (with metadata) whenever auth changes
      }
    );

    // Listen for avatar update events
    const handleAvatarUpdate = () => {
      console.log(
        "UserProvider: Received avatarUpdated event, refetching user metadata"
      );
      fetchUser();
    };

    window.addEventListener("avatarUpdated", handleAvatarUpdate);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("avatarUpdated", handleAvatarUpdate);
    };
  }, []);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = React.useContext(UserContext);
  if (typeof context === "undefined")
    throw new Error("useUser must be used within a UserProvider");

  return context; // Return the user directly, not the context object
};
