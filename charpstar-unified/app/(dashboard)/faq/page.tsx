"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Textarea } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
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
  CheckCircle,
  Heart,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
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

  // Admin state
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [adminForm, setAdminForm] = useState({
    question: "",
    answer: "",
    category: "",
    order_index: 0,
    is_active: true,
  });

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

  // Admin functions
  const isAdmin = user?.metadata?.role === "admin";

  const openAdminDialog = (faq?: FAQ) => {
    if (faq) {
      setEditingFaq(faq);
      setAdminForm({
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        order_index: faq.order_index,
        is_active: faq.is_active,
      });
    } else {
      setEditingFaq(null);
      setAdminForm({
        question: "",
        answer: "",
        category: "General",
        order_index: faqs.length + 1,
        is_active: true,
      });
    }
    setShowAdminDialog(true);
  };

  const closeAdminDialog = () => {
    setShowAdminDialog(false);
    setEditingFaq(null);
    setAdminForm({
      question: "",
      answer: "",
      category: "General",
      order_index: 0,
      is_active: true,
    });
  };

  const handleAdminSubmit = async () => {
    if (!adminForm.question.trim() || !adminForm.answer.trim()) {
      toast.error("Please fill in both question and answer");
      return;
    }

    try {
      const url = editingFaq ? `/api/faqs/${editingFaq.id}` : "/api/faqs";
      const method = editingFaq ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(adminForm),
      });

      if (response.ok) {
        toast.success(
          editingFaq ? "FAQ updated successfully" : "FAQ created successfully"
        );
        closeAdminDialog();
        fetchFAQs();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save FAQ");
      }
    } catch (error) {
      console.error("Error saving FAQ:", error);
      toast.error("Failed to save FAQ");
    }
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm("Are you sure you want to delete this FAQ?")) return;

    try {
      const response = await fetch(`/api/faqs/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("FAQ deleted successfully");
        fetchFAQs();
      } else {
        toast.error("Failed to delete FAQ");
      }
    } catch (error) {
      console.error("Error deleting FAQ:", error);
      toast.error("Failed to delete FAQ");
    }
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
              <h1 className="text-2xl font-semibold text-slate-800">
                FAQ Center
              </h1>
              <span className="text-base text-muted-foreground">
                Your questions, answered!
              </span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex justify-center">
              <Button
                onClick={() => openAdminDialog()}
                className="gap-2 bg-blue-500 hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
                Add New FAQ
              </Button>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <Card className="border shadow-sm bg-background border-border max-w-[1000px] mx-auto">
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
            <div className=" bg-slate-400 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <HelpCircle className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-medium text-slate-700 mb-2">
              No FAQs found
            </h3>
            <p className="text-slate-600 mb-4 text-base">
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
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 text-base rounded-md"
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedFaqs).map(([category, categoryFaqs]) => {
              const categoryData = getCategoryData(category);
              const IconComponent = categoryData.icon;
              return (
                <div
                  key={category}
                  className="space-y-2 max-w-[1000px] mx-auto"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 ${categoryData.color} rounded-md`}>
                      <IconComponent className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-slate-800">
                        {category}
                      </h2>
                      <span className="text-sm text-muted-foreground">
                        {categoryFaqs.length} FAQ
                        {categoryFaqs.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {categoryFaqs.map((faq) => (
                      <Card
                        key={faq.id}
                        className={`transition-all duration-300 ease-in-out border-l-2 ${
                          expandedFaqs.has(faq.id)
                            ? `${categoryData.color} shadow-md border-r border-t border-b ${categoryData.color.replace("bg-", "border-")}/20`
                            : `${categoryData.color} hover:shadow-sm border-transparent`
                        } bg-white max-w-[1000px] mx-auto`}
                      >
                        <CardContent className="p-0">
                          <button
                            onClick={() => toggleExpanded(faq.id)}
                            className="w-full p-3 text-left hover:bg-slate-50 transition-all duration-200 ease-in-out group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-2 flex-1">
                                <div
                                  className={`p-1 rounded-md ${categoryData.bgColor} flex-shrink-0`}
                                >
                                  <IconComponent
                                    className={`h-3 w-3 ${categoryData.textColor}`}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-normal text-base text-slate-800 leading-relaxed">
                                    {faq.question}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge
                                      variant="outline"
                                      className={`text-sm ${categoryData.bgColor} ${categoryData.textColor} border-0`}
                                    >
                                      #{faq.order_index}
                                    </Badge>
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
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
                                {isAdmin && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openAdminDialog(faq);
                                      }}
                                      className="h-6 w-6 p-0 hover:bg-blue-100"
                                    >
                                      <Edit className="h-3 w-3 text-blue-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteFaq(faq.id);
                                      }}
                                      className="h-6 w-6 p-0 hover:bg-red-100"
                                    >
                                      <Trash2 className="h-3 w-3 text-red-600" />
                                    </Button>
                                  </div>
                                )}
                                <div
                                  className={`p-1 rounded-full transition-all duration-300 ease-in-out ${
                                    expandedFaqs.has(faq.id)
                                      ? "bg-green-100 text-green-600 rotate-180"
                                      : "bg-slate-100 text-slate-500 rotate-0"
                                  } group-hover:scale-110 group-hover:bg-blue-100 group-hover:text-blue-600`}
                                >
                                  <ChevronDown className="h-3 w-3 transition-transform duration-300 ease-in-out" />
                                </div>
                              </div>
                            </div>
                          </button>
                          <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                              expandedFaqs.has(faq.id)
                                ? "max-h-96 opacity-100"
                                : "max-h-0 opacity-0"
                            }`}
                          >
                            <div className="px-3 pb-3 pt-0">
                              <div className="border-t border-slate-200 pt-2">
                                <div className="flex items-start gap-2">
                                  <div className="p-1 bg-green-100 rounded">
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                  </div>
                                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                                    {faq.answer}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
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

      {/* Admin Dialog */}
      {isAdmin && (
        <Dialog open={showAdminDialog} onOpenChange={setShowAdminDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingFaq ? "Edit FAQ" : "Add New FAQ"}
              </DialogTitle>
              <DialogDescription>
                {editingFaq
                  ? "Update the FAQ information below."
                  : "Create a new FAQ entry."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-base font-medium mb-2 block">
                  Question
                </label>
                <Input
                  value={adminForm.question}
                  onChange={(e) =>
                    setAdminForm((prev) => ({
                      ...prev,
                      question: e.target.value,
                    }))
                  }
                  placeholder="Enter the question..."
                />
              </div>
              <div>
                <label className="text-base font-medium mb-2 block">
                  Answer
                </label>
                <Textarea
                  value={adminForm.answer}
                  onChange={(e) =>
                    setAdminForm((prev) => ({
                      ...prev,
                      answer: e.target.value,
                    }))
                  }
                  placeholder="Enter the answer..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-base font-medium mb-2 block">
                    Category
                  </label>
                  <Select
                    value={adminForm.category}
                    onValueChange={(value) =>
                      setAdminForm((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.slice(1).map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-base font-medium mb-2 block">
                    Order Index
                  </label>
                  <Input
                    type="number"
                    value={adminForm.order_index}
                    onChange={(e) =>
                      setAdminForm((prev) => ({
                        ...prev,
                        order_index: parseInt(e.target.value) || 0,
                      }))
                    }
                    placeholder="Order number"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={adminForm.is_active}
                  onChange={(e) =>
                    setAdminForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-base font-medium">
                  Active (visible to users)
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeAdminDialog}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleAdminSubmit}>
                <Save className="h-4 w-4 mr-2" />
                {editingFaq ? "Update FAQ" : "Create FAQ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
