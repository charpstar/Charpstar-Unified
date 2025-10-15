import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// Card skeleton preview for a theme
function CardSkeleton({ variant }: { variant: "light" | "dark" }) {
  return (
    <div
      className={cn(
        "w-full h-20 rounded-lg p-3 flex flex-col gap-2",
        variant === "light"
          ? "bg-[#E5E7EB] border border-[#e5e7eb]" // Tailwind's gray-200
          : "bg-[#181F2A] border border-[#232A3A]"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "rounded-full",
            "h-3 w-3",
            variant === "light" ? "bg-[#D1D5DB]" : "bg-[#374151]" // gray-300 or gray-700
          )}
        />
        <div
          className={cn(
            "rounded h-2 w-3/5",
            variant === "light" ? "bg-[#D1D5DB]" : "bg-[#374151]"
          )}
        />
      </div>
      <div
        className={cn(
          "rounded h-2 w-full",
          variant === "light" ? "bg-[#D1D5DB]" : "bg-[#374151]"
        )}
      />
      <div
        className={cn(
          "rounded h-2 w-4/5",
          variant === "light" ? "bg-[#D1D5DB]" : "bg-[#374151]"
        )}
      />
    </div>
  );
}

const themes = [
  {
    value: "light",
    label: "Light",
    preview: <CardSkeleton variant="light" />,
    className: "bg-background border",
  },
  {
    value: "dark",
    label: "Dark",
    preview: <CardSkeleton variant="dark" />,
    className: "bg-[#181F2A] border",
  },
];

export function ThemeSwitcherCard() {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  return (
    <div className=" rounded-lg p-6">
      <div className="text-base font-medium text-foreground">Theme</div>
      <div className="text-sm text-muted-foreground mb-4">
        Select the theme for the dashboard.
      </div>
      <div className="flex gap-8 pl-2">
        {themes.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={theme === t.value}
            onClick={() => handleThemeChange(t.value)}
            className={cn(
              "relative flex flex-col items-center justify-between rounded-xl transition-all p-3 w-36 border-2 outline-none ring-0 cursor-pointer",
              t.className,
              theme === t.value
                ? "border-primary ring-2 ring-primary shadow-lg"
                : "border-muted hover:border-primary/60"
            )}
          >
            {t.preview}
            <span
              className={cn(
                "block mt-3 text-sm font-medium",
                theme === t.value ? "text-primary" : "text-muted-foreground"
              )}
            >
              {t.label}
            </span>
            {theme === t.value && (
              <span className="absolute top-2 right-2 inline-block w-3 h-3 rounded-full bg-primary shadow-md" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
