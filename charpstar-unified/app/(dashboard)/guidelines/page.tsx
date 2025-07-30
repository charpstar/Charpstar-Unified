"use client";

import { useUser } from "@/contexts/useUser";
import { useRouter } from "next/navigation";
import { useLoading } from "@/contexts/LoadingContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import {
  Building,
  CheckCircle,
  Clock,
  FileText,
  Download,
  ExternalLink,
  ArrowLeft,
  Star,
  Target,
  Award,
  Users,
  Settings,
  BookOpen,
  Video,
  HelpCircle,
} from "lucide-react";

interface GuidelineSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  items: string[];
  priority: "high" | "medium" | "low";
}

export default function GuidelinesPage() {
  const user = useUser();
  const router = useRouter();
  const { startLoading } = useLoading();

  // Check if user is modeler or QA
  if (user?.metadata?.role !== "modeler" && user?.metadata?.role !== "qa") {
    startLoading();
    router.push("/dashboard");
    return null;
  }

  const guidelines: GuidelineSection[] = [
    {
      id: "quality-standards",
      title: "Quality Standards",
      description: "Essential requirements for all 3D models",
      icon: Award,
      color: "text-success",
      bgColor: "bg-success-muted",
      priority: "high",
      items: [
        "All models must be optimized for real-time rendering",
        "Polygon count should not exceed 10,000 for furniture items",
        "Textures must be power-of-2 dimensions (512x512, 1024x1024, etc.)",
        "Models must be properly centered at origin (0,0,0)",
        "All materials should use PBR workflow",
      ],
    },
    {
      id: "file-requirements",
      title: "File Requirements",
      description: "Technical specifications for file submissions",
      icon: FileText,
      color: "text-info",
      bgColor: "bg-info-muted",
      priority: "high",
      items: [
        "Submit models in GLB format only",
        "Maximum file size: 50MB per model",
        "Include all textures embedded in the GLB file",
        "Use descriptive file names: ClientName_ProductName.glb",
        "Provide preview images in JPG format (1024x1024)",
      ],
    },
    {
      id: "modeling-standards",
      title: "Modeling Standards",
      description: "Best practices for 3D modeling",
      icon: Building,
      color: "text-accent-purple",
      bgColor: "bg-accent-purple/10",
      priority: "medium",
      items: [
        "Use proper topology with clean edge flow",
        "Maintain consistent scale across all models",
        "Keep models watertight (no holes or gaps)",
        "Use quads where possible, avoid n-gons",
        "Optimize geometry for target platform",
      ],
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-error-muted text-error border-error/20";
      case "medium":
        return "bg-warning-muted text-warning border-warning/20";
      case "low":
        return "bg-success-muted text-success border-success/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Building className="h-3 w-3" />
            {user?.metadata?.role === "qa" ? "QA" : "3D Modeler"}
          </Badge>
        </div>
      </div>

      {/* Guidelines Sections */}
      <div className="grid grid-cols-1 gap-6">
        {guidelines.map((section) => (
          <Card key={section.id} className="overflow-hidden w-full">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-lg ${section.bgColor} flex items-center justify-center`}
                  >
                    <section.icon className={`h-5 w-5 ${section.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs ${getPriorityColor(section.priority)}`}
                >
                  {section.priority.charAt(0).toUpperCase() +
                    section.priority.slice(1)}{" "}
                  Priority
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {section.items.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
