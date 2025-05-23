"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TableCell,
  TableRow,
  Table,
  TableBody,
  TableHead,
  TableHeader,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function PermissionsLoading() {
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Page Access Card Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-7 w-32" />
          </CardTitle>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">
                  <Skeleton className="h-5 w-20" />
                </TableHead>
                {[1, 2, 3, 4].map((i) => (
                  <TableHead key={i} className="text-center">
                    <Skeleton className="h-5 w-24 mx-auto" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((row) => (
                <TableRow key={row}>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  {[1, 2, 3, 4].map((cell) => (
                    <TableCell key={cell} className="text-center">
                      <Skeleton className="h-6 w-10 mx-auto" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Feature Access Card Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-7 w-36" />
          </CardTitle>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">
                  <Skeleton className="h-5 w-20" />
                </TableHead>
                {[1, 2, 3].map((i) => (
                  <TableHead key={i} className="text-center">
                    <Skeleton className="h-5 w-24 mx-auto" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((row) => (
                <TableRow key={row}>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  {[1, 2, 3].map((cell) => (
                    <TableCell key={cell} className="text-center">
                      <Skeleton className="h-6 w-10 mx-auto" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
