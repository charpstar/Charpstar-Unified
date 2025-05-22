// import * as React from "react";
// import { addDays, format } from "date-fns";
// import { Calendar as CalendarIcon } from "lucide-react";
// import { DateRange } from "react-day-picker";

// import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
// import { Calendar } from "@/components/ui/calendar";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover";

// interface DateRangePickerProps {
//   value: { startDate: string; endDate: string };
//   minDate?: Date;
//   onChange: (newValue: { startDate: string; endDate: string }) => void;
// }

// export default function DateRangePicker({
//   value,
//   minDate,
//   onChange,
// }: DateRangePickerProps) {
//   const [date, setDate] = React.useState<DateRange | undefined>({
//     from: new Date(value.startDate),
//     to: new Date(value.endDate),
//   });

//   React.useEffect(() => {
//     if (date?.from && date?.to) {
//       onChange({
//         startDate: format(date.from, "yyyy-MM-dd"),
//         endDate: format(date.to, "yyyy-MM-dd"),
//       });
//     }
//   }, [date, onChange]);

//   return (
//     <div className="grid gap-2">
//       <Popover>
//         <PopoverTrigger asChild>
//           <Button
//             id="date"
//             variant="outline"
//             className={cn(
//               "w-full justify-start text-left font-normal",
//               !date && "text-muted-foreground"
//             )}
//           >
//             <CalendarIcon className="mr-2 h-4 w-4" />
//             {date?.from ? (
//               date.to ? (
//                 <>
//                   {format(date.from, "LLL dd, y")} -{" "}
//                   {format(date.to, "LLL dd, y")}
//                 </>
//               ) : (
//                 format(date.from, "LLL dd, y")
//               )
//             ) : (
//               <span>Pick a date range</span>
//             )}
//           </Button>
//         </PopoverTrigger>
//         <PopoverContent className="w-auto p-0" align="end">
//           <Calendar
//             initialFocus
//             mode="range"
//             defaultMonth={date?.from}
//             selected={date}
//             onSelect={setDate}
//             numberOfMonths={2}
//             fromDate={minDate}
//             toDate={new Date()}
//           />
//         </PopoverContent>
//       </Popover>
//     </div>
//   );
// }
