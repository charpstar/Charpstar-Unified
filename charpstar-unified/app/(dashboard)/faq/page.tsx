"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  BookOpen,
  MessageCircle,
  Settings,
  CreditCard,
  User,
  Zap,
  Star,
  Lightbulb,
  Clock,
  CheckCircle,
  Sparkles,
  Heart,
  ThumbsUp,
  ArrowRight,
} from "lucide-react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  {
    value: "all",
    label: "All Categories",
    icon: BookOpen,
    color: "bg-slate-500",
    bgColor: "bg-slate-50",
    textColor: "text-slate-700",
  },
  {
    value: "General",
    label: "General",
    icon: HelpCircle,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
  {
    value: "Getting Started",
    label: "Getting Started",
    icon: Zap,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
  {
    value: "Technical",
    label: "Technical",
    icon: Settings,
    color: "bg-slate-500",
    bgColor: "bg-slate-50",
    textColor: "text-slate-700",
  },
  {
    value: "Workflow",
    label: "Workflow",
    icon: MessageCircle,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
  {
    value: "Support",
    label: "Support",
    icon: Heart,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
  {
    value: "Billing",
    label: "Billing",
    icon: CreditCard,
    color: "bg-slate-500",
    bgColor: "bg-slate-50",
    textColor: "text-slate-700",
  },
  {
    value: "Account",
    label: "Account",
    icon: User,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
];

const getCategoryData = (category: string) => {
  const categoryData = CATEGORIES.find((cat) => cat.value === category);
  return categoryData || CATEGORIES[1]; // Default to General if not found
};

export default function FAQPage() {
  const user = useUser();
  const router = useRouter();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [filteredFaqs, setFilteredFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedFaqs, setExpandedFaqs] = useState<Set<string>>(new Set());

  // Check if user is client and redirect
  useEffect(() => {
    if (user && user.metadata?.role === "client") {
      router.push("/dashboard");
      toast.error("Access denied. FAQ page is not available for clients.");
    }
  }, [user, router]);

  // Fetch FAQs
  useEffect(() => {
    fetchFAQs();
  }, []);

  // Filter FAQs
  useEffect(() => {
    let filtered = [...faqs];

    if (searchTerm) {
      filtered = filtered.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter((faq) => faq.category === selectedCategory);
    }

    setFilteredFaqs(filtered);
  }, [faqs, searchTerm, selectedCategory]);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/faqs");
      const data = await response.json();

      if (response.ok) {
        setFaqs(data.faqs);
      } else {
        toast.error("Failed to load FAQs");
      }
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      toast.error("Failed to load FAQs");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedFaqs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedFaqs(new Set(filteredFaqs.map((faq) => faq.id)));
  };

  const collapseAll = () => {
    setExpandedFaqs(new Set());
  };

  // Show loading or access denied for clients
  if (user && user.metadata?.role === "client") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">
            Access denied. FAQ page is not available for clients.
          </p>
        </div>
      </div>
    );
  }

  // Group FAQs by category
  const groupedFaqs = filteredFaqs.reduce(
    (acc, faq) => {
      if (!acc[faq.category]) {
        acc[faq.category] = [];
      }
      acc[faq.category].push(faq);
      return acc;
    },
    {} as Record<string, FAQ[]>
  );

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">FAQ Center</h1>
              <span className="text-sm text-muted-foreground">
                Your questions, answered!
              </span>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-500" />
                  <Input
                    placeholder="Search FAQs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 border border-blue-200 focus:border-blue-400 rounded-md"
                  />
                  {searchTerm && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-full lg:w-40 h-9 border border-blue-200 focus:border-blue-400 rounded-md">
                    <Filter className="h-4 w-4 mr-2 text-blue-500" />
                    <SelectValue placeholder="Category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => {
                      const IconComponent = category.icon;
                      return (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            {category.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expandAll}
                    className="h-9 px-3 text-xs"
                  >
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Expand
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={collapseAll}
                    className="h-9 px-3 text-xs"
                  >
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Collapse
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="text-center p-4 bg-blue-50 border-blue-200">
            <div className="p-2 bg-blue-500 rounded-lg w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-blue-700 mb-1">
              {faqs.length}
            </div>
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              Total FAQs
            </div>
          </Card>

          <Card className="text-center p-4 bg-slate-50 border-slate-200">
            <div className="p-2 bg-slate-500 rounded-lg w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-slate-700 mb-1">
              {Object.keys(groupedFaqs).length}
            </div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Categories
            </div>
          </Card>

          <Card className="text-center p-4 bg-blue-50 border-blue-200">
            <div className="p-2 bg-blue-500 rounded-lg w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <Search className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-blue-700 mb-1">
              {filteredFaqs.length}
            </div>
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              Filtered Results
            </div>
          </Card>
        </div>

        {/* FAQs Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-5 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredFaqs.length === 0 ? (
          <Card className="text-center p-4 bg-slate-50 border-slate-200">
            <div className="p-3 bg-slate-400 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <HelpCircle className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">
              No FAQs found
            </h3>
            <p className="text-slate-600 mb-4 text-sm">
              {searchTerm || selectedCategory !== "all"
                ? "Try adjusting your search or filter criteria."
                : "No FAQs are available at the moment."}
            </p>
            {(searchTerm || selectedCategory !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                }}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm rounded-md"
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedFaqs).map(([category, categoryFaqs]) => {
              const categoryData = getCategoryData(category);
              const IconComponent = categoryData.icon;
              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 ${categoryData.color} rounded-lg`}>
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">
                        {category}
                      </h2>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="h-3 w-3 text-yellow-500" />
                        <span className="text-xs text-muted-foreground">
                          {categoryFaqs.length} helpful{" "}
                          {categoryFaqs.length !== 1 ? "answers" : "answer"}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`ml-auto px-2 py-1 text-xs font-semibold ${categoryData.bgColor} ${categoryData.textColor} border-0`}
                    >
                      {categoryFaqs.length} FAQ
                      {categoryFaqs.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {categoryFaqs.map((faq) => (
                      <Card
                        key={faq.id}
                        className={`hover:shadow-md transition-all duration-200 border-l-4 ${
                          expandedFaqs.has(faq.id)
                            ? `border-l-${categoryData.color.split("-")[1]}-500 shadow-sm`
                            : `border-l-${categoryData.color.split("-")[1]}-300`
                        } bg-white`}
                      >
                        <CardContent className="p-0">
                          <button
                            onClick={() => toggleExpanded(faq.id)}
                            className="w-full p-4 text-left hover:bg-slate-50 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div
                                  className={`p-1.5 rounded-md ${categoryData.bgColor} group-hover:scale-105 transition-transform duration-200`}
                                >
                                  <IconComponent
                                    className={`h-4 w-4 ${categoryData.textColor}`}
                                  />
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-semibold text-sm text-slate-800 group-hover:text-slate-900 pr-3 leading-relaxed">
                                    {faq.question}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${categoryData.bgColor} ${categoryData.textColor} border-0`}
                                    >
                                      #{faq.order_index}
                                    </Badge>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      <span>
                                        Click to{" "}
                                        {expandedFaqs.has(faq.id)
                                          ? "hide"
                                          : "reveal"}{" "}
                                        answer
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`p-1.5 rounded-full ${
                                    expandedFaqs.has(faq.id)
                                      ? "bg-green-100 text-green-600"
                                      : "bg-slate-100 text-slate-500"
                                  } group-hover:scale-105 transition-all duration-200`}
                                >
                                  {expandedFaqs.has(faq.id) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                          {expandedFaqs.has(faq.id) && (
                            <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                              <div className="border-t border-slate-200 pt-3">
                                <div className="flex items-start gap-2">
                                  <div className="p-1.5 bg-green-100 rounded-md">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                                      {faq.answer}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
