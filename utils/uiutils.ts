import dayjs from "@/utils/dayjs";
import { type ShortcutsItem } from "react-tailwindcss-datepicker";

export function dayjsToComp(date: dayjs.Dayjs) {
  return date.format("YYYY-MM-DD");
}

export function compToBq(date: string) {
  return date.replace(/-/g, "");
}

export function buildDateRange(startDate?: dayjs.Dayjs, endDate?: dayjs.Dayjs) {
  return {
    startDate: dayjsToComp(
      startDate ?? customShortcutsDayJs.last15days!.period.start
    ),
    endDate: dayjsToComp(
      endDate ?? customShortcutsDayJs.last15days!.period.end
    ),
  };
}

export function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const customShortcutsDayJs: Record<
  string,
  Omit<ShortcutsItem, "period"> & {
    period: {
      start: dayjs.Dayjs;
      end: dayjs.Dayjs;
    };
  }
> = {
  yesterday: {
    text: "Yesterday",
    period: {
      start: dayjs().add(-1, "day"),
      end: dayjs().add(-1, "day"),
    },
  },
  last7days: {
    text: "Last 7 days",
    period: {
      start: dayjs().add(-7, "day"),
      end: dayjs().add(-1, "day"),
    },
  },
  last15days: {
    text: "Last 15 days",
    period: {
      start: dayjs().add(-15, "day"),
      end: dayjs().add(-1, "day"),
    },
  },
  last30days: {
    text: "Last 30 days",
    period: {
      start: dayjs().add(-30, "day"),
      end: dayjs().add(-1, "day"),
    },
  },
};

export const customShortcuts: Record<string, ShortcutsItem> =
  Object.fromEntries(
    Object.entries(customShortcutsDayJs).map(([key, value]) => [
      key,
      {
        text: value.text,
        period: {
          start: value.period.start.toDate(),
          end: value.period.end.toDate(),
        },
      },
    ])
  );
