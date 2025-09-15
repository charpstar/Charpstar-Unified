"use client";

import React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  type SortingState,
  getFilteredRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/display";
import { Input } from "@/components/ui/inputs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/display";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/containers";
import { type ProductMetrics } from "@/utils/BigQuery/types";
import { createColumns } from "@/components/analytics/tables/CVRTable/columns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TableSkeleton } from "@/components/ui/skeletons";

interface AnalyticsProfile {
  datasetid?: string;
  projectid?: string;
  monitoredsince?: string;
  tablename?: string;
  name?: string;
}

export interface CVRTableProps {
  isLoading: boolean;
  data: ProductMetrics[];
  showColumns: {
    ar_sessions: boolean;
    _3d_sessions: boolean;
    total_purchases: boolean;
    purchases_with_service: boolean;
    avg_session_duration_seconds: boolean;
  };
  showPaginationControls?: boolean;
  showSearch?: boolean;
  effectiveProfile?: AnalyticsProfile;
}

export default function CVRTable({
  showColumns,
  showPaginationControls = true,
  isLoading,
  data,
  showSearch = false,
}: CVRTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const columns = React.useMemo(
    () => createColumns(showColumns),
    [showColumns]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full bg-background ">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <CardHeader>
          <CardTitle>Conversion Rate Details</CardTitle>
        </CardHeader>
        {showSearch && (
          <div className="flex items-center p-4 border-b">
            <Input
              placeholder="Search products..."
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="max-w-sm"
            />
          </div>
        )}
        <div className="relative overflow-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {showPaginationControls && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="flex-1 text-sm text-muted-foreground">
              Showing {table.getRowModel().rows.length} of {data.length}{" "}
              products
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
