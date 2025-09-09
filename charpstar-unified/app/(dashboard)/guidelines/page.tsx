"use client";

import { useUser } from "@/contexts/useUser";
import { useRouter } from "next/navigation";
import { useLoading } from "@/contexts/LoadingContext";
import Image from "next/image";

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
  FileText,
  ArrowLeft,
  Award,
  Users,
  Download,
  Globe,
  Settings,
  Palette,
  Monitor,
  AlertTriangle,
  Info,
  ExternalLink,
  Star,
} from "lucide-react";

interface GuidelineSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  priority: "high" | "medium" | "low";
  content: React.ReactNode;
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
      id: "team-structure",
      title: "Team Structure",
      description: "Meet the Charpstar leadership and production team",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      priority: "high",
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-blue-800">Leadership</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">CEO:</span> Emil
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">CTO:</span> Arjun
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-blue-800">
                Production Management
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Production Manager:</span>{" "}
                  Victor
                </div>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">
                    Asst. Production Manager:
                  </span>{" "}
                  Roney
                </div>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Team Lead:</span> Karthik
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-blue-800">3D Art Team</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Lead 3D Artist:</span> Richard
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">
                    Senior 3D Artist India:
                  </span>{" "}
                  Onkar
                  <Badge variant="outline" className="text-xs">
                    10am-2pm IST Doubt Meetings
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">
                    Senior 3D Artist Brazil:
                  </span>{" "}
                  Fernando
                  <Badge variant="outline" className="text-xs">
                    10am-2pm BRT Doubt Meetings
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-blue-800">
                Quality & Coordination
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Quality Controllers:</span>{" "}
                  Rafi, Urvee, Janeeta, Ashish
                  <Badge variant="outline" className="text-xs">
                    9am-5pm IST
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">3D Coordinator:</span> Shreyas
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800">
                Learn More About Charpstar
              </span>
            </div>
            <a
              href="https://www.charpstar.co/about-us"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Visit our About Us page →
            </a>
          </div>
        </div>
      ),
    },
    {
      id: "software-requirements",
      title: "Software Requirements",
      description:
        "Recommended software for 3D modeling, texturing, and export",
      icon: Monitor,
      color: "text-green-600",
      bgColor: "bg-green-50",
      priority: "high",
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-green-800">
                Modeling Software
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Maya</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Blender</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Zbrush</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>3DsMax</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-green-800">
                Texturing Software
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Photoshop</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Krita</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Substance Painter</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Substance Designer</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-green-800">GLB Export</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-green-600" />
                  <span className="font-medium">
                    Blender (Mostly Preferred)
                  </span>
                </div>
                <p className="text-sm text-green-700">
                  Inbuilt Addon, no extra plugin needed
                </p>

                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Maya (Plugin needed)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800">
                Software to use with caution for GLB Export
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-amber-800 mb-2">Pros</h5>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li>Effective for color testing</li>
                  <li>Provides advanced color management tools</li>
                  <li>Fast export and iteration workflow</li>
                  <li>
                    Supports direct hex color transfer from Substance Painter to
                    Blender
                  </li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-amber-800 mb-2">Cons</h5>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  <li>
                    File size is too big because this software uses PNG as a
                    default file format
                  </li>
                  <li>Needs extra optimization: change all textures to JPEG</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "general-rules",
      title: "General Rules for 3D Models",
      description: "Essential technical requirements and limitations",
      icon: Settings,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      priority: "high",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-purple-800">
                Technical Limits
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>Polycount:</strong> Under 150K
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>Material Count:</strong> Maximum 5
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>Mesh Count:</strong> Maximum 5
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>File Size (GLB):</strong> 15MB or Less
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-purple-800">
                Material Settings
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>Double Sided:</strong> OFF for Each Material
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>Tileable Texture:</strong> Use when possible
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                  <span>
                    <strong>Transformations:</strong> Make sure the mesh has
                    clean transforms (position, rotation, and scale applied).
                  </span>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-purple-200 bg-white p-3 dark:bg-neutral-900 dark:border-purple-900/40">
                <p className="text-xs text-muted-foreground mb-2">
                  Example (Blender): Backface Culling enabled and Double Sided
                  OFF
                </p>
                <Image
                  src="/images/GUIDE.png"
                  alt="Blender material settings illustrating backface culling and double sided off"
                  width={454}
                  height={266}
                  className="rounded-md border border-border/50"
                />
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-purple-800">
                Important Notes
              </span>
            </div>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>
                • Never parent the mesh and never group the mesh in multiple
                folders
              </li>
              <li>
                • Never combine the mesh to 2 or 3 materials - one material, one
                mesh
              </li>
              <li>• Use separate UV sets for different texture types</li>
              <li>
                • Always use Weighted Normal and click &quot;Keep Sharp&quot;
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "texturing-methods",
      title: "Texturing Methods",
      description: "Understanding tileable vs PBR texturing approaches",
      icon: Palette,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      priority: "medium",
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-amber-800">
                Tileable Texturing (Seamless)
              </h4>
              <div className="space-y-3">
                <div className="bg-white p-3 rounded border border-amber-200">
                  <h5 className="font-medium text-amber-800 mb-2">
                    Why Use This Method?
                  </h5>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>
                      • Achieve realistic results without blur and distortions
                    </li>
                    <li>• Easy to edit textures</li>
                    <li>• Easy to scale UVs without texture loss</li>
                    <li>• 0 to 1 UV ratio can be ignored</li>
                  </ul>
                </div>

                <div className="bg-white p-3 rounded border border-amber-200">
                  <h5 className="font-medium text-amber-800 mb-2">Best For:</h5>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• Fabric</li>
                    <li>• Wood</li>
                    <li>• Metal</li>
                    <li>• Patterns</li>
                    <li>• Plastic</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-amber-800">
                PBR (Physical Based Rendering)
              </h4>
              <div className="space-y-3">
                <div className="bg-white p-3 rounded border border-amber-200">
                  <h5 className="font-medium text-amber-800 mb-2">
                    Why Use This Method?
                  </h5>
                  <p className="text-sm text-amber-700">
                    Ensures physical accuracy and is well-suited for highly
                    detailed areas.
                  </p>
                </div>

                <div className="bg-white p-3 rounded border border-amber-200">
                  <h5 className="font-medium text-amber-800 mb-2">
                    Limitations
                  </h5>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    <li>0 to 1 ratio UV mapping must be maintained</li>
                    <li>Can&apos;t scale UVs</li>
                    <li>Texture blur and distortions</li>
                    <li>Big file sizes</li>
                    <li>Texture details lost after GLB export</li>
                  </ul>
                </div>

                <div className="bg-white p-3 rounded border border-amber-200">
                  <h5 className="font-medium text-amber-800 mb-2">Best For</h5>
                  <p className="text-sm text-amber-700">
                    Highly detailed areas where replicating the detail with
                    tileables would be extremely difficult. Even where possible,
                    it could require an excessive number of materials.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800">
                Texture Organization
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-amber-700">
              <div>
                <h5 className="font-medium mb-2">Tileable Texture Naming:</h5>
                <ul className="space-y-1">
                  <li>• 1_Wood_BaseColor_Seamless</li>
                  <li>• 1_Wood_Roughness_Seamless</li>
                  <li>• 1_Wood_Metallic_Seamless</li>
                  <li>• 1_Wood_Normal_Seamless</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium mb-2">PBR Texture Naming:</h5>
                <ul className="space-y-1">
                  <li>• 1_Bike_Frame_BaseColor_PBR</li>
                  <li>• 1_Bike_Frame_Roughness_PBR</li>
                  <li>• 1_Bike_Frame_Metallic_PBR</li>
                  <li>• 1_Bike_Frame_Normal_PBR</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "texture-requirements",
      title: "Texture Requirements",
      description: "Texture format, size, and quality specifications",
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      priority: "high",
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-indigo-800">
                Texture Maps for Tileable
              </h4>
              <div className="space-y-3">
                <div className="bg-white p-3 rounded border border-indigo-200">
                  <h5 className="font-medium text-indigo-800 mb-2">
                    Required Maps:
                  </h5>
                  <ul className="text-sm text-indigo-700 space-y-1">
                    <li>
                      • <strong>Base Color:</strong> Solid color map or fabric,
                      wood, metal
                    </li>
                    <li>
                      • <strong>Normal Map:</strong> If needed
                    </li>
                    <li>
                      • <strong>Roughness Map:</strong> Grayscale
                    </li>
                    <li>
                      • <strong>Metallic Map:</strong> Grayscale
                    </li>
                    <li>
                      • <strong>Alpha:</strong> When needed
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-indigo-800">
                Texture Specifications
              </h4>
              <div className="space-y-3">
                <div className="bg-white p-3 rounded border border-indigo-200">
                  <h5 className="font-medium text-indigo-800 mb-2">
                    Size Requirements:
                  </h5>
                  <ul className="text-sm text-indigo-700 space-y-1">
                    <li>
                      • <strong>Base Map:</strong> 2048×2048
                    </li>
                    <li>
                      • <strong>Roughness/Metallic:</strong> 1024×1024
                    </li>
                    <li>
                      • <strong>Normal Map:</strong> 2048×2048
                    </li>
                    <li>
                      • <strong>Ambient Occlusion:</strong> 1024×1024
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">What TO Do</span>
              </div>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Use JPEG for BaseColor, Roughness, Metallic, AO</li>
                <li>• Use PNG only for Normal Map when QA requests</li>
                <li>• Keep textures under 1MB (Normal Map max 1.5MB)</li>
                <li>• Use grayscale for Roughness and Metallic maps</li>
                <li>• Create seamless textures</li>
              </ul>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-800">What NOT To Do</span>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Never merge AO to Base Map</li>
                <li>• Never merge Roughness, Metallic, and AO (ORM)</li>
                <li>• Never make normal map brighter</li>
                <li>• Don&apos;t use PNG unless QA specifically requests</li>
                <li>• Avoid multiple colors in Roughness/Metallic maps</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "quality-checking",
      title: "Quality Checking Tools",
      description: "How to check your models before sending to QA",
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      priority: "high",
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-emerald-800">3D Tester Tools</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded border border-emerald-200">
                <h5 className="font-medium text-emerald-800 mb-2">
                  General Models
                </h5>
                <div className="space-y-2">
                  <a
                    href="https://charpstar.se/3DTester-V5/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-emerald-600 hover:text-emerald-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>V5 Tester</span>
                  </a>
                  <a
                    href="https://charpstar.se/3DTester-V2/QA.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-emerald-600 hover:text-emerald-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>V2 Tester</span>
                  </a>
                  <a
                    href="https://charpstar.se/3DTester-V4/QA.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-emerald-600 hover:text-emerald-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>V4 Tester</span>
                  </a>
                </div>
              </div>

              <div className="bg-white p-4 rounded border border-emerald-200">
                <h5 className="font-medium text-emerald-800 mb-2">
                  Glass Models
                </h5>
                <div className="space-y-2">
                  <a
                    href="https://charpstar.se/3DTester"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-emerald-600 hover:text-emerald-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>3D Tester</span>
                  </a>
                  <a
                    href="https://charpstar.se/3DTester/WhiteTester.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-emerald-600 hover:text-emerald-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>White Tester</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-emerald-800">Pre-QA Checklist</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded border border-emerald-200">
                <h5 className="font-medium text-emerald-800 mb-2">
                  In Blender
                </h5>
                <ul className="text-sm text-emerald-700 space-y-1">
                  <li>• Click on overlays and turn ON Statistics</li>
                  <li>• Check polycount</li>
                  <li>• Verify mesh count (should be 5 or less)</li>
                  <li>• Check material count (should be 5 or less)</li>
                </ul>
              </div>

              <div className="bg-white p-4 rounded border border-emerald-200">
                <h5 className="font-medium text-emerald-800 mb-2">
                  Without Blender
                </h5>
                <ul className="text-sm text-emerald-700 space-y-1">
                  <li>• Use Microsoft 3D Viewer</li>
                  <li>• Check polycount of GLB file</li>
                  <li>• Verify file size (15MB or less)</li>
                  <li>• Test in 3D Tester tools</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-emerald-800">
                Key Points to Remember
              </span>
            </div>
            <ul className="text-sm text-emerald-700 space-y-1">
              <li>
                • <strong>Mesh = Objects:</strong> Number of objects in the file
              </li>
              <li>
                • <strong>Materials:</strong> Number of materials used
              </li>
              <li>
                • <strong>Rule:</strong> If there are 5 materials, there should
                be 5 meshes (vice versa)
              </li>
              <li>
                • <strong>Never:</strong> Parent meshes or group them in
                multiple folders
              </li>
              <li>
                • <strong>Always:</strong> One material per mesh
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "uv-mapping",
      title: "UV Mapping & Ambient Occlusion",
      description: "Creating proper UV sets and AO maps for GLB files",
      icon: Settings,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      priority: "medium",
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-cyan-800">UV Sets Explanation</h4>
            <div className="bg-white p-4 rounded border border-cyan-200">
              <p className="text-sm text-cyan-700 mb-3">
                UVSet is also known as UVMaps where our UVs are created for the
                texturing process. Normally we use 0 to 1 ratio for PBR
                textures, but for seamless textures we need 2 UV sets.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-cyan-800 mb-2">
                    UVMap (Primary)
                  </h5>
                  <ul className="text-sm text-cyan-700 space-y-1">
                    <li>• Use for Base Color</li>
                    <li>• Use for Roughness</li>
                    <li>• Use for Metallic</li>
                    <li>• Use for Normal Map</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-cyan-800 mb-2">
                    UVMap.001 (Secondary)
                  </h5>
                  <ul className="text-sm text-cyan-700 space-y-1">
                    <li>• Only for Ambient Occlusion</li>
                    <li>• Separate from main textures</li>
                    <li>• Allows AO without affecting seamless textures</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-cyan-800">
              Creating Ambient Occlusion
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded border border-cyan-200">
                <h5 className="font-medium text-cyan-800 mb-2">
                  Recommended Software
                </h5>
                <ul className="text-sm text-cyan-700 space-y-1">
                  <li>
                    • <strong>Substance Painter:</strong> Best for creating AO
                    maps
                  </li>
                  <li>
                    • <strong>Blender:</strong> Can be used (ensure no noise)
                  </li>
                  <li>
                    • <strong>Marmoset Toolbag:</strong> Good for baking
                    textures
                  </li>
                  <li>
                    • <strong>XNormals:</strong> Alternative for baking
                  </li>
                </ul>
              </div>

              <div className="bg-white p-4 rounded border border-cyan-200">
                <h5 className="font-medium text-cyan-800 mb-2">
                  Node Setup in Blender
                </h5>
                <ul className="text-sm text-cyan-700 space-y-1">
                  <li>• Connect nodes for Ambient Occlusion</li>
                  <li>• Use separate UVMap.001 for AO</li>
                  <li>• Ensure no noise in the AO map</li>
                  <li>• Keep AO map at 1024×1024 resolution</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-cyan-600" />
              <span className="font-medium text-cyan-800">
                Why Two UV Sets?
              </span>
            </div>
            <p className="text-sm text-cyan-700">
              We can&apos;t use Ambient Occlusion with seamless textures in the
              same UV set. By using two UV sets, we can have both seamless
              textures and proper AO maps without conflicts or quality loss.
            </p>
          </div>
          <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-cyan-600" />
              <span className="font-medium text-cyan-800">
                UV Mapping Best Practices
              </span>
            </div>
            <p className="text-sm text-cyan-700">
              Always unwrap the UVs, even if it is a metallic object, and
              organize them in an optimized way.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "export-optimization",
      title: "Export & Optimization",
      description: "Best practices for GLB export and file optimization",
      icon: Download,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      priority: "medium",
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-orange-800">
              GLB Export Best Practices
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded border border-orange-200">
                <h5 className="font-medium text-orange-800 mb-2">
                  Blender (Recommended)
                </h5>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Use inbuilt GLB addon</li>
                  <li>• No extra plugins needed</li>
                  <li>• Better optimization</li>
                  <li>• Maintains texture quality</li>
                </ul>
              </div>

              <div className="bg-white p-4 rounded border border-orange-200">
                <h5 className="font-medium text-orange-800 mb-2">Maya</h5>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Plugin required</li>
                  <li>• May create parented meshes</li>
                  <li>• Check for unnecessary folders</li>
                  <li>• Verify mesh/material count</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-orange-800">File Organization</h4>
            <div className="bg-white p-4 rounded border border-orange-200">
              <h5 className="font-medium text-orange-800 mb-2">
                Upload Structure
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h6 className="font-medium text-orange-700 mb-2">
                    Publish Folder (For QA)
                  </h6>
                  <ul className="text-sm text-orange-600 space-y-1">
                    <li>• GLB file</li>
                    <li>• Once models are approved</li>
                  </ul>
                </div>
                <div>
                  <h6 className="font-medium text-orange-700 mb-2">
                    Assets Folder
                  </h6>
                  <ul className="text-sm text-orange-600 space-y-1">
                    <li>• OBJ files</li>
                    <li>• FBX files</li>
                    <li>• GLB files</li>
                    <li>• All texture maps</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-orange-800">
                Common Export Issues
              </span>
            </div>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>
                • <strong>Parented Meshes:</strong> Happens with Maya FBX/OBJ
                export
              </li>
              <li>
                • <strong>Multiple Folders:</strong> Creates unnecessary
                complexity
              </li>
              <li>
                • <strong>Material Merging:</strong> Avoid combining multiple
                materials
              </li>
              <li>
                • <strong>File Size:</strong> Ensure GLB is under 15MB
              </li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

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

      {/* Page Title */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-foreground">
          Charpstar&apos;s Welcome Guide
        </h1>
        <p className="text-xl text-muted-foreground">For New 3D Modelers</p>
      </div>

      {/* Guidelines Sections */}
      <div className="space-y-8">
        {guidelines.map((section) => (
          <Card key={section.id} className="overflow-hidden w-full">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-12 w-12 rounded-lg ${section.bgColor} flex items-center justify-center`}
                  >
                    <section.icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{section.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    section.priority === "high"
                      ? "border-red-200 text-red-700 bg-red-50"
                      : section.priority === "medium"
                        ? "border-yellow-200 text-yellow-700 bg-yellow-50"
                        : "border-green-200 text-green-700 bg-green-50"
                  }`}
                >
                  {section.priority.charAt(0).toUpperCase() +
                    section.priority.slice(1)}{" "}
                  Priority
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-6">{section.content}</CardContent>
          </Card>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t">
        <p className="text-muted-foreground mb-2">Have any questions?</p>
        <p className="text-sm text-muted-foreground">
          Reach out to your team lead or use the doubt meeting times listed
          above
        </p>
      </div>
    </div>
  );
}
