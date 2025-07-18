"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { UserSelectionDialog } from "@/components/production/UserSelectionDialog";
import { TeamInfoTooltip } from "@/components/production/TeamInfoTooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/interactive";

import { supabase } from "@/lib/supabaseClient";
import {
  CloudUpload,
  Bell,
  TrendingUp,
  Calendar,
  Clock,
  Package,
  Search,
  Filter,
  Shield,
  Building,
  Users,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";

interface BatchProgress {
  id: string;
  client: string;
  batch: number;
  totalModels: number;
  completedModels: number;
  startDate: string;
  deadline: string;
  completionPercentage: number;
  statusCounts: {
    in_production: number;
    revisions: number;
    approved: number;
    delivered_by_artist: number;
  };
  assignedUsers: {
    modelers: Array<{ id: string; email: string; title?: string }>;
    qa: Array<{ id: string; email: string; title?: string }>;
  };
}

export default function ProductionDashboard() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchProgress[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<BatchProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [sortBy, setSortBy] = useState<string>("client-batch-stable");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRole, setDialogRole] = useState<"modeler" | "qa">("modeler");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<number>(1);

  useEffect(() => {
    document.title = "CharpstAR Platform - Production Dashboard";
  }, []);

  useEffect(() => {
    fetchBatchProgress();
  }, []);

  const fetchBatchProgress = async () => {
    try {
      setLoading(true);

      // Get all assets with batch information
      const { data: assetData, error: assetError } = await supabase
        .from("onboarding_assets")
        .select("client, batch, created_at, status, delivery_date")
        .order("client");

      if (assetError) throw assetError;

      // Group by client and batch
      const batchMap = new Map<string, BatchProgress>();

      assetData?.forEach((asset) => {
        const client = asset.client;
        const batch = asset.batch || 1;
        const batchKey = `${client}-${batch}`;

        if (!batchMap.has(batchKey)) {
          batchMap.set(batchKey, {
            id: batchKey,
            client,
            batch,
            totalModels: 0,
            completedModels: 0,
            startDate: asset.created_at || new Date().toISOString(),
            deadline: asset.delivery_date || new Date().toISOString(),
            completionPercentage: 0,
            statusCounts: {
              in_production: 0,
              revisions: 0,
              approved: 0,
              delivered_by_artist: 0,
            },
            assignedUsers: {
              modelers: [],
              qa: [],
            },
          });
        }

        const batchProgress = batchMap.get(batchKey)!;
        batchProgress.totalModels++;

        // Count by status
        if (asset.status) {
          if (asset.status in batchProgress.statusCounts) {
            batchProgress.statusCounts[
              asset.status as keyof typeof batchProgress.statusCounts
            ]++;
          }
        }

        // Count completed models (approved + delivered)
        if (
          asset.status === "approved" ||
          asset.status === "delivered_by_artist"
        ) {
          batchProgress.completedModels++;
        }
      });

      // Get assigned users for each batch from the batch assignments table
      const { data: assignedUsersData, error: assignedUsersError } =
        await supabase.from("user_batch_assignments").select(`
            user_id,
            client_name,
            batch_number,
            role,
            assigned_at
          `);

      if (assignedUsersError) {
        console.error("Error fetching assigned users:", assignedUsersError);
      }

      // Get user details for assigned users
      const assignedUserIds = assignedUsersData?.map((a) => a.user_id) || [];
      let userDetails: any[] = [];

      if (assignedUserIds.length > 0) {
        const { data: userDetailsData, error: userDetailsError } =
          await supabase
            .from("profiles")
            .select("id, email, title")
            .in("id", assignedUserIds);

        if (userDetailsError) {
          console.error("Error fetching user details:", userDetailsError);
        } else {
          userDetails = userDetailsData || [];
        }
      }

      // Create a map of user details by ID
      const userDetailsMap = new Map(
        userDetails.map((user) => [user.id, user])
      );

      // Group assigned users by client and batch
      const batchUsersMap = new Map<string, { modelers: any[]; qa: any[] }>();

      assignedUsersData?.forEach((assignment) => {
        if (assignment.role === "modeler" || assignment.role === "qa") {
          const batchKey = `${assignment.client_name}-${assignment.batch_number}`;

          if (!batchUsersMap.has(batchKey)) {
            batchUsersMap.set(batchKey, {
              modelers: [],
              qa: [],
            });
          }

          const batchUsers = batchUsersMap.get(batchKey)!;
          const userDetail = userDetailsMap.get(assignment.user_id);
          const userInfo = {
            id: assignment.user_id,
            email: userDetail?.email || "",
            title: userDetail?.title || "",
          };

          if (assignment.role === "modeler") {
            batchUsers.modelers.push(userInfo);
          } else if (assignment.role === "qa") {
            batchUsers.qa.push(userInfo);
          }
        }
      });

      // Calculate completion percentages and format dates
      const batchesArray = Array.from(batchMap.values()).map((batch) => {
        const batchKey = `${batch.client}-${batch.batch}`;
        const assignedUsers = batchUsersMap.get(batchKey) || {
          modelers: [],
          qa: [],
        };

        return {
          ...batch,
          id: batchKey, // Add a unique identifier for stable sorting
          completionPercentage:
            batch.totalModels > 0
              ? Math.round((batch.completedModels / batch.totalModels) * 100)
              : 0,
          startDate: new Date(batch.startDate).toLocaleDateString(),
          deadline: new Date(batch.deadline).toLocaleDateString(),
          assignedUsers,
        };
      });

      setBatches(batchesArray);
      setFilteredBatches(batchesArray);
    } catch (error) {
      console.error("Error fetching client progress:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort batches based on search term, client filter, and sort criteria
  useEffect(() => {
    let filtered = batches;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((batch) =>
        batch.client.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply client filter
    if (clientFilter !== "all") {
      filtered = filtered.filter((batch) => batch.client === clientFilter);
    }

    // Apply sorting

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "client-batch":
        case "client-batch-stable":
          // Sort by client name first, then by batch number (stable order)
          const clientComparison = a.client.localeCompare(b.client);
          if (clientComparison !== 0) return clientComparison;
          return a.batch - b.batch;

        case "batch-client":
          // Sort by batch number first, then by client name
          const batchComparison = a.batch - b.batch;
          if (batchComparison !== 0) return batchComparison;
          return a.client.localeCompare(b.client);

        case "completion-high":
          // Sort by completion percentage (highest first)
          return b.completionPercentage - a.completionPercentage;

        case "completion-low":
          // Sort by completion percentage (lowest first)
          return a.completionPercentage - b.completionPercentage;

        case "total-models-high":
          // Sort by total models (highest first)
          return b.totalModels - a.totalModels;

        case "total-models-low":
          // Sort by total models (lowest first)
          return a.totalModels - b.totalModels;

        case "deadline-asc":
          // Sort by deadline (earliest first)
          return (
            new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
          );

        case "deadline-desc":
          // Sort by deadline (latest first)
          return (
            new Date(b.deadline).getTime() - new Date(a.deadline).getTime()
          );

        case "start-date-asc":
          // Sort by start date (earliest first)
          return (
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );

        case "start-date-desc":
          // Sort by start date (latest first)
          return (
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          );

        default:
          return 0;
      }
    });

    setFilteredBatches(filtered);
  }, [batches, searchTerm, clientFilter, sortBy]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_production":
        return "#FACC15";
      case "revisions":
        return "#F87171";
      case "approved":
        return "#4ADE80";
      case "delivered_by_artist":
        return "#60A5FA";
      default:
        return "#FACC15"; // Default to in_production color
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "in_production":
        return "In Production";
      case "revisions":
        return "Ready for Revision";
      case "approved":
        return "Approved";
      case "delivered_by_artist":
        return "Delivered";
      default:
        return "In Production"; // Default to in_production label
    }
  };

  // Dialog handlers
  const handleOpenDialog = (
    role: "modeler" | "qa",
    clientName: string,
    batchNumber: number
  ) => {
    setDialogRole(role);
    setSelectedClient(clientName);
    setSelectedBatchNumber(batchNumber);
    setDialogOpen(true);
  };

  const handleUserSelected = async (users: any[]) => {
    try {
      const userIds = users.map((user) => user.id);

      const response = await fetch("/api/users/assign-to-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userIds,
          clientName: selectedClient,
          batchNumber: selectedBatchNumber,
          role: dialogRole,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign users to batch");
      }

      // Show success message
      const userEmails = users.map((user) => user.email).join(", ");
      toast.success(
        `${users.length} user${users.length !== 1 ? "s" : ""} (${userEmails}) successfully assigned to batch ${selectedBatchNumber} for ${selectedClient} as ${dialogRole}`
      );

      // Update local state instead of refetching all data
      setBatches((prevBatches) =>
        prevBatches.map((batch) => {
          if (
            batch.client === selectedClient &&
            batch.batch === selectedBatchNumber
          ) {
            const newUsers = users.map((user) => ({
              id: user.id,
              email: user.email,
              title: user.title || user.experience || user.role,
            }));

            return {
              ...batch,
              assignedUsers: {
                ...batch.assignedUsers,
                [dialogRole === "modeler" ? "modelers" : "qa"]: [
                  ...batch.assignedUsers[
                    dialogRole === "modeler" ? "modelers" : "qa"
                  ],
                  ...newUsers,
                ],
              },
            };
          }
          return batch;
        })
      );
    } catch (error) {
      console.error("Error assigning users to batch:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to assign users to batch"
      );
    }
  };

  const handleAdminReview = (clientName: string, batchNumber: number) => {
    router.push(
      `/admin-review?client=${encodeURIComponent(clientName)}&batch=${batchNumber}`
    );
  };

  const handleRemoveUsers = async (
    userIds: string[],
    clientName: string,
    batchNumber: number,
    role: "modeler" | "qa"
  ) => {
    try {
      const response = await fetch("/api/users/remove-from-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userIds,
          clientName,
          batchNumber,
          role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to remove users from batch");
      }

      const result = await response.json();

      // Show success message
      toast.success(result.message);

      // Update local state instead of refetching all data
      setBatches((prevBatches) =>
        prevBatches.map((batch) => {
          if (batch.client === clientName && batch.batch === batchNumber) {
            return {
              ...batch,
              assignedUsers: {
                ...batch.assignedUsers,
                [role === "modeler" ? "modelers" : "qa"]: batch.assignedUsers[
                  role === "modeler" ? "modelers" : "qa"
                ].filter((user) => !userIds.includes(user.id)),
              },
            };
          }
          return batch;
        })
      );
    } catch (error) {
      console.error("Error removing users from batch:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to remove users from batch"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Production Dashboard</h1>
            <div className="flex items-center gap-4">
              <div className="h-10 w-32 bg-muted animate-pulse rounded" />
              <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
              <div className="h-10 w-40 bg-muted animate-pulse rounded" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Production Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track client onboarding progress and production status
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button className="flex items-center gap-2">
            <CloudUpload className="h-4 w-4" />
            New Uploads
          </Button>

          <div className="relative">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Production Overview
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push("/production")}
                className="bg-accent"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Production Overview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/analytics/qa")}>
                <Shield className="h-4 w-4 mr-2" />
                QA Overview
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/analytics/modeler")}
              >
                <Building className="h-4 w-4 mr-2" />
                Modeler Overview
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-48">
              <SelectValue>
                {clientFilter === "all" ? "All Clients" : clientFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {Array.from(new Set(batches.map((batch) => batch.client))).map(
                (client) => (
                  <SelectItem key={client} value={client}>
                    {client}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client-batch-stable">
                Client → Batch (Stable)
              </SelectItem>
              <SelectItem value="client-batch">Client → Batch</SelectItem>
              <SelectItem value="batch-client">Batch → Client</SelectItem>
              <SelectItem value="completion-high">
                Completion % (High to Low)
              </SelectItem>
              <SelectItem value="completion-low">
                Completion % (Low to High)
              </SelectItem>
              <SelectItem value="total-models-high">
                Total Models (High to Low)
              </SelectItem>
              <SelectItem value="total-models-low">
                Total Models (Low to High)
              </SelectItem>
              <SelectItem value="deadline-asc">
                Deadline (Earliest First)
              </SelectItem>
              <SelectItem value="deadline-desc">
                Deadline (Latest First)
              </SelectItem>
              <SelectItem value="start-date-asc">
                Start Date (Earliest First)
              </SelectItem>
              <SelectItem value="start-date-desc">
                Start Date (Latest First)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredBatches.length} of {batches.length} batches
        </p>
      </div>

      {/* Batch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBatches
          .sort((a, b) => {
            // Always sort by client first, then by batch number for consistent display
            const clientComparison = a.client.localeCompare(b.client);
            if (clientComparison !== 0) return clientComparison;
            return a.batch - b.batch;
          })
          .map((batch) => {
            // Prepare chart data
            const chartData = Object.entries(batch.statusCounts)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              .filter(([_, count]) => count > 0)
              .map(([status, count]) => ({
                name: getStatusLabel(status),
                value: count,
                color: getStatusColor(status),
              }));

            return (
              <Card
                key={batch.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-semibold">
                        {batch.client} - Batch {batch.batch}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() =>
                            handleOpenDialog(
                              "modeler",
                              batch.client,
                              batch.batch
                            )
                          }
                        >
                          <Building className="h-3 w-3 mr-1" />
                          Add Modeler
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() =>
                            handleOpenDialog("qa", batch.client, batch.batch)
                          }
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          Add QA
                        </Button>
                      </div>
                    </div>
                    <Badge
                      variant={
                        batch.completionPercentage >= 80
                          ? "default"
                          : batch.completionPercentage >= 50
                            ? "secondary"
                            : "destructive"
                      }
                      className="text-sm"
                    >
                      {batch.completionPercentage}%
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Progress Chart */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Total Models:
                        </span>
                        <span className="font-semibold">
                          {batch.totalModels}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Start Date:
                        </span>
                        <span className="font-medium">{batch.startDate}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Deadline:</span>
                        <span className="font-medium">{batch.deadline}</span>
                      </div>

                      {/* Assigned Team Indicator */}
                      {(batch.assignedUsers.modelers.length > 0 ||
                        batch.assignedUsers.qa.length > 0) && (
                        <TeamInfoTooltip
                          modelers={batch.assignedUsers.modelers}
                          qa={batch.assignedUsers.qa}
                          clientName={batch.client}
                          batchNumber={batch.batch}
                          onRemoveUser={handleRemoveUsers}
                        >
                          <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                            <Users className="h-4 w-4" />
                            <span>
                              Team (
                              {batch.assignedUsers.modelers.length +
                                batch.assignedUsers.qa.length}
                              )
                            </span>
                          </div>
                        </TeamInfoTooltip>
                      )}

                      {/* Admin Review Button under Team */}
                      <div
                        className="flex w-[150px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        onClick={() =>
                          handleAdminReview(batch.client, batch.batch)
                        }
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>Admin Review</span>
                      </div>
                    </div>

                    {/* Pie Chart */}
                    <div className="w-40 h-40 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            wrapperStyle={{ zIndex: 99999 }}
                            contentStyle={{
                              backgroundColor: "var(--background)",
                              border: "1px solid var(--border)",
                              borderRadius: "8px",
                              fontSize: "12px",
                              zIndex: 99999,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Centered fraction label */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center p-2 border-0 pointer-events-none">
                          <div className="text-2xl text-primary drop-shadow-sm pointer-events-none">
                            {batch.statusCounts.approved}/{batch.totalModels}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium tracking-wide">
                            Approved
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Model Statistics
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(batch.statusCounts)
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        .filter(([_, count]) => count > 0)
                        .map(([status, count]) => (
                          <div
                            key={status}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-1">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: getStatusColor(status),
                                }}
                              />
                              <span className="text-muted-foreground">
                                {getStatusLabel(status)}
                              </span>
                            </div>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Empty State */}
      {batches.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Batch Projects</h3>
          <p className="text-muted-foreground mb-4">
            No onboarding assets found. Start by uploading client data.
          </p>
          <Button className="flex items-center gap-2">
            <CloudUpload className="h-4 w-4" />
            Upload Client Data
          </Button>
        </div>
      )}

      {/* No Search Results */}
      {batches.length > 0 && filteredBatches.length === 0 && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
          <p className="text-muted-foreground mb-4">
            No clients match your search criteria. Try adjusting your search or
            filters.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setClientFilter("all");
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* User Selection Dialog */}
      <UserSelectionDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        role={dialogRole}
        clientName={selectedClient}
        batchNumber={selectedBatchNumber}
        onUserSelected={handleUserSelected}
      />
    </div>
  );
}
