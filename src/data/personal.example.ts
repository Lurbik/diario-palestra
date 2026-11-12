// Esempio di formato per src/data/personal.local.ts (file locale, escluso da Git).
// Copia questo file come personal.local.ts e inserisci i tuoi dati: verranno proposti
// all'avvio e inseriti nel diario solo dopo la tua conferma. Senza il file l'app parte vuota.
import type { Profile } from '../db/settings';

export interface PersonalPain { area: string; selfDescription: string; symptoms: string; summary: string }

export const PERSONAL_PROFILE: Partial<Profile> = { name: 'Nome', age: null, heightCm: null };
export const PERSONAL_PAIN: PersonalPain | null = null;
