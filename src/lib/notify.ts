// Promemoria. In PWA: solo promemoria dentro l'app + esportazione calendario (le notifiche a app chiusa
// non sono affidabili senza push server, e setTimeout non garantisce nulla). Nell'app Android (Capacitor)
// si usano notifiche locali programmate, soggette a permessi e limiti del sistema (risparmio energetico).
import type { Reminder } from '../db/settings';
import { isNative } from './pwa';

const inQuiet = (time: string, from: string, to: string) => (from <= to ? time >= from && time < to : time >= from || time < to);

export async function syncNativeReminders(reminders: Reminder[], quietFrom: string, quietTo: string): Promise<string> {
  if (!isNative()) return 'Versione web: promemoria visibili dentro l\'app ed esportabili nel calendario. Notifiche ad app chiusa non garantite.';
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return 'Permesso notifiche negato: puoi abilitarlo dalle impostazioni di Android.';
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  const list = [];
  let id = 1;
  for (const r of reminders.filter((x) => x.enabled && !inQuiet(x.time, quietFrom, quietTo))) {
    const [hour, minute] = r.time.split(':').map(Number);
    for (const wd of r.weekdays) {
      // Capacitor: weekday 1 = domenica … 7 = sabato
      list.push({ id: id++, title: 'Promemoria', body: r.label, schedule: { on: { weekday: (wd % 7) + 1, hour, minute }, allowWhileIdle: true } });
    }
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list });
  return `${list.length} notifiche locali programmate (consegna soggetta a permessi e risparmio energetico di Android).`;
}

export { inQuiet };
