"use client";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/containers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import { Button } from "@/components/ui/display";
import { Eye, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/interactive/dropdown-menu";
import { useRouter } from "next/navigation";

const STATUS_LABELS = {
  not_started: { label: "Not Started", color: "bg-gray-200 text-gray-700" },
  in_production: {
    label: "In Production",
    color: "bg-yellow-100 text-yellow-800",
  },
  revisions: { label: "Revisions", color: "bg-red-100 text-red-700" },
  approved: { label: "Approved", color: "bg-green-100 text-green-700" },
  delivered_by_artist: {
    label: "Delivered by Artist",
    color: "bg-blue-100 text-blue-700",
  },
};

const PAGE_SIZE = 18;

export default function ReviewDashboardPage() {
  const user = useUser();
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sort, setSort] = useState<string>("az");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Fetch assets for this client
  useEffect(() => {
    async function fetchAssets() {
      if (!user?.metadata?.client) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("onboarding_assets")
        .select("id, product_name, article_id, delivery_date, status")
        .eq("client", user.metadata.client);
      if (!error && data) setAssets(data);
      setLoading(false);
    }
    fetchAssets();
  }, [user?.metadata?.client]);

  // Filtering, sorting, searching
  useEffect(() => {
    let data = [...assets];
    if (statusFilter) data = data.filter((a) => a.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(
        (a) =>
          a.product_name?.toLowerCase().includes(s) ||
          a.article_id?.toLowerCase().includes(s)
      );
    }
    if (sort === "az")
      data.sort((a, b) => a.product_name.localeCompare(b.product_name));
    if (sort === "za")
      data.sort((a, b) => b.product_name.localeCompare(a.product_name));
    if (sort === "date")
      data.sort((a, b) =>
        (b.delivery_date || "").localeCompare(a.delivery_date || "")
      );
    if (sort === "date-oldest")
      data.sort((a, b) =>
        (a.delivery_date || "").localeCompare(b.delivery_date || "")
      );
    setFiltered(data);
    setPage(1); // Reset to first page on filter/sort/search
  }, [assets, statusFilter, sort, search]);

  // Pagination
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Selection
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className=" mx-auto p-6 flex flex-col h-full">
      <Card className="p-6 flex-1 flex flex-col ">
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4 space-between">
          <div className="flex gap-2">
            <select
              className="border rounded px-3 py-2 text-sm cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Status</option>
              {Object.entries(STATUS_LABELS).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
            <Input
              className="w-full md:w-64"
              placeholder="Search by name or article ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <select
              className="border rounded px-3 py-2 text-sm cursor-pointer"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="date">Sort by: Delivery Date (Newest)</option>
              <option value="date-oldest">
                Sort by: Delivery Date (Oldest)
              </option>
            </select>
          </div>
        </div>
        <div className="overflow-y-auto rounded-lg border bg-background flex-1 max-h-[79vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1 rounded hover:bg-accent cursor-pointer"
                        aria-label="Sort"
                      >
                        <Menu className="h-5 w-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setSort("az")}>
                        A-Z
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSort("za")}>
                        Z-A
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSort("date")}>
                        Delivery Date
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
                <TableHead>Model Name</TableHead>
                <TableHead>Article ID</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(asset.id)}
                        onChange={() => toggleSelect(asset.id)}
                      />
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      {/* Optionally add an icon here */}
                      {asset.product_name}
                    </TableCell>
                    <TableCell>{asset.article_id}</TableCell>
                    <TableCell>{asset.delivery_date || "-"}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          asset.status in STATUS_LABELS
                            ? STATUS_LABELS[
                                asset.status as keyof typeof STATUS_LABELS
                              ].color
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {asset.status in STATUS_LABELS
                          ? STATUS_LABELS[
                              asset.status as keyof typeof STATUS_LABELS
                            ].label
                          : asset.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="cursor-pointer"
                        onClick={() => router.push(`/review/${asset.id}`)}
                      >
                        <Eye className="h-5 w-5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {/* Pagination - Always at bottom */}
        <div className="flex items-center justify-center  gap-2  ">
          <div className="text-sm text-muted-foreground">
            {filtered.length === 0
              ? "No items"
              : `
                ${1 + (page - 1) * PAGE_SIZE}
                -
                ${Math.min(page * PAGE_SIZE, filtered.length)}
                of
                ${filtered.length}
                Items
              `}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page * PAGE_SIZE >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
