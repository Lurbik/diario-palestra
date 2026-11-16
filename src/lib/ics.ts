// Esportazione calendario (.ics) con fuso Europe/Rome: alternativa affidabile alle notifiche PWA.
import { addDays, weekdayOf } from './dates';

const VTZ = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Rome',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE'
];
const BYDAY = ['', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const esc = (s: string) => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

export interface IcsEvent { uid: string; title: string; weekday: number; start: string; durationMin: number; description?: string }

export function buildIcs(events: IcsEvent[], fromDate: string): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Diario Palestra//IT', 'CALSCALE:GREGORIAN', ...VTZ];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  for (const e of events) {
    let d = fromDate;
    while (weekdayOf(d) !== e.weekday) d = addDays(d, 1);
    const [h, m] = e.start.split(':').map(Number);
    const endMin = h * 60 + m + e.durationMin;
    const ymd = d.replace(/-/g, '');
    // Un evento che passa la mezzanotte finisce il giorno dopo (es. 23:30 + 60 min → 00:30 del giorno successivo)
    const endYmd = addDays(d, Math.floor(endMin / 1440)).replace(/-/g, '');
    const t = (mins: number) => `${String(Math.floor((mins % 1440) / 60)).padStart(2, '0')}${String(mins % 60).padStart(2, '0')}00`;
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@diario-palestra.local`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/Rome:${ymd}T${t(h * 60 + m)}`, `DTEND;TZID=Europe/Rome:${endYmd}T${t(endMin)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[e.weekday]}`, `SUMMARY:${esc(e.title)}`, ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []), 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
