// import { ProductMetrics } from "@/utils/BigQuery/types";

// interface ImpersonatedProfile {
//   id: string;
//   email: string;
//   role: string;
//   analytics_profile_id?: string;
//   datasetid?: string;
//   projectid?: string;
//   monitoredsince?: string;
// }

// export interface CVRTableProps {
//   isLoading: boolean;
//   data: ProductMetrics[];
//   showColumns: {
//     ar_sessions?: boolean;
//     _3d_sessions?: boolean;
//     total_purchases?: boolean;
//     purchases_with_service?: boolean;
//     avg_session_duration_seconds?: boolean;
//   };
//   showSearch?: boolean;
//   effectiveProfile?: ImpersonatedProfile | null;
// }

// export default function CVRTable({
//   isLoading,
//   data,
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   showColumns,
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   showSearch,
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   effectiveProfile,
// }: CVRTableProps) {
//   if (isLoading) {
//     return <div>Loading...</div>;
//   }

//   return (
//     <div>
//       {/* Your table implementation */}
//       <pre>{JSON.stringify(data, null, 2)}</pre>
//     </div>
//   );
// }
