"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const editorThemeColors = [
  {
    name: "Standard",
    value: "shadcn",
    colors: {
      light: {
        "--primary": "#18181b", // shadcn default grey/black
        "--primary-foreground": "#fff",
        "--background": "#fff",
        "--primary-hue": "0",
        "--primary-sat": "0%",
        "--primary-light": "10%",
      },
      dark: {
        "--primary": "#fff",
        "--primary-foreground": "#18181b",
        "--background": "#18181b",
        "--primary-hue": "0",
        "--primary-sat": "0%",
        "--primary-light": "100%",
      },
    },
  },
  {
    name: "Green",
    value: "supabase-green",
    colors: {
      light: {
        "--primary": "#3ECF8E",
        "--primary-foreground": "#fff",
        "--background": "#fff",
        "--primary-hue": "153",
        "--primary-sat": "60%",
        "--primary-light": "45%",
      },
      dark: {
        "--primary": "#3ECF8E",
        "--primary-foreground": "#1e293b",
        "--background": "#18181b",
        "--primary-hue": "153",
        "--primary-sat": "60%",
        "--primary-light": "45%",
      },
    },
  },
  {
    name: "Purple",
    value: "lavender-purple",
    colors: {
      light: {
        "--primary": "#A855F7",
        "--primary-foreground": "#fff",
        "--background": "#fff",
        "--primary-hue": "271",
        "--primary-sat": "90%",
        "--primary-light": "65%",
      },
      dark: {
        "--primary": "#C084FC",
        "--primary-foreground": "#1e293b",
        "--background": "#18181b",
        "--primary-hue": "271",
        "--primary-sat": "90%",
        "--primary-light": "75%",
      },
    },
  },
  {
    name: "Orange",
    value: "fire-orange",
    colors: {
      light: {
        "--primary": "#F97316",
        "--primary-foreground": "#fff",
        "--background": "#fff",
        "--primary-hue": "25",
        "--primary-sat": "95%",
        "--primary-light": "55%",
      },
      dark: {
        "--primary": "#FB923C",
        "--primary-foreground": "#1e293b",
        "--background": "#18181b",
        "--primary-hue": "25",
        "--primary-sat": "95%",
        "--primary-light": "65%",
      },
    },
  },
  {
    name: "Blue",
    value: "windows-blue",
    colors: {
      light: {
        "--primary": "#2563eb",
        "--primary-foreground": "#fff",
        "--background": "#fff",
        "--primary-hue": "217",
        "--primary-sat": "91%",
        "--primary-light": "53%",
      },
      dark: {
        "--primary": "#60a5fa",
        "--primary-foreground": "#1e293b",
        "--background": "#18181b",
        "--primary-hue": "217",
        "--primary-sat": "91%",
        "--primary-light": "70%",
      },
    },
  },
];

function EditorColorCardSkeleton({
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

export function EditorThemePicker() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Store editor theme color for each mode
  const [editorTheme, setEditorTheme] = useState(() => {
    if (typeof window === "undefined") return "shadcn";
    const key = isDark ? "editor-theme-dark" : "editor-theme-light";
    return localStorage.getItem(key) || "shadcn";
  });

  // Update CSS variables when editor theme changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = isDark ? "editor-theme-dark" : "editor-theme-light";
    const selected = editorThemeColors.find((t) => t.value === editorTheme);
    if (selected) {
      const colors = isDark ? selected.colors.dark : selected.colors.light;
      for (const [k, v] of Object.entries(colors)) {
        document.documentElement.style.setProperty(k, v);
      }
      localStorage.setItem(key, editorTheme);
    }
  }, [editorTheme, isDark]);

  // Update local state when theme changes (sync the right palette)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = isDark ? "editor-theme-dark" : "editor-theme-light";
    setEditorTheme(localStorage.getItem(key) || "shadcn");
  }, [isDark]);

  return (
    <div>
      <div className="text-base font-medium text-foreground">Editor Theme</div>
      <div className="text-sm text-muted-foreground mb-4">
        Choose the theme color for the 3D editor interface.
      </div>
      <div className="flex gap-4 flex-wrap">
        {editorThemeColors.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={editorTheme === t.value}
            onClick={() => setEditorTheme(t.value)}
            className={cn(
              "relative flex flex-col items-center justify-between rounded-xl transition-all p-3 w-32 border-2 outline-none ring-0",
              editorTheme === t.value
                ? "border-primary ring-2 ring-primary shadow-lg"
                : "border-muted hover:border-primary/60"
            )}
            style={{
              background: isDark
                ? t.colors.dark["--background"]
                : t.colors.light["--background"],
            }}
          >
            <EditorColorCardSkeleton
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
                "block mt-3 text-sm font-medium text-center",
                editorTheme === t.value
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
              style={{
                color:
                  editorTheme === t.value
                    ? isDark
                      ? t.colors.dark["--primary"]
                      : t.colors.light["--primary"]
                    : undefined,
              }}
            >
              {t.name}
            </span>
            {editorTheme === t.value && (
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
