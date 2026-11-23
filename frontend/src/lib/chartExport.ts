// Turns a chart already drawn on the page (an inline SVG) into a downloadable image that carries its own title, source, as-of date and
// permalink. Browser only, no dependency: the SVG is copied with its resolved styles written onto each element (the page's colors come from
// CSS variables, which a standalone file cannot see), framed with a title and a footer, then either saved as SVG or drawn onto a canvas for PNG.

export interface ExportMeta {
  title: string;
  source: string;
  asOf?: string;
  url: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing',
];

/** The chart to export from inside a container: the largest chart-like SVG that is not an icon or a decorative sparkline. */
export function findChartSvg(container: Element | null): SVGSVGElement | null {
  if (!container) return null;
  let best: SVGSVGElement | null = null;
  let bestArea = 0;
  container.querySelectorAll('svg').forEach((svg) => {
    if (svg.closest('[data-chart-export-ui]')) return;
    const r = svg.getBoundingClientRect();
    const isChart = svg.getAttribute('role') === 'img' || svg.getAttribute('aria-hidden') !== 'true';
    if (!isChart || r.width < 160 || r.height < 70) return;
    if (r.width * r.height > bestArea) {
      best = svg;
      bestArea = r.width * r.height;
    }
  });
  return best;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'chart';

function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > maxChars) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

function inlineStyles(from: Element, to: Element) {
  const a = [from, ...from.querySelectorAll('*')];
  const b = [to, ...to.querySelectorAll('*')];
  a.forEach((el, i) => {
    const target = b[i] as SVGElement | undefined;
    if (!target) return;
    const cs = getComputedStyle(el);
    for (const p of STYLE_PROPS) {
      const v = cs.getPropertyValue(p);
      if (v) target.style.setProperty(p, v);
    }
    target.removeAttribute('class');
    target.removeAttribute('tabindex');
  });
}

function textEl(text: string, x: number, y: number, size: number, weight: number, fill: string, family: string): SVGTextElement {
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', String(x));
  t.setAttribute('y', String(y));
  t.setAttribute('font-size', String(size));
  t.setAttribute('font-weight', String(weight));
  t.setAttribute('fill', fill);
  t.setAttribute('font-family', family);
  t.textContent = text;
  return t;
}

/** A standalone SVG (title above, source and as-of date and link below) and its pixel size. */
export function buildExportSvg(svg: SVGSVGElement, meta: ExportMeta): { markup: string; width: number; height: number } {
  const rect = svg.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('preserveAspectRatio', 'none');
  clone.removeAttribute('role');
  clone.removeAttribute('aria-label');
  clone.style.removeProperty('opacity');

  const body = getComputedStyle(document.body);
  const family = body.fontFamily || 'sans-serif';
  const ink = body.color || '#111';
  const bg = /rgba?\(0,\s*0,\s*0,\s*0\)|transparent/.test(body.backgroundColor) ? '#ffffff' : body.backgroundColor;
  const pad = 16;
  const innerW = Math.max(w, 360);
  const charsPerLine = Math.floor((innerW + 0) / 6.2);
  const titleLines = wrap(meta.title, Math.floor(innerW / 8.4));
  const footLines = [
    ...wrap(`Source: ${meta.source}${meta.asOf ? `. As of ${meta.asOf}.` : ''}`, charsPerLine),
    ...wrap(`${meta.url}`, charsPerLine),
    'Aex Terminal (aexterminal.com). Not legal advice.',
  ];
  const headH = titleLines.length * 20 + 6;
  const footH = footLines.length * 15 + 8;
  const totalW = innerW + pad * 2;
  const totalH = pad + headH + h + footH + pad;

  const out = document.createElementNS(SVG_NS, 'svg');
  out.setAttribute('xmlns', SVG_NS);
  out.setAttribute('width', String(totalW));
  out.setAttribute('height', String(totalH));
  out.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
  const bgRect = document.createElementNS(SVG_NS, 'rect');
  bgRect.setAttribute('width', '100%');
  bgRect.setAttribute('height', '100%');
  bgRect.setAttribute('fill', bg);
  out.appendChild(bgRect);
  titleLines.forEach((l, i) => out.appendChild(textEl(l, pad, pad + 15 + i * 20, 15, 700, ink, family)));
  clone.setAttribute('x', String(pad + (innerW - w) / 2));
  clone.setAttribute('y', String(pad + headH));
  out.appendChild(clone);
  footLines.forEach((l, i) => out.appendChild(textEl(l, pad, pad + headH + h + 16 + i * 15, 11, 400, ink, family)));
  return { markup: new XMLSerializer().serializeToString(out), width: totalW, height: totalH };
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadSvg(svg: SVGSVGElement, meta: ExportMeta, filename: string) {
  const { markup } = buildExportSvg(svg, meta);
  save(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${markup}`], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`);
}

export async function downloadPng(svg: SVGSVGElement, meta: ExportMeta, filename: string): Promise<void> {
  const { markup, width, height } = buildExportSvg(svg, meta);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The chart could not be drawn to an image.'));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image export is not available in this browser.');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Image export is not available in this browser.');
    save(blob, `${filename}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
