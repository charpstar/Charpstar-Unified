import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import minMax from "dayjs/plugin/minMax";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(minMax);

dayjs.tz.setDefault("UTC/GMT");

export default dayjs;
