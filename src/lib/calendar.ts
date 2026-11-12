// Dated chores that no feed announces, listed in the weekly digest when they are close. Pure: takes today's date and returns lines.
import { FEE_SCHEDULE } from './customsFees.js';

export interface Reminder {
  due: string; // YYYY-MM-DD
  text: string;
}

const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

/** Parses "name:YYYY-MM-DD,name:YYYY-MM-DD" (the REMINDER_DATES variable) into reminders; malformed entries are ignored. */
export function parseReminderDates(raw: string | undefined): Reminder[] {
  return (raw ?? '')
    .split(',')
    .map((part) => part.trim().split(':'))
    .filter((p): p is [string, string] => p.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(p[1].trim()))
    .map(([name, due]) => ({ due: due.trim(), text: `${name.trim()} is due` }));
}

/** Recurring and configured chores whose date falls within `windowDays` of `today`. */
export function upcomingChores(today: string, windowDays: number, extra: Reminder[] = []): Reminder[] {
  const year = Number(today.slice(0, 4));
  const candidates: Reminder[] = [];
  for (const y of [year, year + 1]) {
    candidates.push(
      { due: `${y}-10-01`, text: `CBP changes the merchandise processing fee limits on October 1. Check the new limits and update FEE_SCHEDULE in src/lib/customsFees.ts.` },
      { due: `${y}-01-01`, text: `The HTS publishes its annual revision. The weekly reload picks it up; check that the canary checks and tests still pass.` },
      { due: `${y}-07-01`, text: `USMCA joint review anniversary. Check for changes to rules of origin (General Note 11) and update usmca_rules if needed.` }
    );
  }
  const lastCovered = FEE_SCHEDULE[FEE_SCHEDULE.length - 1].to;
  candidates.push({ due: lastCovered, text: `The CBP fee schedule in src/lib/customsFees.ts ends on ${lastCovered}; after that the calculator gives no MPF dollar figure.` });
  const end = addDays(today, windowDays);
  return [...candidates, ...extra].filter((r) => r.due >= today && r.due <= end).sort((a, b) => a.due.localeCompare(b.due));
}
