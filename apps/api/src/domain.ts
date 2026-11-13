export const timeZone = 'Asia/Almaty';
export const meetingDurations = [30, 45, 60] as const;

export type MeetingDuration = (typeof meetingDurations)[number];
export type BookingInterval = {
  startAt: number;
  endAt: number;
};

export function getDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return date.toISOString().slice(0, 10);
}

export function getBookingWindow(now: Date) {
  const firstDate = addCalendarDays(getDateKey(now), 1);

  return Array.from({ length: 14 }, (_, index) =>
    addCalendarDays(firstDate, index),
  );
}

export function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T12:00:00.000Z`);

  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

function getLocalParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts.map(({ type, value }) => [type, Number(value)]),
  ) as Record<string, number>;
}

export function getLocalDateTime(date: Date) {
  const parts = getLocalParts(date);
  const dateKey = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const time = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;

  return { dateKey, time };
}

function localDateTimeToEpoch(dateKey: string, time: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = targetAsUtc;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const local = getLocalParts(new Date(candidate));
    const observedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    candidate += targetAsUtc - observedAsUtc;
  }

  return candidate;
}

export function formatZonedDateTime(epoch: number) {
  const parts = getLocalParts(new Date(epoch));
  const dateKey = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const time = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}`;
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsetMinutes = Math.round((localAsUtc - epoch) / 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}:${String(absoluteOffset % 60).padStart(2, '0')}`;

  return `${dateKey}T${time}${offset}`;
}

function isWeekday(dateKey: string) {
  const weekday = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();

  return weekday >= 1 && weekday <= 5;
}

export function intervalsOverlap(
  first: BookingInterval,
  second: BookingInterval,
) {
  return first.startAt < second.endAt && first.endAt > second.startAt;
}

export function getAvailabilitySlots(
  dateKey: string,
  duration: MeetingDuration,
  bookings: BookingInterval[],
  excludedDates: ReadonlySet<string>,
) {
  if (!isWeekday(dateKey) || excludedDates.has(dateKey)) return [];

  const slots: { startAt: string; endAt: string }[] = [];

  for (let startMinute = 9 * 60; startMinute < 18 * 60; startMinute += 30) {
    const endMinute = startMinute + duration;
    const fitsMorning = startMinute >= 9 * 60 && endMinute <= 12 * 60;
    const fitsAfternoon = startMinute >= 13 * 60 && endMinute <= 18 * 60;

    if (!fitsMorning && !fitsAfternoon) continue;

    const startTime = `${String(Math.floor(startMinute / 60)).padStart(2, '0')}:${String(startMinute % 60).padStart(2, '0')}`;
    const endTime = `${String(Math.floor(endMinute / 60)).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}`;
    const startAt = localDateTimeToEpoch(dateKey, startTime);
    const endAt = localDateTimeToEpoch(dateKey, endTime);
    const candidate = { startAt, endAt };

    if (bookings.some((booking) => intervalsOverlap(candidate, booking))) {
      continue;
    }

    slots.push({
      startAt: formatZonedDateTime(startAt),
      endAt: formatZonedDateTime(endAt),
    });
  }

  return slots;
}

export function normalizePhone(phone: string) {
  if (!/^\+?[\d\s()-]+$/.test(phone)) return null;

  let digits = phone.replace(/\D/g, '');

  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }

  return digits.length === 11 && digits.startsWith('7') ? `+${digits}` : null;
}

export function isMeetingDuration(value: unknown): value is MeetingDuration {
  return meetingDurations.some((duration) => duration === value);
}
