import React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/display";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/display";
import { type ProductMetrics } from "@/utils/BigQuery/types";

export const createColumns = (showColumns: {
  total_purchases: boolean;
  purchases_with_service: boolean;
  _3d_sessions: boolean;
  ar_sessions: boolean;
  avg_session_duration_seconds: boolean;
}): ColumnDef<ProductMetrics>[] => {
  const baseColumns: ColumnDef<ProductMetrics>[] = [
    {
      accessorKey: "product_name",
      header: ({ column }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="w-full justify-between gap-2"
              >
                Product Name
                {column.getIsSorted() === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>The name of the product</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      accessorKey: "ar_sessions",
      header: ({ column }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="w-full justify-between gap-2"
              >
                AR Sessions
                {column.getIsSorted() === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Total AR Button Clicks</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.getValue("ar_sessions")}</div>
      ),
    },
    {
      accessorKey: "_3d_sessions",
      header: ({ column }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="w-full justify-between gap-2"
              >
                3D Sessions
                {column.getIsSorted() === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Total 3D Button Clicks</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.getValue("_3d_sessions")}</div>
      ),
    },
    {
      accessorKey: "total_button_clicks",
      header: ({ column }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="w-full justify-between gap-2"
              >
                Total Sessions
                {column.getIsSorted() === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Total AR and 3D Button Clicks</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.getValue("total_button_clicks")}</div>
      ),
    },
    {
      accessorKey: "default_conv_rate",
      header: ({ column }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="w-full justify-between gap-2"
              >
                CVR (Default)
                {column.getIsSorted() === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Default Conversion Rate of the Product
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.getValue("default_conv_rate")}%</div>
      ),
    },
    {
      accessorKey: "product_conv_rate",
      header: ({ column }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="w-full justify-between gap-2"
              >
                CVR (CharpstAR)
                {column.getIsSorted() === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Conversion Rate of the product of users who have clicked either
              the AR or 3D Buttons
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.getValue("product_conv_rate")}%</div>
      ),
    },
  ];

  if (showColumns.purchases_with_service) {
    baseColumns.push({
      accessorKey: "purchases_with_service",
      header: ({ column }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="w-full justify-between gap-2"
              >
                Purchases with AR/3D
                {column.getIsSorted() === "asc" ? (
                  <ChevronUp className="h-4 w-4" />
                ) : column.getIsSorted() === "desc" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Total Purchases of the product by users who have clicked either
              the AR or 3D Buttons
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {row.getValue("purchases_with_service")}
        </div>
      ),
    });
  }

  return baseColumns;
};
