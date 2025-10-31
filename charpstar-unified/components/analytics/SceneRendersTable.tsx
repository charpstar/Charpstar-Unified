"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { Badge } from "@/components/ui/feedback";
import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { ChevronUp, ChevronDown, Search } from "lucide-react";

interface SceneRendersTableProps {
  data: Array<{
    id: string;
    date: string;
    time: string;
    client: string;
    email: string;
    objectType: string;
    format: string;
    status: string;
    saved: boolean;
    generationTime: number;
    errorMessage?: string;
  }>;
}

type SortField =
  | "date"
  | "client"
  | "objectType"
  | "format"
  | "status"
  | "saved"
  | "generationTime";
type SortDirection = "asc" | "desc";

export function SceneRendersTable({ data }: SceneRendersTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [savedFilter, setSavedFilter] = useState<string>("all");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedData = data
    .filter((item) => {
      const matchesSearch =
        item.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.objectType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.format.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchesSaved =
        savedFilter === "all" ||
        (savedFilter === "saved" && item.saved) ||
        (savedFilter === "not-saved" && !item.saved);

      return matchesSearch && matchesStatus && matchesSaved;
    })
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === "date") {
        aValue = new Date(`${a.date} ${a.time}`).getTime();
        bValue = new Date(`${b.date} ${b.time}`).getTime();
      }

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Success
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSavedBadge = (saved: boolean) => {
    return saved ? (
      <Badge variant="default" className="bg-blue-100 text-blue-800">
        Saved
      </Badge>
    ) : (
      <Badge variant="outline">Not Saved</Badge>
    );
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-medium"
    >
      {children}
      {sortField === field &&
        (sortDirection === "asc" ? (
          <ChevronUp className="h-4 w-4 ml-1" />
        ) : (
          <ChevronDown className="h-4 w-4 ml-1" />
        ))}
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by client, object type, or format..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={savedFilter} onValueChange={setSavedFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Saved" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="saved">Saved</SelectItem>
              <SelectItem value="not-saved">Not Saved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton field="date">Date & Time</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="client">Client</SortButton>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>
                <SortButton field="objectType">Object Type</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="format">Format</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="status">Status</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="saved">Saved</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="generationTime">Generation Time</SortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="text-sm">
                    <div>
                      {new Date(
                        `${item.date} ${item.time}`
                      ).toLocaleDateString()}
                    </div>
                    <div className="text-muted-foreground">{item.time}</div>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{item.client}</TableCell>
                <TableCell className="text-muted-foreground">
                  {item.email || "N/A"}
                </TableCell>
                <TableCell>{item.objectType}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.format}</Badge>
                </TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell>{getSavedBadge(item.saved)}</TableCell>
                <TableCell>
                  {item.generationTime
                    ? `${Math.round(item.generationTime / 1000)}s`
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredAndSortedData.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No renders found matching the current filters.
        </div>
      )}
    </div>
  );
}
