// "use client";

export default function CVRPage() {
  return null; // Or some placeholder
}
// import React from "react";
// import { useUser } from "@/contexts/useUser";
// import { compToBq } from "@/utils/uiutils";
// import CVRTable from "@/components/CVRTable";
// import DateRangePicker from "@/components/DateRangePicker";
// import { useClientQuery } from "@/queries/useClientQuery";
// import { useDateRange } from "@/contexts/DateRangeContext";
// import { ProductMetrics } from "@/utils/BigQuery/types";

// export default function CVRPage() {
//   const user = useUser();
//   const { monitoredsince } = user?.metadata.analytics_profiles?.[0] ?? {};
//   const { dateRange, setDateRange } = useDateRange();

//   const startTableName = compToBq(dateRange.startDate);
//   const endTableName = compToBq(dateRange.endDate);

//   const { clientQueryResult, isQueryLoading } = useClientQuery({
//     startTableName,
//     endTableName,
//     limit: 100,
//   });

//   return (
//     <div className="flex-1 space-y-4 p-4 pt-6">
//       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
//         <div>
//           <h1 className="text-2xl font-bold tracking-tight">Detailed Stats</h1>
//           <p className="text-sm text-muted-foreground mt-1">
//             Comprehensive product performance statistics and conversion rates
//           </p>
//         </div>
//         <DateRangePicker
//           value={dateRange}
//           onChange={setDateRange}
//           minDate={monitoredsince ? new Date(monitoredsince) : undefined}
//         />
//       </div>

//       <CVRTable
//         isLoading={isQueryLoading}
//         data={clientQueryResult as ProductMetrics[]}
//         showColumns={{
//           ar_sessions: true,
//           _3d_sessions: true,
//           total_purchases: true,
//           purchases_with_service: true,
//           avg_session_duration_seconds: true,
//         }}
//         showSearch={true}
//       />
//     </div>
//   );
// }
