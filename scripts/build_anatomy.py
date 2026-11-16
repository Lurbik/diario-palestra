"""Prepara l'SVG anatomico per l'atlante dell'app (strumento di sviluppo, riproducibile).

Fonte: "Muscles front and back.svg" — OpenStax & Tomáš Kebert & umimeto.org, Wikimedia Commons,
licenza CC BY-SA 4.0 (https://commons.wikimedia.org/wiki/File:Muscles_front_and_back.svg).
Modifiche (stessa licenza CC BY-SA 4.0): copie specchiate (<use>) che contengono strutture etichettate trasformate in elementi reali,
metadati dell'editor rimossi, attributi data-s aggiunti alle strutture identificate.

Uso: tools/.venv/Scripts/python.exe scripts/build_anatomy.py
Input: tools/anatomy/Muscles_front_and_back.svg (scaricato da Wikimedia Commons)
Output: src/assets/anatomy/muscles-front-back.svg
"""
import json
from playwright.sync_api import sync_playwright

SRC = 'tools/anatomy/Muscles_front_and_back.svg'
OUT = 'src/assets/anatomy/muscles-front-back.svg'

# Indice del tracciato (ordine nel file originale) → struttura. Identificazione visiva verificata a schermo.
TAGS = {
    77: 'deltoide', 152: 'deltoide',
    86: 'pettorale_clavicolare', 80: 'pettorale_sternocostale',
    26: 'retto_femorale', 23: 'vasti', 30: 'vasto_laterale',
    33: 'sartorio', 24: 'adduttori', 25: 'adduttori',
}

HEADER = ('<!-- Atlante: "Muscles front and back" di OpenStax & Tomáš Kebert & umimeto.org (Wikimedia Commons), '
          'CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/ . Adattato per Diario Palestra: '
          'copie specchiate rese elementi reali, metadati dell\'editor rimossi, strutture etichettate (data-s). '
          'Questo adattamento è distribuito con la stessa licenza CC BY-SA 4.0. -->\n')

svg = open(SRC, encoding='utf-8').read()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.set_content('<html><body></body></html>')
    out = pg.evaluate("""([src, tags]) => {
      const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
      const svg = doc.documentElement;
      // 1) etichette sui tracciati originali (prima di duplicare)
      const paths = [...svg.querySelectorAll('path')];
      for (const [i, s] of Object.entries(tags)) paths[+i].setAttribute('data-s', s);
      // 2) <use> → copia reale (anche annidati)
      for (let guard = 0; guard < 20; guard++) {
        const uses = [...svg.querySelectorAll('use:not([data-keep])')];
        if (!uses.length) break;
        for (const u of uses) {
          const ref = u.getAttribute('xlink:href') || u.getAttribute('href');
          const target = ref && svg.querySelector(ref);
          if (!target) { u.remove(); continue; }
          // solo le copie che contengono strutture etichettate: il resto resta identico all'originale
          if (!(target.matches('[data-s]') || target.querySelector('[data-s]'))) { u.setAttribute('data-keep', '1'); continue; }
          const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
          const tf = [u.getAttribute('transform'), (u.getAttribute('x') || u.getAttribute('y')) ? `translate(${u.getAttribute('x') || 0},${u.getAttribute('y') || 0})` : null].filter(Boolean).join(' ');
          if (tf) g.setAttribute('transform', tf);
          for (const a of ['style', 'class', 'fill', 'stroke']) if (u.getAttribute(a)) g.setAttribute(a, u.getAttribute(a));
          const c = target.cloneNode(true);
          c.removeAttribute('id'); c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
          g.appendChild(c); u.replaceWith(g);
        }
      }
      // 3) pulizia: metadati e attributi dell'editor
      svg.querySelectorAll('metadata, sodipodi\\\\:namedview').forEach((n) => n.remove());
      [...svg.getElementsByTagName('*')].forEach((n) => { if (n.tagName.includes(':')) n.remove(); });
      for (const n of [svg, ...svg.getElementsByTagName('*')]) for (const a of [...n.attributes]) {
        if (a.name.startsWith('inkscape:') || a.name.startsWith('sodipodi:')) n.removeAttribute(a.name);
      }
      svg.querySelectorAll('[data-s]').forEach((n) => n.setAttribute('class', 'atlas-s'));
      svg.querySelectorAll('[data-keep]').forEach((n) => n.removeAttribute('data-keep'));
      svg.removeAttribute('width'); svg.removeAttribute('height');
      svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Muscoli, vista anteriore e posteriore');
      let s = new XMLSerializer().serializeToString(svg);
      s = s.replace(/ xmlns:(inkscape|sodipodi|dc|cc|rdf)="[^"]*"/g, '');
      return { s, tagged: svg.querySelectorAll('[data-s]').length };
    }""", [svg, {str(k): v for k, v in TAGS.items()}])
    b.close()
open(OUT, 'w', encoding='utf-8').write(HEADER + out['s'])
print(json.dumps({'tagged_elements': out['tagged'], 'bytes': len(HEADER + out['s'])}))
