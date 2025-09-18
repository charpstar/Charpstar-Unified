"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/containers";
import { Button } from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import { Checkbox } from "@/components/ui/inputs/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/interactive";
import {
  Search,
  User,
  Shield,
  Building,
  Clock,
  Link,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  role: string;
  title?: string;
  phone_number?: string;
  discord_name?: string;
  software_experience?: string[];
  model_types?: string[];
  daily_hours?: number;
  exclusive_work?: boolean;
  portfolio_links?: string[];
  created_at: string;
  country?: string;
}

interface UserSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  role: "modeler" | "qa";
  clientName: string;
  batchNumber: number;
  onUserSelected: (users: User[]) => void;
}

export function UserSelectionDialog({
  isOpen,
  onClose,
  role,
  clientName,
  batchNumber,
  onUserSelected,
}: UserSelectionDialogProps) {
  const [users, setUsers] = useState<any>(role === "modeler" ? {} : []);
  const [filteredUsers, setFilteredUsers] = useState<any>(
    role === "modeler" ? {} : []
  );
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, role]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/users/get-role-users?role=${role}&client=${encodeURIComponent(clientName)}&batch=${batchNumber}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users);
      setFilteredUsers(data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchTerm) {
      setFilteredUsers(users);
      return;
    }

    if (role === "modeler") {
      const filtered = {
        experienced:
          users.experienced?.filter(
            (user: User) =>
              user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
              user.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              user.software_experience?.some((exp) =>
                exp.toLowerCase().includes(searchTerm.toLowerCase())
              ) ||
              user.model_types?.some((type) =>
                type.toLowerCase().includes(searchTerm.toLowerCase())
              )
          ) || [],
        intermediate:
          users.intermediate?.filter(
            (user: User) =>
              user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
              user.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              user.software_experience?.some((exp) =>
                exp.toLowerCase().includes(searchTerm.toLowerCase())
              ) ||
              user.model_types?.some((type) =>
                type.toLowerCase().includes(searchTerm.toLowerCase())
              )
          ) || [],
        beginner:
          users.beginner?.filter(
            (user: User) =>
              user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
              user.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              user.software_experience?.some((exp) =>
                exp.toLowerCase().includes(searchTerm.toLowerCase())
              ) ||
              user.model_types?.some((type) =>
                type.toLowerCase().includes(searchTerm.toLowerCase())
              )
          ) || [],
      };
      setFilteredUsers(filtered);
    } else {
      // For QA users, filter the array directly
      const filtered = Array.isArray(users)
        ? users.filter(
            (user: User) =>
              user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
              user.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              user.discord_name
                ?.toLowerCase()
                .includes(searchTerm.toLowerCase())
          )
        : [];
      setFilteredUsers(filtered);
    }
  };

  const handleUserSelect = (userId: string, checked: boolean) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(userId);
      } else {
        newSet.delete(userId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    if (selectedUsers.size > 0) {
      // Get the actual user objects from the selected IDs
      const selectedUserObjects: User[] = [];

      if (role === "modeler") {
        // Search through all categories
        Object.values(filteredUsers).forEach((category: any) => {
          if (Array.isArray(category)) {
            category.forEach((user: User) => {
              if (selectedUsers.has(user.id)) {
                selectedUserObjects.push(user);
              }
            });
          }
        });
      } else {
        // For QA users, search in the array
        if (Array.isArray(filteredUsers)) {
          filteredUsers.forEach((user: User) => {
            if (selectedUsers.has(user.id)) {
              selectedUserObjects.push(user);
            }
          });
        }
      }

      onUserSelected(selectedUserObjects);
      onClose();
      setSelectedUsers(new Set());
      setSearchTerm("");
    }
  };

  const getRoleIcon = () => {
    return role === "modeler" ? (
      <Building className="h-4 w-4" />
    ) : (
      <Shield className="h-4 w-4" />
    );
  };

  const getRoleTitle = () => {
    return role === "modeler" ? "3D Modelers" : "Quality Assurance";
  };

  const renderUserRow = (user: User) => (
    <TableRow key={user.id} className="hover:bg-muted/50">
      <TableCell className="w-12">
        <Checkbox
          checked={selectedUsers.has(user.id)}
          onCheckedChange={(checked) =>
            handleUserSelect(user.id, checked as boolean)
          }
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{user.email}</div>
          {user.title && (
            <div className="text-sm text-muted-foreground">{user.title}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        {role === "modeler" ? (
          <div className="space-y-2">
            {user.software_experience &&
              user.software_experience.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Software:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {user.software_experience
                      .slice(0, 4)
                      .map((software, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs"
                        >
                          {software}
                        </Badge>
                      ))}
                    {user.software_experience.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{user.software_experience.length - 4} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            {user.model_types && user.model_types.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Model Types:
                </div>
                <div className="flex flex-wrap gap-1">
                  {user.model_types.slice(0, 3).map((type, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                  {user.model_types.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{user.model_types.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">QA Specialist</div>
        )}
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          {role === "modeler" && (
            <>
              {user.daily_hours && (
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-3 w-3" />
                  <span className="font-medium">{user.daily_hours}h/day</span>
                </div>
              )}
              {user.exclusive_work && (
                <div className="flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className="text-xs bg-green-50 text-green-700 border-green-200"
                  >
                    Exclusive Work
                  </Badge>
                </div>
              )}
              {user.phone_number && (
                <div className="text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" /> {user.phone_number}
                </div>
              )}
            </>
          )}
          {role === "qa" && (
            <>
              {user.discord_name && (
                <div className="flex items-center gap-1 text-sm">
                  <Shield className="h-3 w-3" />
                  {user.discord_name}
                </div>
              )}
              {user.phone_number && (
                <div className="text-xs text-muted-foreground">
                  📞 {user.phone_number}
                </div>
              )}
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        {user.portfolio_links && user.portfolio_links.length > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Link className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">
                {user.portfolio_links.length} portfolio
                {user.portfolio_links.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {user.portfolio_links.slice(0, 2).map((link, index) => (
                <div key={index} className="truncate max-w-32">
                  {link.replace(/^https?:\/\//, "").replace(/^www\./, "")}
                </div>
              ))}
              {user.portfolio_links.length > 2 && (
                <div className="text-xs text-muted-foreground">
                  +{user.portfolio_links.length - 2} more
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            No portfolio links
          </div>
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="min-w-7xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getRoleIcon()}
            Add {getRoleTitle()} to {clientName} - Batch {batchNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${role === "modeler" ? "modelers" : "QA users"}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Loading users...</p>
                </div>
              </div>
            ) : role === "modeler" ? (
              <Tabs defaultValue="experienced" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger value="experienced">
                    Modelers ({filteredUsers.experienced?.length || 0})
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-auto">
                  <TabsContent value="experienced" className="h-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Software & Skills</TableHead>
                          <TableHead>Availability & Location</TableHead>
                          <TableHead>Portfolio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.experienced?.map(renderUserRow) || []}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              <div className="h-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Contact Info</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Portfolio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(filteredUsers)
                      ? filteredUsers.map(renderUserRow)
                      : []}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedUsers.size > 0 ? (
                <span>
                  {selectedUsers.size} user{selectedUsers.size !== 1 ? "s" : ""}{" "}
                  selected
                </span>
              ) : (
                <span>Select users to add to {clientName}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selectedUsers.size === 0}
              >
                Add{" "}
                {selectedUsers.size > 0
                  ? `${selectedUsers.size} user${selectedUsers.size !== 1 ? "s" : ""}`
                  : ""}{" "}
                to {clientName}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
