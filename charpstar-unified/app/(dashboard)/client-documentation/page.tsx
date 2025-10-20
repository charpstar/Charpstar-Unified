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
  ArrowLeft,
  Code,
  Globe,
  Settings,
  Eye,
  Monitor,
  Info,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";

export default function ClientDocumentationPage() {
  const user = useUser();
  const router = useRouter();
  const { startLoading } = useLoading();
  const [copied, setCopied] = useState<string | null>(null);

  // Check if user is client
  if (user?.metadata?.role !== "client") {
    startLoading();
    router.push("/dashboard");
    return null;
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const scriptSnippet = `<script src="https://js.charpstar.net/Placeholder/charpstAR-Placeholder.js" defer></script>`;

  const containerSnippet = `<charpstar-container data-articleid="1234" data-language="sv-se" data-position="top-right" style="display: none">
  <button data-tech="charpstar-ar"> Visa i AR </button>
  <button data-tech="charpstar-3d"> Visa i 3D </button>
</charpstar-container>`;

  const documentationSections = [
    {
      id: "overview",
      title: "WebAR and 3D Viewer Integration Helper",
      description:
        "Complete guide for integrating CharpstAR services into your product pages",
      icon: Globe,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      content: (
        <div className="space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-info/10 via-info/5 to-transparent rounded-2xl blur-sm"></div>
            <div className="relative bg-info-muted/30 backdrop-blur-sm p-8 rounded-2xl border border-info/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-info/20 shadow-sm">
                  <Info className="h-6 w-6 text-info" />
                </div>
                <h3 className="font-semibold text-foreground text-lg">
                  Integration Overview
                </h3>
              </div>
              <div className="space-y-6">
                <p className="text-foreground/90 text-base leading-relaxed">
                  The CharpstAR script automatically detects device and browser
                  support for our AR and 3D services. This means you can add the
                  integration code to all your product pages, regardless of
                  whether they&apos;re currently ready for 3D/AR viewing.
                </p>
                <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl border border-border/40 shadow-sm">
                  <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-info"></div>
                    How it works:
                  </h4>
                  <ul className="space-y-3">
                    {[
                      "The script checks headers associated with our AR files using a Fetch() request",
                      "It automatically toggles visibility of the &apos;charpstar-container&apos; element based on device support",
                      "Buttons appear only when your products are ready in 3D/AR and the device supports it",
                      "Best for quick integration across all product pages",
                    ].map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-muted-foreground"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-info mt-2 flex-shrink-0"></div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "script-integration",
      title: "Step 1: Include the CharpstAR Script",
      description: "Add the CharpstAR script to your product pages",
      icon: Code,
      color: "text-green-600",
      bgColor: "bg-green-50",
      content: (
        <div className="space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-success/10 via-success/5 to-transparent rounded-2xl blur-sm"></div>
            <div className="relative bg-success-muted/30 backdrop-blur-sm p-6 rounded-2xl border border-success/20 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-success/20 shadow-sm">
                  <Code className="h-5 w-5 text-success" />
                </div>
                <span className="font-semibold text-foreground text-lg">
                  Script to Include
                </span>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Include this script anywhere in your product page. Add it to the
                &lt;head&gt; section or before the closing &lt;body&gt; tag.
              </p>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-success/20 to-transparent rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <pre className="relative bg-card/90 backdrop-blur-sm text-success border border-success/30 p-4 rounded-xl overflow-x-auto text-sm shadow-lg">
                  <code className="font-mono">{scriptSnippet}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(scriptSnippet, "script")}
                  className="absolute top-3 right-3 h-8 w-8 p-0 bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {copied === "script" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground hover:text-success transition-colors" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300">
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success"></div>
              Important Notes:
            </h4>
            <ul className="space-y-3">
              {[
                {
                  key: "Defer attribute",
                  value:
                    'The script uses the "defer" attribute for optimal loading performance',
                },
                {
                  key: "Placement",
                  value:
                    "Can be included on all product pages regardless of current 3D/AR readiness",
                },
                {
                  key: "Automatic detection",
                  value:
                    "The script handles device and browser compatibility automatically",
                },
              ].map((note, idx) => (
                <li key={idx} className="flex flex-col gap-1">
                  <span className="font-medium text-foreground text-sm">
                    {note.key}:
                  </span>
                  <span className="text-muted-foreground text-sm ml-4">
                    {note.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "container-setup",
      title: "Step 2: Add the AR and 3D Button Container",
      description:
        "Add the container element that holds the 3D Viewer and AR buttons",
      icon: Monitor,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      content: (
        <div className="space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/10 via-accent-purple/5 to-transparent rounded-2xl blur-sm"></div>
            <div className="relative bg-accent-purple/10 backdrop-blur-sm p-6 rounded-2xl border border-accent-purple/20 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-accent-purple/20 shadow-sm">
                  <Monitor className="h-5 w-5 text-accent-purple" />
                </div>
                <span className="font-semibold text-foreground text-lg">
                  Container Code
                </span>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Add this container element to your product page. The optimal
                position is within your main product image element so the
                buttons automatically position themselves.
              </p>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-accent-purple/20 to-transparent rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <pre className="relative bg-card/90 backdrop-blur-sm text-accent-purple border border-accent-purple/30 p-4 rounded-xl overflow-x-auto text-sm shadow-lg">
                  <code className="font-mono">{containerSnippet}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(containerSnippet, "container")}
                  className="absolute top-3 right-3 h-8 w-8 p-0 bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {copied === "container" ? (
                    <Check className="h-4 w-4 text-accent-purple" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground hover:text-accent-purple transition-colors" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 group">
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-purple"></div>
                Button Elements
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-purple/5 border border-accent-purple/10">
                  <code className="bg-accent-purple/10 text-accent-purple px-3 py-1 rounded-md text-xs font-mono border border-accent-purple/20">
                    data-tech=&quot;charpstar-ar&quot;
                  </code>
                  <span className="text-sm text-muted-foreground">
                    AR View Button
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-purple/5 border border-accent-purple/10">
                  <code className="bg-accent-purple/10 text-accent-purple px-3 py-1 rounded-md text-xs font-mono border border-accent-purple/20">
                    data-tech=&quot;charpstar-3d&quot;
                  </code>
                  <span className="text-sm text-muted-foreground">
                    3D View Button
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 group">
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-purple"></div>
                Automatic Positioning
              </h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The container automatically positions itself relative to your
                main product image element. Buttons will appear in the corner
                specified by the{" "}
                <code className="bg-accent-purple/10 text-accent-purple px-2 py-1 rounded text-xs font-mono border border-accent-purple/20">
                  data-position
                </code>{" "}
                attribute.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "attributes",
      title: "Step 3: Custom Attributes Configuration",
      description: "Configure the custom attributes for your integration",
      icon: Settings,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      content: (
        <div className="space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/10 via-accent-orange/5 to-transparent rounded-2xl blur-sm"></div>
            <div className="relative bg-accent-orange/10 backdrop-blur-sm p-6 rounded-2xl border border-accent-orange/20 shadow-lg">
              <h4 className="font-semibold text-foreground mb-6 flex items-center gap-2">
                <div className="p-2 rounded-lg bg-accent-orange/20 shadow-sm">
                  <Settings className="h-5 w-5 text-accent-orange" />
                </div>
                Required Attributes
              </h4>
              <div className="space-y-4">
                {/* data-articleid */}
                <div className="bg-card/40 backdrop-blur-sm p-5 rounded-xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-start gap-3 mb-3">
                    <Badge className="bg-error text-error-foreground text-xs shadow-sm">
                      Required
                    </Badge>
                    <code className="bg-accent-orange/10 text-accent-orange px-3 py-1 rounded-md text-sm font-mono border border-accent-orange/20">
                      data-articleid
                    </code>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3 leading-relaxed">
                    <span className="font-medium text-foreground">
                      Purpose:
                    </span>{" "}
                    Contains the Placeholder SKU ID number for the product on
                    the page
                  </p>
                  <div className="bg-card/60 border border-border/30 p-3 rounded-lg">
                    <code className="text-accent-orange text-sm font-mono">
                      data-articleid=&quot;1234&quot;
                    </code>
                  </div>
                </div>

                {/* data-language */}
                <div className="bg-card/40 backdrop-blur-sm p-5 rounded-xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-start gap-3 mb-3">
                    <Badge className="bg-error text-error-foreground text-xs shadow-sm">
                      Required
                    </Badge>
                    <code className="bg-accent-orange/10 text-accent-orange px-3 py-1 rounded-md text-sm font-mono border border-accent-orange/20">
                      data-language
                    </code>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3 leading-relaxed">
                    <span className="font-medium text-foreground">
                      Purpose:
                    </span>{" "}
                    Controls the display language for the QR popup
                  </p>
                  <div className="space-y-3">
                    <div className="bg-card/60 border border-border/30 p-3 rounded-lg">
                      <code className="text-accent-orange text-sm font-mono">
                        data-language=&quot;sv-se&quot; // Swedish
                      </code>
                    </div>
                    <div className="text-xs text-muted-foreground bg-accent-orange/5 p-3 rounded-lg border border-accent-orange/10">
                      <span className="font-medium text-foreground">
                        Supported languages:
                      </span>{" "}
                      &quot;en-gb&quot;, &quot;en-us&quot;, &quot;sv-se&quot;,
                      &quot;no-no&quot;, &quot;da-dk&quot;, &quot;de-at&quot;,
                      &quot;de-de&quot;, &quot;lv-lv&quot;, &quot;cs-cz&quot;,
                      &quot;pl-pl&quot;, &quot;sk-sk&quot;, &quot;et-ee&quot;,
                      &quot;fi-fi&quot;, &quot;lt-lt&quot;, &quot;es&quot;
                    </div>
                  </div>
                </div>

                {/* data-position */}
                <div className="bg-card/40 backdrop-blur-sm p-5 rounded-xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-start gap-3 mb-3">
                    <Badge className="bg-info text-info-foreground text-xs shadow-sm">
                      Optional
                    </Badge>
                    <code className="bg-accent-orange/10 text-accent-orange px-3 py-1 rounded-md text-sm font-mono border border-accent-orange/20">
                      data-position
                    </code>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3 leading-relaxed">
                    <span className="font-medium text-foreground">
                      Purpose:
                    </span>{" "}
                    Controls button positioning within the container
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        "top-left",
                        "top-right",
                        "bottom-left",
                        "bottom-right",
                      ].map((pos) => (
                        <div
                          key={pos}
                          className="bg-card/60 border border-border/30 p-2 rounded-lg text-center"
                        >
                          <code className="text-accent-orange text-xs font-mono">
                            &quot;{pos}&quot;
                          </code>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground bg-info/5 p-3 rounded-lg border border-info/10">
                      <span className="font-medium text-foreground">
                        Default:
                      </span>{" "}
                      &quot;top-right&quot; if not specified
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-accent-orange/20 shadow-sm">
                <Info className="h-5 w-5 text-accent-orange" />
              </div>
              <span className="font-semibold text-foreground">
                Implementation Tips
              </span>
            </div>
            <ul className="space-y-3">
              {[
                {
                  text: "Replace &quot;1234&quot; with your actual product SKU ID from Charpstar",
                  highlight: "1234",
                },
                {
                  text: "Choose the appropriate language code that matches your target market",
                },
                {
                  text: "Position the container within your main product image element for optimal button placement",
                },
                {
                  text: "The style=&quot;display: none&quot; will be automatically overridden by the script when the product is ready",
                  highlight: "style=&quot;display: none&quot;",
                },
              ].map((tip, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-muted-foreground text-sm"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-orange mt-2 flex-shrink-0"></div>
                  <span>
                    {tip.highlight ? (
                      <>
                        {tip.text.split(tip.highlight)[0]}
                        <code className="bg-accent-orange/10 text-accent-orange px-1 rounded text-xs font-mono border border-accent-orange/20">
                          {tip.highlight}
                        </code>
                        {tip.text.split(tip.highlight)[1]}
                      </>
                    ) : (
                      tip.text
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "custom-integration",
      title: "Custom Integration Support",
      description: "Need more customized integration? We're here to help",
      icon: ExternalLink,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      content: (
        <div className="space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/10 via-accent-blue/5 to-transparent rounded-2xl blur-sm"></div>
            <div className="relative bg-accent-blue/10 backdrop-blur-sm p-8 rounded-2xl border border-accent-blue/20 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-accent-blue/20 shadow-sm">
                  <ExternalLink className="h-6 w-6 text-accent-blue" />
                </div>
                <h3 className="font-semibold text-foreground text-lg">
                  Need Custom Integration?
                </h3>
              </div>
              <div className="space-y-6">
                <p className="text-foreground/90 text-base leading-relaxed">
                  If you need more customized integration beyond the standard
                  implementation, we&apos;re here to assist you with extended
                  functionality.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 group">
                    <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent-blue"></div>
                      Custom Use Cases:
                    </h4>
                    <ul className="space-y-3">
                      {[
                        "3D Viewer as part of product image gallery",
                        "Custom button styling and positioning",
                        "Advanced AR scene configuration",
                        "Integration with existing e-commerce platforms",
                        "Custom analytics and tracking",
                      ].map((useCase, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-3 text-muted-foreground text-sm"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-blue mt-2 flex-shrink-0"></div>
                          <span>{useCase}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300 group">
                    <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent-blue"></div>
                      How to Get Help:
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          Contact Support:
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Reach out to our technical team to discuss your specific
                        requirements and get personalized integration
                        assistance.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card/60 backdrop-blur-sm p-6 rounded-xl border border-border/40 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-accent-blue/20 shadow-sm">
                      <Eye className="h-5 w-5 text-accent-blue" />
                    </div>
                    <span className="font-semibold text-foreground">
                      Remember
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    The standard integration method described above is best for
                    the quickest setup. But we understand that every e-commerce
                    site has unique needs, and we&apos;re committed to helping
                    you achieve the perfect integration for your platform.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-6 space-y-8">
        {/* Enhanced Header with Depth */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="gap-2 hover:bg-card/50 transition-all duration-200 hover:shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 bg-card/80 backdrop-blur-sm border-border/60 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Globe className="h-3 w-3" />
              Client Documentation
            </Badge>
          </div>
        </div>

        {/* Enhanced Page Title */}
        <div className="text-center space-y-4 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-3xl blur-3xl"></div>
          <div className="relative bg-card/30 backdrop-blur-sm rounded-2xl p-8 border border-border/50 shadow-lg">
            <h1 className="text-4xl font-bold text-foreground mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              WebAR and 3D Viewer Integration Guide
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Complete implementation guide for CharpstAR services with
              step-by-step instructions
            </p>
          </div>
        </div>

        {/* Enhanced Documentation Sections */}
        <div className="space-y-8">
          {documentationSections.map((section, index) => (
            <Card
              key={section.id}
              className="overflow-hidden w-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card/80 backdrop-blur-sm border-border/60 shadow-lg group"
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              <CardHeader className="pb-4 bg-gradient-to-r from-card via-card/95 to-card/90 border-b border-border/30">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div
                      className={`h-14 w-14 rounded-xl ${section.bgColor} flex items-center justify-center shadow-lg border border-border/30 group-hover:shadow-xl transition-all duration-300 group-hover:scale-105`}
                    >
                      <section.icon className={`h-7 w-7 ${section.color}`} />
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
                      {section.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {section.description}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-6 relative overflow-hidden">
                {section.content}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enhanced Footer */}
        <div className="relative mt-12">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-3xl blur-3xl"></div>
          <div className="relative bg-card/30 backdrop-blur-sm rounded-2xl p-8 border border-border/50 shadow-lg text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/20 shadow-sm">
                <HelpCircle className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">
                Need Additional Support?
              </h3>
            </div>
            <p className="text-muted-foreground mb-4 max-w-2xl mx-auto leading-relaxed">
              Contact our technical team for custom integration assistance or
              advanced implementation help
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>•</span>
              <span>Custom integrations</span>
              <span>•</span>
              <span>Technical guidance</span>
              <span>•</span>
              <span>Implementation support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
