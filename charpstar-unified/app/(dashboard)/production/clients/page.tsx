"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/display";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { Input } from "@/components/ui/inputs";
import { useUser } from "@/contexts/useUser";
// import { createClient } from "@/utils/supabase/client"; // Not currently used
import { toast } from "@/components/ui/utilities";
import {
  Loader2,
  Search,
  Users,
  Plus,
  ArrowRight,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/feedback";

interface Client {
  id: string;
  name: string;
  email: string;
  role: string;
  client: string;
  created_at: string;
}

export default function ClientsPage() {
  const user = useUser();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/production/client-users");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch clients");
      }

      setClients(result.clients || []);
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      toast({
        title: "Error",
        description: "Failed to fetch clients",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    // Filter clients based on search term
    const filtered = clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.client.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredClients(filtered);
  }, [clients, searchTerm]);

  // Check if user is admin or production (after all hooks)
  if (
    user?.metadata?.role !== "admin" &&
    user?.metadata?.role !== "production"
  ) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You don&apos;t have permission to access this page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleClientSelect = (client: Client) => {
    router.push(
      `/production/onboard-client?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`
    );
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "client":
        return <Badge variant="default">Client</Badge>;
      case "admin":
        return <Badge variant="destructive">Admin</Badge>;
      case "modeler":
        return <Badge variant="secondary">Modeler</Badge>;
      case "qa":
        return <Badge variant="outline">QA</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading clients...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Client Users
          </h1>
          <p className="text-muted-foreground mt-2">
            View and manage users with client role
          </p>
        </div>
        <Button
          onClick={() => router.push("/admin/clients")}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add New Client
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Client Users ({filteredClients.length} users)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Users Table */}
            {filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No client users found
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm
                    ? "No users match your search criteria"
                    : "No client users have been created yet"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Client</th>
                      <th className="text-left p-3 font-medium">Role</th>
                      <th className="text-left p-3 font-medium">Created</th>
                      <th className="text-left p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3">
                          <div className="font-medium">{client.name}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm text-muted-foreground">
                            {client.email}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm">{client.client}</div>
                        </td>
                        <td className="p-3">{getRoleBadge(client.role)}</td>
                        <td className="p-3">
                          <div className="text-sm text-muted-foreground">
                            {new Date(client.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-3">
                          <Button
                            onClick={() => handleClientSelect(client)}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            Onboard Assets
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
