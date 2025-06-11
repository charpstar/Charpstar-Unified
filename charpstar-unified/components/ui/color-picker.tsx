import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const themeColors = [
  {
    name: "Blue",
    value: "blue",
    colors: {
      light: {
        "--primary": "#2563eb",
        "--primary-foreground": "#fff",
        "--background": "#fff", // Soft light for light mode
      },
      dark: {
        "--primary": "#60a5fa",
        "--primary-foreground": "#1e293b",
        "--background": "#18181b", // Soft dark for dark mode
      },
    },
  },
  {
    name: "Green",
    value: "green",
    colors: {
      light: {
        "--primary": "#16a34a",
        "--primary-foreground": "#fff",
        "--background": "#fff",
      },
      dark: {
        "--primary": "#86efac",
        "--primary-foreground": "#1e293b",
        "--background": "#18181b",
      },
    },
  },
  {
    name: "Purple",
    value: "purple",
    colors: {
      light: {
        "--primary": "#7c3aed",
        "--primary-foreground": "#fff",
        "--background": "#fff",
      },
      dark: {
        "--primary": "#c4b5fd",
        "--primary-foreground": "#1e293b",
        "--background": "#18181b",
      },
    },
  },
  {
    name: "Grey",
    value: "grey",
    colors: {
      light: {
        "--primary": "#18181b",
        "--primary-foreground": "#fff",
        "--background": "#fff",
      },
      dark: {
        "--primary": "#fff",
        "--primary-foreground": "#18181b",
        "--background": "#18181b",
      },
    },
  },
];

function ColorCardSkeleton({
  light,
  dark,
}: {
  light: { primary: string; bg: string };
  dark: { primary: string; bg: string };
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const primary = isDark ? dark.primary : light.primary;
  const bg = isDark ? dark.bg : light.bg;

  return (
    <div
      className="w-full h-20 rounded-lg p-3 flex flex-col gap-2"
      style={{ background: bg }}
    >
      <div className="flex items-center gap-2">
        <div className="rounded-full h-3 w-3" style={{ background: primary }} />
        <div
          className="rounded h-2 w-3/5"
          style={{ background: primary, opacity: 0.4 }}
        />
      </div>
      <div
        className="rounded h-2 w-full"
        style={{ background: primary, opacity: 0.4 }}
      />
      <div
        className="rounded h-2 w-4/5"
        style={{ background: primary, opacity: 0.2 }}
      />
    </div>
  );
}

export function ColorThemePicker() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Store a color theme for each mode
  const [colorTheme, setColorTheme] = useState(() => {
    if (typeof window === "undefined") return "blue";
    const key = isDark ? "app-color-theme-dark" : "app-color-theme-light";
    return localStorage.getItem(key) || "blue";
  });

  // Update CSS variables when color/theme changes
  useEffect(() => {
    const key = isDark ? "app-color-theme-dark" : "app-color-theme-light";
    const selected = themeColors.find((t) => t.value === colorTheme);
    if (selected) {
      const colors = isDark ? selected.colors.dark : selected.colors.light;
      for (const [k, v] of Object.entries(colors)) {
        document.documentElement.style.setProperty(k, v);
      }
      localStorage.setItem(key, colorTheme);
    }
  }, [colorTheme, isDark]);

  // Update local state when theme changes (sync the right palette)
  useEffect(() => {
    const key = isDark ? "app-color-theme-dark" : "app-color-theme-light";
    setColorTheme(localStorage.getItem(key) || "blue");
  }, [isDark]);

  return (
    <div>
      <div className="text-base font-medium text-foreground">Accent Color</div>
      <div className="text-sm text-muted-foreground mb-4">
        Choose your accent color for the app.
      </div>
      <div className="flex gap-6">
        {themeColors.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={colorTheme === t.value}
            onClick={() => setColorTheme(t.value)}
            className={cn(
              "relative flex flex-col items-center justify-between rounded-xl transition-all p-3 w-36 border-2 outline-none ring-0",
              colorTheme === t.value
                ? "border-primary ring-2 ring-primary shadow-lg"
                : "border-muted hover:border-primary/60"
            )}
            style={{
              background: isDark
                ? t.colors.dark["--background"]
                : t.colors.light["--background"],
            }}
          >
            <ColorCardSkeleton
              light={{
                primary: t.colors.light["--primary"],
                bg: t.colors.light["--background"],
              }}
              dark={{
                primary: t.colors.dark["--primary"],
                bg: t.colors.dark["--background"],
              }}
            />
            <span
              className={cn(
                "block mt-3 text-sm font-medium",
                colorTheme === t.value
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
              style={{
                color:
                  colorTheme === t.value
                    ? isDark
                      ? t.colors.dark["--primary"]
                      : t.colors.light["--primary"]
                    : undefined,
              }}
            >
              {t.name}
            </span>
            {colorTheme === t.value && (
              <span
                className="absolute top-2 right-2 inline-block w-3 h-3 rounded-full"
                style={{
                  background: isDark
                    ? t.colors.dark["--primary"]
                    : t.colors.light["--primary"],
                  boxShadow: "0 0 0 2px #fff",
                }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
