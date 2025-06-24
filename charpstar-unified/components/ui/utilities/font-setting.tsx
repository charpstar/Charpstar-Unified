import { useEffect, useState } from "react";
import { Label } from "@/components/ui/display";
import { RadioGroup, RadioGroupItem } from "@/components/ui/inputs";

const FONT_OPTIONS = [
  { label: "Sans", value: "sans", className: "font-sans" },
  { label: "Serif", value: "serif", className: "font-serif" },
  { label: "Mono", value: "mono", className: "font-mono" },
];

export function FontSettings() {
  // Get initial from localStorage or default
  const [fontType, setFontType] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("font-type") || "sans"
      : "sans"
  );

  // Set CSS variables on body
  useEffect(() => {
    document.body.style.setProperty(
      "--user-font-family",
      getFontFamily(fontType)
    );
  }, [fontType]);

  function getFontFamily(type: string) {
    if (type === "sans") return "Inter, system-ui, sans-serif";
    if (type === "serif")
      return "ui-serif, Georgia, Cambria, Times New Roman, Times, serif";
    if (type === "mono")
      return "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    return "Inter, system-ui, sans-serif";
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Font Type */}
      <div>
        <Label className="mb-2 block text-muted-foreground">Font Type</Label>
        <RadioGroup
          value={fontType}
          onValueChange={(v) => setFontType(v)}
          className="flex gap-6"
        >
          {FONT_OPTIONS.map((opt) => (
            <Label
              key={opt.value}
              className={`flex items-center gap-2 cursor-pointer ${opt.className}`}
            >
              <RadioGroupItem value={opt.value} />
              {opt.label}
            </Label>
          ))}
        </RadioGroup>
      </div>
      {/* Font Size */}
      {/* <div>
        <Label className="mb-2 block text-muted-foreground">
          Font Size ({fontSize}px)
        </Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[fontSize]}
            onValueChange={([v]) => setFontSize(v)}
            min={FONT_SIZES.min}
            max={FONT_SIZES.max}
            step={FONT_SIZES.step}
            className="max-w-xs"
          />
          <span className="w-10 text-center text-foreground">{fontSize}px</span>
        </div>
      </div> */}
    </div>
  );
}
