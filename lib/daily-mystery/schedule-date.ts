import { MYSTERY_DAILY_TIMEZONE } from "@/lib/daily-mystery/types";

export function getZonedDateParts(date = new Date(), timeZone = MYSTERY_DAILY_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return {
    scheduleDate: `${year}-${month}-${day}`,
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
}

export function getTodayScheduleDate(date = new Date()) {
  return getZonedDateParts(date).scheduleDate;
}
