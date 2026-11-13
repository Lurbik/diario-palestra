// Controllo privacy della build pubblicabile: cerca nella cartella dist/ e nei file tracciati da Git
// i termini elencati in private/forbidden-terms.txt (file locale, escluso da Git: la lista stessa
// contiene dati personali e non va pubblicata). Uscita con errore se trova corrispondenze.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const LIST = 'private/forbidden-terms.txt';
if (!existsSync(LIST)) { console.log('Nessuna lista privata di termini (private/forbidden-terms.txt): controllo saltato.'); process.exit(0); }
const terms = readFileSync(LIST, 'utf8').split(/\r?\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#'));
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
if (existsSync('dist')) walk('dist');
const tracked = execSync('git ls-files').toString().split('\n').filter(Boolean);
let hits = 0;
for (const f of [...files, ...tracked]) {
  let txt; try { txt = readFileSync(f, 'utf8'); } catch { continue; }
  for (const t of terms) if (txt.toLowerCase().includes(t.toLowerCase())) { console.error(`TROVATO "${t}" in ${f}`); hits++; }
}
console.log(`${files.length} file di build + ${tracked.length} file tracciati controllati per ${terms.length} termini: ${hits} corrispondenze.`);
process.exit(hits ? 1 : 0);
