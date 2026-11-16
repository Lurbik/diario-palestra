// Ricerca globale (modalità globale del selettore unico): esercizi, schede, muscoli, alimenti, ricette, macchine.
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { go } from '../ui/kit';
import { Picker, exercisePickItems, type PickItem } from '../ui/Picker';
import { STRUCTURES } from '../catalog/anatomy3d';
import { WEEKDAYS } from '../lib/dates';

export function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<PickItem[]>([]);
  useEffect(() => {
    (async () => {
      const [ex, programs, foods, recipes, machines] = await Promise.all([exercisePickItems(), db.programs.toArray(), db.foods.toArray(), db.recipes.toArray(), db.machines.toArray()]);
      setItems([
        ...ex,
        ...programs.filter((p) => !p.archived).map((p) => ({ id: 'p:' + p.id, kind: 'program', name: p.name, subtitle: `${p.days.length} giorni${p.isActive ? ' · attiva' : ''}${p.kind === 'template' ? ' · consigliata' : ''}`, extra: p.days.map((d) => `${d.name} ${d.weekday ? WEEKDAYS[d.weekday] : ''}`).join(' '), facets: { type: 'program' } })),
        ...STRUCTURES.map((s) => ({ id: 'm:' + s.key, kind: 'muscle', name: s.it, aliases: [s.latin, ...s.synonyms], subtitle: s.region, facets: { type: 'muscle' } })),
        ...foods.filter((f) => !f.archived).map((f) => ({ id: 'f:' + f.id, kind: 'food', name: f.name, aliases: f.synonyms ?? [], extra: f.brand, facets: { type: 'food' } })),
        ...recipes.filter((r) => !r.archived).map((r) => ({ id: 'r:' + r.id, kind: 'recipe', name: r.name, subtitle: r.activeMin != null ? `${r.activeMin} min attivi` : undefined, facets: { type: 'recipe' } })),
        ...machines.map((m) => ({ id: 'k:' + m.id, kind: 'machine', name: m.name, extra: m.category, facets: { type: 'machine' } }))
      ].map((x) => ({ ...x, facets: { ...x.facets, type: x.kind } })));
    })();
  }, []);
  const open = (x: PickItem) => {
    const [pre, ...rest] = x.id.includes(':') ? x.id.split(':') : ['e', x.id];
    const id = rest.join(':') || x.id;
    onClose();
    if (x.kind === 'exercise') go(`allenamento/esercizio/${x.id}`);
    else if (pre === 'p') go(`allenamento/scheda/${id}`);
    else if (pre === 'm') go(`progressi/atlante/${id}`);
    else if (pre === 'f') go(`cibo/diario`);
    else if (pre === 'r') go(`cibo/ricetta/${id}`);
    else if (pre === 'k') go('allenamento/catalogo');
  };
  return (
    <Picker title="Cerca" recentKey="global" items={items} onClose={onClose} onPick={(x) => open(x[0])}
      filters={[{ key: 'type', label: 'Tipo', options: [{ value: 'exercise', label: 'Esercizi' }, { value: 'program', label: 'Schede' }, { value: 'muscle', label: 'Muscoli' }, { value: 'food', label: 'Alimenti' }, { value: 'recipe', label: 'Ricette' }, { value: 'machine', label: 'Macchine' }] }]} />
  );
}
