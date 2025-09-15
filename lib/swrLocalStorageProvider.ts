"use client";

export const localStorageProvider = () => {
  // When initializing, restore the data from localStorage into a map.
  const map = new Map<string, any>(
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("app-cache") || "[]")
      : []
  );

  // Before unloading the app, write back all the data into localStorage.
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      const appCache = JSON.stringify(Array.from(map.entries()));
      localStorage.setItem("app-cache", appCache);
    });
  }

  // Use the map for write & read for performance.
  return map;
};
