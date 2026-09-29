// Every time the app shows is in Canberra time, whatever timezone the server
// runs in (0046): times are stored as instants and formatted here.
const CANBERRA = "Australia/Sydney";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CANBERRA,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "Mon 28 Sep, 14:05". Assembled from parts, so it doesn't depend on the
// punctuation a locale's own pattern would add; en-US because its short
// month names are always three letters ("Sep"; en-AU says "Sept").
export function formatCanberra(instant: Date): string {
  const part = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  return `${part.weekday} ${part.day} ${part.month}, ${part.hour}:${part.minute}`;
}
