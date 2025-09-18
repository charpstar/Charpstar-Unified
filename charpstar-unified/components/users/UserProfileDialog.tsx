"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/display";
import { Input, Textarea } from "@/components/ui/inputs";
import { Badge } from "@/components/ui/feedback";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/display";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/interactive";
import {
  User,
  MapPin,
  Globe,
  Calendar,
  MessageSquare,
  Upload,
  Image as ImageIcon,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  Link2,
  Shield,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import {
  getTimezoneFromCountry,
  getCurrentTimeInTimezone,
  getTimezoneDisplayName,
} from "@/lib/timezoneUtils";
import { getCountryNameByCode } from "@/lib/helpers";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  country?: string | null;
  avatar?: string | null;
  // Profile-specific fields
  title?: string;
  phone_number?: string;
  discord_name?: string;
  software_experience?: string[];
  model_types?: string[];
  daily_hours?: number;
  exclusive_work?: boolean;
  portfolio_links?: string[];
  // Admin comments and ratings
  admin_comments?: UserComment[];
  portfolio_images?: PortfolioImage[];
  performance_metrics?: PerformanceMetrics;
}

interface UserComment {
  id: string;
  content: string;
  created_by: string;
  created_by_name: string;
  created_by_email?: string;
  created_at: string;
}

interface PortfolioImage {
  id: string;
  url: string;
  title: string;
  description?: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_by_email?: string;
  uploaded_at: string;
}

interface PerformanceMetrics {
  total_assignments: number;
  completed_assignments: number;

  completion_rate: number;

  specialties: string[];
}

interface UserProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  currentUserRole: string;
  currentUserId: string;
}

// Custom UserProfile DialogContent with proper cleanup - moved outside to prevent re-creation
function UserProfileDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/50",
          "pointer-events-none data-[state=open]:pointer-events-auto",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        )}
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100vw-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-4 sm:p-6 shadow-lg duration-200 max-h-[90vh] overflow-y-auto",
          className
        )}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document.body.style.pointerEvents = "";
        }}
        onEscapeKeyDown={() => {
          document.body.style.pointerEvents = "";
        }}
        onInteractOutside={() => {
          document.body.style.pointerEvents = "";
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="bg-background dark:bg-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-3 right-3 sm:top-4 sm:right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export default function UserProfileDialog({
  isOpen,
  onClose,
  userId,
  currentUserRole,
  currentUserId: _currentUserId,
}: UserProfileDialogProps) {
  // currentUserId not currently used but kept for future features
  void _currentUserId;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Comment system state
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  // Portfolio upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageTitle, setNewImageTitle] = useState("");
  const [newImageDescription, setNewImageDescription] = useState("");

  // Upload dialog state
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserProfile();
    }
  }, [isOpen, userId]);

  const fetchUserProfile = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch user data from API endpoint
      const response = await fetch(`/api/users/${userId}/profile`);
      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.status}`);
      }
      const { user: userData } = await response.json();

      // Fetch admin comments
      let comments = [];
      try {
        const commentsResponse = await fetch(`/api/users/${userId}/comments`);
        if (commentsResponse.ok) {
          const { comments: fetchedComments } = await commentsResponse.json();
          comments = fetchedComments;
        }
      } catch (error) {
        console.warn("Error fetching comments:", error);
        comments = [];
      }

      // Fetch portfolio images
      let portfolioImages = [];
      try {
        const portfolioResponse = await fetch(`/api/users/${userId}/portfolio`);
        if (portfolioResponse.ok) {
          const { images: fetchedImages } = await portfolioResponse.json();
          portfolioImages = fetchedImages;
        }
      } catch (error) {
        console.warn("Error fetching portfolio images:", error);
        portfolioImages = [];
      }

      // Fetch performance metrics (if user is a modeler or QA)
      let performanceMetrics = null;
      if (userData?.role === "modeler" || userData?.role === "qa") {
        try {
          // Calculate metrics from asset_assignments
          const { data: assignments } = await supabase
            .from("asset_assignments")
            .select("status, accepted_at")
            .eq("user_id", userId);

          if (assignments) {
            const totalAssignments = assignments.length;
            const completedAssignments = assignments.filter(
              (a) => a.status === "completed" || a.status === "approved"
            ).length;
            const completionRate =
              totalAssignments > 0
                ? (completedAssignments / totalAssignments) * 100
                : 0;

            performanceMetrics = {
              total_assignments: totalAssignments,
              completed_assignments: completedAssignments,
              // This would come from a ratings system
              completion_rate: completionRate,

              specialties: userData?.model_types || [],
            };
          }
        } catch (error) {
          console.warn("Error fetching performance metrics:", error);
          // Provide default metrics if query fails
          performanceMetrics = {
            total_assignments: 0,
            completed_assignments: 0,

            completion_rate: 0,

            specialties: userData?.model_types || [],
          };
        }
      }

      const userProfile: UserProfile = {
        id: userId,
        name: userData?.name || "Unknown",
        email: userData?.email || "No email",
        role: userData?.role || "user",
        created_at: userData?.created_at || "",
        country: userData?.country,
        avatar: userData?.avatar,
        title: userData?.title,
        phone_number: userData?.phone_number,
        discord_name: userData?.discord_name,
        software_experience: userData?.software_experience,
        model_types: userData?.model_types,
        daily_hours: userData?.daily_hours,
        exclusive_work: userData?.exclusive_work,
        portfolio_links: userData?.portfolio_links,
        admin_comments:
          comments?.map((c: any) => ({
            id: c.id,
            content: c.content,
            created_by: c.created_by,
            created_by_name: c.created_by_name, // Simplified for now
            created_by_email: c.created_by_email, // Simplified for now
            created_at: c.created_at,
            category: c.category,
          })) || [],
        portfolio_images:
          portfolioImages?.map((img: any) => ({
            id: img.id,
            url: img.url,
            title: img.title,
            description: img.description,
            uploaded_by: img.uploaded_by,
            uploaded_by_name: img.uploaded_by_name, // Simplified for now
            created_by_email: img.created_by_email, // Simplified for now
            uploaded_at: img.uploaded_at,
          })) || [],
        performance_metrics: performanceMetrics || undefined,
      };

      setUser(userProfile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast.error("Failed to load user profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addComment = useCallback(async () => {
    if (!newComment.trim() || !userId) return;

    setAddingComment(true);
    try {
      const response = await fetch(`/api/users/${userId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: newComment.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add comment: ${response.status}`);
      }

      toast.success("Comment added successfully");
      setNewComment("");

      // Add comment inline instead of full reload
      if (user) {
        const newCommentData = {
          id: `temp-${Date.now()}`, // Temporary ID until we get the real one
          content: newComment.trim(),
          created_by: user.id,
          created_by_name: user.name || "Unknown",
          created_by_email: user.email,
          created_at: new Date().toISOString(),
        };

        setUser((prevUser) => ({
          ...prevUser!,
          admin_comments: [newCommentData, ...(prevUser?.admin_comments || [])],
        }));
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setAddingComment(false);
    }
  }, [newComment, userId, fetchUserProfile]);

  const uploadPortfolioImage = useCallback(
    async (file: File) => {
      if (!userId || !file) return;

      setUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", newImageTitle || file.name);
        formData.append("description", newImageDescription || "");

        const response = await fetch(`/api/users/${userId}/portfolio`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload image: ${response.status}`);
        }

        const { image: portfolioImage } = await response.json();

        toast.success("Portfolio image uploaded successfully");
        setNewImageTitle("");
        setNewImageDescription("");
        setIsUploadDialogOpen(false); // Close the upload dialog

        // Add portfolio image inline instead of full reload
        if (user && portfolioImage) {
          const newImageData = {
            id: portfolioImage.id,
            url: portfolioImage.url,
            title: portfolioImage.title,
            description: portfolioImage.description,
            uploaded_by: portfolioImage.uploaded_by,
            uploaded_by_name:
              portfolioImage.uploaded_by_name || user.name || "Unknown",
            created_by_email: portfolioImage.created_by_email || user.email,
            uploaded_at: portfolioImage.uploaded_at,
          };

          setUser((prevUser) => ({
            ...prevUser!,
            portfolio_images: [
              newImageData,
              ...(prevUser?.portfolio_images || []),
            ],
          }));
        }
      } catch (error) {
        console.error("Error uploading portfolio image:", error);
        toast.error("Failed to upload portfolio image");
      } finally {
        setUploadingImage(false);
      }
    },
    [userId, newImageTitle, newImageDescription, fetchUserProfile]
  );

  const getInitials = useCallback((name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, []);

  // Handle Enter key to send comment
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        addComment();
      }
    },
    [addComment]
  );

  // Memoized comment form to prevent re-renders
  const CommentForm = useMemo(() => {
    if (currentUserRole !== "admin") return null;

    return (
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add your comment about this user... (Ctrl+Enter to send)"
            rows={2}
            className="text-sm pr-10"
          />
          <Button
            onClick={addComment}
            disabled={!newComment.trim() || addingComment}
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 h-8 w-8 p-0"
          >
            {addingComment ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  }, [currentUserRole, newComment, addingComment, addComment, handleKeyDown]);

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "destructive";
      case "qa":
        return "secondary";
      case "modeler":
        return "default";
      case "client":
        return "outline";
      default:
        return "outline";
    }
  };

  if (!isOpen || !userId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <UserProfileDialogContent className="max-w-7xl max-h-[90vh] min-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            User Profile
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : user ? (
          <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
              <Avatar className="h-16 w-16 border border-border">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold">{user.name}</h2>
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    <Shield className="h-3 w-3 mr-1" />
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </div>

                  {user.country && (
                    <>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {getCountryNameByCode(user.country)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Globe className="h-4 w-4" />
                        <span
                          title={getTimezoneDisplayName(
                            getTimezoneFromCountry(user.country)
                          )}
                        >
                          {getCurrentTimeInTimezone(
                            getTimezoneFromCountry(user.country)
                          )}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile/Small Screen Tabs */}
            <div className="lg:hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="skills">Skills & Info</TabsTrigger>
                  <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                  {user.performance_metrics && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Performance Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">
                              {user.performance_metrics.total_assignments}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Total Assignments
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {user.performance_metrics.completion_rate.toFixed(
                                1
                              )}
                              %
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Completion Rate
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Contact Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {user.title && (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Title:</span>{" "}
                          {user.title}
                        </div>
                      )}
                      {user.phone_number && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Phone:</span>{" "}
                          {user.phone_number}
                        </div>
                      )}
                      {user.discord_name && (
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Discord:</span>{" "}
                          {user.discord_name}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Skills & Info Tab */}
                <TabsContent value="skills" className="space-y-4">
                  {user.software_experience &&
                    user.software_experience.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Software Experience</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {user.software_experience.map((software, index) => (
                              <Badge key={index} variant="secondary">
                                {software}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                  {user.model_types && user.model_types.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Model Types Specialization</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {user.model_types.map((type, index) => (
                            <Badge key={index} variant="outline">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {user.daily_hours && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Work Availability</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Daily Hours:</span>{" "}
                          {user.daily_hours}h/day
                        </div>
                        {user.exclusive_work && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium">
                              Exclusive Work:
                            </span>{" "}
                            Yes
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {user.portfolio_links && user.portfolio_links.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Portfolio Links</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {user.portfolio_links.map((link, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2"
                            >
                              <Link2 className="h-4 w-4 text-muted-foreground" />
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {link}
                              </a>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Portfolio Tab */}
                <TabsContent value="portfolio" className="space-y-4">
                  {/* Upload Section for Admins */}
                  {currentUserRole === "admin" && (
                    <div className="mb-4">
                      <Button
                        onClick={() => setIsUploadDialogOpen(true)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Image
                      </Button>
                    </div>
                  )}

                  {/* Portfolio Images Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {user.portfolio_images?.map((image) => (
                      <Card key={image.id} className="overflow-hidden">
                        <div className="aspect-square relative">
                          <img
                            src={image.url}
                            alt={image.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-medium text-sm">{image.title}</h3>
                          {image.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {image.description}
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground mt-2">
                            Added by{" "}
                            {image.created_by_email || image.uploaded_by_name} •{" "}
                            {new Date(image.uploaded_at).toLocaleDateString()}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {(!user.portfolio_images ||
                    user.portfolio_images.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No portfolio images yet</p>
                      {currentUserRole === "admin" && (
                        <p className="text-sm">
                          Upload images to showcase this user&apos;s best work
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Comments Tab */}
                <TabsContent value="comments" className="space-y-4">
                  {/* Add Comment Section for Admins */}
                  {CommentForm}

                  {/* Comments List */}
                  <div className="space-y-3">
                    {user.admin_comments?.map((comment) => (
                      <Card key={comment.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5"></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm text-muted-foreground">
                                by{" "}
                                {comment.created_by_email ||
                                  comment.created_by_name}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                •{" "}
                                {new Date(
                                  comment.created_at
                                ).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm">{comment.content}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {(!user.admin_comments ||
                    user.admin_comments.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No comments yet</p>
                      {currentUserRole === "admin" && (
                        <p className="text-sm">
                          Add comments to track notes about this user
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop/Large Screen Layout - Everything Visible */}
            <div className="hidden lg:block space-y-6">
              {/* Performance & Contact Row */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Performance Overview */}
                {user.performance_metrics && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Performance Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">
                            {user.performance_metrics.total_assignments}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Total Assignments
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {user.performance_metrics.completion_rate.toFixed(
                              1
                            )}
                            %
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Completion Rate
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {user.title && (
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Title:</span> {user.title}
                      </div>
                    )}
                    {user.phone_number && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Phone:</span>{" "}
                        {user.phone_number}
                      </div>
                    )}
                    {user.discord_name && (
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Discord:</span>{" "}
                        {user.discord_name}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Skills & Experience Row */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Software Experience */}
                {user.software_experience &&
                  user.software_experience.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Software Experience</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {user.software_experience.map((software, index) => (
                            <Badge key={index} variant="secondary">
                              {software}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Model Types */}
                {user.model_types && user.model_types.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Model Types Specialization</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {user.model_types.map((type, index) => (
                          <Badge key={index} variant="outline">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Work Availability */}
                {user.daily_hours && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Work Availability</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Daily Hours:</span>{" "}
                        {user.daily_hours}h/day
                      </div>
                      {user.exclusive_work && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">
                            Exclusive Work:
                          </span>{" "}
                          Yes
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Portfolio Links */}
              {user.portfolio_links && user.portfolio_links.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Links</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {user.portfolio_links.map((link, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate"
                          >
                            {link}
                          </a>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Portfolio & Comments Row */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Portfolio Section */}
                <div className="space-y-4 h-126 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <ImageIcon className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Portfolio</h3>
                  </div>

                  {/* Upload Section for Admins */}
                  {currentUserRole === "admin" && (
                    <div className="mb-4">
                      <Button
                        onClick={() => setIsUploadDialogOpen(true)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Image
                      </Button>
                    </div>
                  )}

                  {/* Portfolio Images Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {user.portfolio_images?.map((image) => (
                      <Card key={image.id} className="overflow-hidden">
                        <div className="aspect-square relative">
                          <img
                            src={image.url}
                            alt={image.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-medium text-sm">{image.title}</h3>
                          {image.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {image.description}
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground mt-2">
                            Added by{" "}
                            {image.created_by_email || image.uploaded_by_name} •{" "}
                            {new Date(image.uploaded_at).toLocaleDateString()}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {(!user.portfolio_images ||
                    user.portfolio_images.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No portfolio images yet</p>
                      {currentUserRole === "admin" && (
                        <p className="text-sm">
                          Upload images to showcase this user&apos;s best work
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Comments Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Comments</h3>
                  </div>

                  {/* Add Comment Section for Admins */}
                  {CommentForm}

                  {/* Comments List */}
                  <div className="space-y-3 max-h-86 overflow-y-auto">
                    {user.admin_comments?.map((comment) => (
                      <Card key={comment.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5"></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm text-muted-foreground">
                                by{" "}
                                {comment.created_by_email ||
                                  comment.created_by_name}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                •{" "}
                                {new Date(
                                  comment.created_at
                                ).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm">{comment.content}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {(!user.admin_comments ||
                    user.admin_comments.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No comments yet</p>
                      {currentUserRole === "admin" && (
                        <p className="text-sm">
                          Add comments to track notes about this user
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Failed to load user profile</p>
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Portfolio Image</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Image Title
                </label>
                <Input
                  value={newImageTitle}
                  onChange={(e) => setNewImageTitle(e.target.value)}
                  placeholder="e.g., Excellent character modeling"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (Optional)
                </label>
                <Input
                  value={newImageDescription}
                  onChange={(e) => setNewImageDescription(e.target.value)}
                  placeholder="Additional notes about this work"
                />
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadPortfolioImage(file);
                  }}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  disabled={uploadingImage}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsUploadDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const fileInput = document.querySelector(
                      'input[type="file"]'
                    ) as HTMLInputElement;
                    if (fileInput?.files?.[0]) {
                      uploadPortfolioImage(fileInput.files[0]);
                    }
                  }}
                  disabled={uploadingImage || !newImageTitle.trim()}
                >
                  {uploadingImage ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </UserProfileDialogContent>
    </Dialog>
  );
}
