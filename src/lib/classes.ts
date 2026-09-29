// The six COMP4020 crit-group sessions students swap between (0008, 0010),
// copied from the course's public crit-groups API and committed here: the app
// never fetches them at runtime. The source is provisional until enrolments
// settle, so this file can go stale — CLASSES_ACCESSED says when it was
// copied. Credited in README.md.
export const CLASSES_SOURCE = "https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/api/crit-groups.json";
export const CLASSES_ACCESSED = "2026-09-29";

const ROOM = "Marie Reay Building (155), Room 4.03";

// `id` is the source's group id; the order here is the order the app lists
// classes in.
export const CLASSES = [
  { id: "shitao", day: "Mon", start: "14:00", end: "15:30", room: ROOM, tutor: "Ushini Attanayake" },
  { id: "bada", day: "Mon", start: "15:30", end: "17:00", room: ROOM, tutor: "Ushini Attanayake" },
  { id: "baishi", day: "Wed", start: "09:00", end: "10:30", room: ROOM, tutor: "Tom Griffiths" },
  { id: "dachi", day: "Wed", start: "10:30", end: "12:00", room: ROOM, tutor: "Tom Griffiths" },
  { id: "yunlin", day: "Wed", start: "14:00", end: "15:30", room: ROOM, tutor: "Bill McAlister" },
  { id: "liuru", day: "Wed", start: "15:30", end: "17:00", room: ROOM, tutor: "Bill McAlister" },
] as const;

export type ClassId = (typeof CLASSES)[number]["id"];

// How a class is named on screen: by day and time, as students refer to it
// (0038).
export function classLabel(c: { day: string; start: string; end: string }): string {
  return `${c.day} ${c.start}–${c.end}`;
}
