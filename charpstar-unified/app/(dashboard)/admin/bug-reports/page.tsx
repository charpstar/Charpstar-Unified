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
import { Textarea } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
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
  Bug,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Calendar,
  User,
  Globe,
  Monitor,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";

interface BugReport {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  user_email: string;
  url: string;
  page_title: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  admin_notes: string | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  additional_info: string | null;
  user_agent: string | null;
  images: string[];
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "UI/UX Issue", label: "UI/UX Issue" },
  { value: "Functionality Bug", label: "Functionality Bug" },
  { value: "Performance Issue", label: "Performance Issue" },
  { value: "Data Issue", label: "Data Issue" },
  { value: "Authentication Problem", label: "Authentication Problem" },
  { value: "Navigation Issue", label: "Navigation Issue" },
  { value: "Feature Request", label: "Feature Request" },
  { value: "Other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function AdminBugReportsPage() {
  const user = useUser();
  const router = useRouter();
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [priorityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    status: "",
    priority: "",
    adminNotes: "",
  });

  // Check if user is admin
  useEffect(() => {
    if (user && user.metadata?.role !== "admin") {
      router.push("/dashboard");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [user, router]);

  // Fetch bug reports
  useEffect(() => {
    fetchBugReports();
  }, [currentPage, statusFilter, categoryFilter, priorityFilter]);

  const fetchBugReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });

      if (statusFilter !== "all") params.append("status", statusFilter);
      if (categoryFilter !== "all") params.append("category", categoryFilter);

      const response = await fetch(`/api/bug-reports?${params}`);
      const data = await response.json();

      if (response.ok) {
        setBugReports(data.bugReports);
        setTotalPages(data.pagination.totalPages);
      } else {
        toast.error("Failed to fetch bug reports");
      }
    } catch (error) {
      console.error("Error fetching bug reports:", error);
      toast.error("Failed to fetch bug reports");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/bug-reports/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success("Status updated successfully");
        fetchBugReports();
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleEdit = (report: BugReport) => {
    setSelectedReport(report);
    setEditForm({
      status: report.status,
      priority: report.priority,
      adminNotes: report.admin_notes || "",
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedReport) return;

    try {
      const response = await fetch(`/api/bug-reports/${selectedReport.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        toast.success("Bug report updated successfully");
        setShowEditDialog(false);
        fetchBugReports();
      } else {
        toast.error("Failed to update bug report");
      }
    } catch (error) {
      console.error("Error updating bug report:", error);
      toast.error("Failed to update bug report");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bug report?")) return;

    try {
      const response = await fetch(`/api/bug-reports/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Bug report deleted successfully");
        fetchBugReports();
      } else {
        toast.error("Failed to delete bug report");
      }
    } catch (error) {
      console.error("Error deleting bug report:", error);
      toast.error("Failed to delete bug report");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      open: { color: "bg-blue-100 text-blue-800", label: "Open" },
      in_progress: {
        color: "bg-yellow-100 text-yellow-800",
        label: "In Progress",
      },
      resolved: { color: "bg-green-100 text-green-800", label: "Resolved" },
      closed: { color: "bg-gray-100 text-gray-800", label: "Closed" },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.open;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { color: "bg-green-100 text-green-800", label: "Low" },
      medium: { color: "bg-yellow-100 text-yellow-800", label: "Medium" },
      high: { color: "bg-orange-100 text-orange-800", label: "High" },
      critical: { color: "bg-red-100 text-red-800", label: "Critical" },
    };

    const config =
      priorityConfig[priority as keyof typeof priorityConfig] ||
      priorityConfig.medium;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const filteredReports = bugReports.filter((report) => {
    const matchesSearch =
      report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.user_email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (user && user.metadata?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">
            Access denied. Admin privileges required.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bug className="h-8 w-8 text-red-500" />
            Bug Reports
          </h1>
          <p className="text-muted-foreground">
            Manage and track bug reports from users
          </p>
        </div>
        <Button onClick={fetchBugReports} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search bug reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bug Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bug Reports ({filteredReports.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No bug reports found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium max-w-xs">
                        <div className="truncate" title={report.title}>
                          {report.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={report.status}
                          onValueChange={(value) =>
                            handleStatusChange(report.id, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.slice(1).map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{getPriorityBadge(report.priority)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.user_email || "Anonymous"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(report.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedReport(report);
                              setShowDetailsDialog(true);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(report)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(report.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="min-w-4xl max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Bug Report Details
            </DialogTitle>
            <DialogDescription>
              Complete information about this bug report
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Title</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedReport.title}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Category</h4>
                  <Badge variant="outline">{selectedReport.category}</Badge>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Status</h4>
                  {getStatusBadge(selectedReport.status)}
                </div>
                <div>
                  <h4 className="font-medium mb-2">Priority</h4>
                  {getPriorityBadge(selectedReport.priority)}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedReport.description}
                </p>
              </div>

              {selectedReport.steps_to_reproduce && (
                <div>
                  <h4 className="font-medium mb-2">Steps to Reproduce</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedReport.steps_to_reproduce}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedReport.expected_behavior && (
                  <div>
                    <h4 className="font-medium mb-2">Expected Behavior</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedReport.expected_behavior}
                    </p>
                  </div>
                )}
                {selectedReport.actual_behavior && (
                  <div>
                    <h4 className="font-medium mb-2">Actual Behavior</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedReport.actual_behavior}
                    </p>
                  </div>
                )}
              </div>

              {selectedReport.additional_info && (
                <div>
                  <h4 className="font-medium mb-2">Additional Information</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedReport.additional_info}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">User</h4>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedReport.user_email || "Anonymous"}
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Created</h4>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(selectedReport.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Page URL</h4>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={selectedReport.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    {selectedReport.url}
                  </a>
                </div>
              </div>

              {selectedReport.user_agent && (
                <div>
                  <h4 className="font-medium mb-2">User Agent</h4>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-mono break-all">
                      {selectedReport.user_agent}
                    </span>
                  </div>
                </div>
              )}

              {selectedReport.admin_notes && (
                <div>
                  <h4 className="font-medium mb-2">Admin Notes</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedReport.admin_notes}
                  </p>
                </div>
              )}

              {selectedReport.images && selectedReport.images.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Images ({selectedReport.images.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedReport.images.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-video relative rounded-lg overflow-hidden border">
                          <Image
                            src={imageUrl}
                            alt={`Bug report image ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground text-center">
                          Image {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Bug Report</DialogTitle>
            <DialogDescription>
              Update the status, priority, and admin notes for this bug report
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select
                value={editForm.status}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.slice(1).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Priority</label>
              <Select
                value={editForm.priority}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.slice(1).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Admin Notes
              </label>
              <Textarea
                value={editForm.adminNotes}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    adminNotes: e.target.value,
                  }))
                }
                placeholder="Add admin notes..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
