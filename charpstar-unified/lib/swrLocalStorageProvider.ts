"use client";

export const localStorageProvider = () => {
  // When initializing, restore the data from localStorage into a map.
  const map = new Map<string, any>(
    JSON.parse(localStorage.getItem("app-cache") || "[]")
  );

  // Before unloading the app, write back all the data into localStorage.
  window.addEventListener("beforeunload", () => {
    const appCache = JSON.stringify(Array.from(map.entries()));
    localStorage.setItem("app-cache", appCache);
  });

  // Use the map for write & read for performance.
  return map;
};
