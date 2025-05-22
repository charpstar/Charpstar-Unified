"use client";

import React from "react";

import {
  type ColumnDef,
  createColumnHelper,
  filterFns,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton";
import { columns, CVRRow } from "@/components/columns";

interface CVRTableProps {
  isLoading: boolean;
  data: CVRRow[];

  showColumns: {
    total_purchases: boolean;
    purchases_with_service: boolean;
    _3d_sessions: boolean;
    ar_sessions: boolean;
    avg_session_duration_seconds: boolean;
  };

  showPaginationControls?: boolean;
  showSearch?: boolean;
}

type Row = CVRTableProps["data"][number];

export default function CVRTable({
  showColumns,
  showPaginationControls = true,
  isLoading,
  data,
  showSearch = false,
}: CVRTableProps) {
  const table = useReactTable({
    data,
    columns,

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),

    initialState: {
      sorting: [
        {
          id: "product_conv_rate",
          desc: true,
        },
      ],

      pagination: {
        pageSize: 15,
      },
    },
  });

  if (isLoading) return <TableSkeleton />;
}
