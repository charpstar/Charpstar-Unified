"use client";

import {
  type ColumnDef,
  createColumnHelper,
  filterFns,
} from "@tanstack/react-table";

import { type executeClientQuery } from "@/utils/BigQuery/CVR";
import { DataTableColumnHeader } from "@/components/columns-header";

export type CVRRow = Awaited<ReturnType<typeof executeClientQuery>>[number];
const columnHelper = createColumnHelper<CVRRow>();

export const columns = [
  {
    header: "Product Name",
    accessorKey: "product_name",
    enableSorting: false,
    filterFn: filterFns.includesString,
    meta: {
      align: "text-left",
      width: "w-15 whitespace-normal",
      tooltip: "The name of the product",
    },
  },
  {
    header: "Total Sessions (CharpstAR)",
    accessorKey: "total_button_clicks",
    enableSorting: true,
    meta: {
      align: "text-right",
      tooltip: "Total AR and 3D Button Clicks",
    },
  },
  columnHelper.accessor("default_conv_rate", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="CVR (Default)" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-right font-medium">
          {`${row.getValue<number>(`default_conv_rate`) || 0}%`}
        </div>
      );
    },
    enableSorting: true,
    meta: {
      align: "text-right",
    },
  }),
  columnHelper.accessor("product_conv_rate", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="CVR (CharpstAR)" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-right font-medium">
          {`${row.getValue<number>("product_conv_rate") || 0}%`}
        </div>
      );
    },
    enableSorting: true,
    meta: {
      align: "text-right",
      tooltip:
        "Conversion Rate of the product of users who have clicked either the AR or 3D Buttons",
    },
  }),

  columnHelper.accessor("avg_session_duration_seconds", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Avg Session Duration" />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-right font-medium">
          {`${row.getValue<number>("avg_session_duration_seconds") || 0} seconds`}
        </div>
      );
    },
    enableSorting: true,
    meta: {
      align: "text-right",
      tooltip: "The product page average session time in seconds",
    },
  }),

  columnHelper.accessor("avg_combined_session_duration", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Avg Session Duration (CharpstAR)"
      />
    ),
    cell: ({ row }) => {
      return (
        <div className="text-right font-medium">
          {`${row.getValue<number>("avg_combined_session_duration") || 0} seconds`}
        </div>
      );
    },
    enableSorting: true,
    meta: {
      align: "text-right",
      tooltip:
        "The average session duration in seconds of users who have visited a product page and clicked either the AR or 3D Button",
    },
  }),
  {
    header: "AR Sessions",
    accessorKey: "AR_Button_Clicks",
    enableSorting: true,
    meta: {
      align: "text-right",
      tooltip: "Total AR Button Clicks",
    },
  },

  {
    header: "3D Sessions",
    accessorKey: "_3D_Button_Clicks",
    enableSorting: true,
    meta: {
      align: "text-right",
      tooltip: "Total 3D Button Clicks",
    },
  },
  {
    header: "Total Purchases",
    accessorKey: "total_purchases",
    enableSorting: true,
    meta: {
      align: "text-right",
      tooltip: "Total Purchases of the product",
    },
  },
  {
    header: "Total Purchases (CharpstAR)",
    accessorKey: "purchases_with_service",
    enableSorting: true,
    meta: {
      align: "text-right",
      tooltip:
        "Total Purchases of the product by users who have clicked either the AR or 3D Buttons",
    },
  },
] as ColumnDef<CVRRow, unknown>[];
