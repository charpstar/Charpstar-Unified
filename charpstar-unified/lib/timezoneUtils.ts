// Country code to timezone mapping
export const COUNTRY_TIMEZONES: Record<string, string> = {
  // Major countries with their primary timezones
  US: "America/New_York", // United States - EST/EDT
  CA: "America/Toronto", // Canada - EST/EDT
  GB: "Europe/London", // United Kingdom - GMT/BST
  DE: "Europe/Berlin", // Germany - CET/CEST
  FR: "Europe/Paris", // France - CET/CEST
  IT: "Europe/Rome", // Italy - CET/CEST
  ES: "Europe/Madrid", // Spain - CET/CEST
  NL: "Europe/Amsterdam", // Netherlands - CET/CEST
  CH: "Europe/Zurich", // Switzerland - CET/CEST
  AT: "Europe/Vienna", // Austria - CET/CEST
  BE: "Europe/Brussels", // Belgium - CET/CEST
  SE: "Europe/Stockholm", // Sweden - CET/CEST
  NO: "Europe/Oslo", // Norway - CET/CEST
  DK: "Europe/Copenhagen", // Denmark - CET/CEST
  FI: "Europe/Helsinki", // Finland - EET/EEST
  PL: "Europe/Warsaw", // Poland - CET/CEST
  CZ: "Europe/Prague", // Czech Republic - CET/CEST
  HU: "Europe/Budapest", // Hungary - CET/CEST
  RO: "Europe/Bucharest", // Romania - EET/EEST
  BG: "Europe/Sofia", // Bulgaria - EET/EEST
  GR: "Europe/Athens", // Greece - EET/EEST
  RU: "Europe/Moscow", // Russia - MSK
  UA: "Europe/Kiev", // Ukraine - EET/EEST
  JP: "Asia/Tokyo", // Japan - JST
  CN: "Asia/Shanghai", // China - CST
  KR: "Asia/Seoul", // South Korea - KST
  IN: "Asia/Kolkata", // India - IST
  AU: "Australia/Sydney", // Australia - AEST/AEDT
  NZ: "Pacific/Auckland", // New Zealand - NZST/NZDT
  BR: "America/Sao_Paulo", // Brazil - BRT/BRST
  MX: "America/Mexico_City", // Mexico - CST/CDT
  AR: "America/Argentina/Buenos_Aires", // Argentina - ART
  CL: "America/Santiago", // Chile - CLT/CLST
  ZA: "Africa/Johannesburg", // South Africa - SAST
  EG: "Africa/Cairo", // Egypt - EET/EEST
  IL: "Asia/Jerusalem", // Israel - IST/IDT
  AE: "Asia/Dubai", // UAE - GST
  SA: "Asia/Riyadh", // Saudi Arabia - AST
  TR: "Europe/Istanbul", // Turkey - TRT

  // Legacy support for country names (from previous implementation)
  "United States": "America/New_York",
  Canada: "America/Toronto",
  "United Kingdom": "Europe/London",
  Germany: "Europe/Berlin",
  France: "Europe/Paris",
  Other: "UTC", // Default fallback
};

export function getTimezoneFromCountry(country: string | null): string {
  if (!country) return "UTC";
  return COUNTRY_TIMEZONES[country] || "UTC";
}

export function getCurrentTimeInTimezone(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return formatter.format(now);
  } catch (error) {
    console.error("Error formatting timezone:", error);
    return "00:00";
  }
}

export function getTimezoneDisplayName(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(now);
    const timeZoneName = parts.find((part) => part.type === "timeZoneName");
    return timeZoneName ? timeZoneName.value : timezone;
  } catch (error) {
    console.error("Error getting timezone display name:", error);
    return timezone;
  }
}

export function getTimezoneName(timezone: string): string {
  try {
    // Get the timezone abbreviation
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(now);
    const timeZoneName = parts.find((part) => part.type === "timeZoneName");
    return timeZoneName
      ? timeZoneName.value
      : timezone.split("/").pop() || timezone;
  } catch {
    return timezone.split("/").pop() || timezone;
  }
}
