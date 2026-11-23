// Reads the Commerce Control List (15 CFR Part 774, Supplement No. 1) from the eCFR's XML into one record per ECCN. Pure: no network, so it is
// tested against a small fixture; scripts/build-ccl.ts does the download and writes the migration.
//
// Reasons for control use the convention from migration 0032 and src/lib/exportLicense.ts parseReason:
//   "NS2"   = the entry says "NS applies to entire entry" and the chart column is NS Column 2 (safe to decide on the Country Chart)
//   "NS1?"  = the control applies only to some paragraphs, has an "except" clause, or carries extra conditions
//   "RS?"   = the control is set by country group, by a section other than the chart (UN, worldwide), or has no chart column
//   "VERIFY"= the entry could not be read (no Reason for Control, an ITAR cross-reference): never treated as uncontrolled
// Anything the parser is not sure of is marked "?" or "VERIFY", which the export path turns into "verify" and never into a clear result.

export interface CclRow {
  eccn: string;
  category: string;
  productGroup: string;
  title: string;
  /** Title plus an excerpt of the list of items controlled: what the text search and the model see. Not regulatory text. */
  description: string;
  reasons: string[];
  /** Exceptions the entry says "Yes" to (or gives an LVS value limit for), even if only for some paragraphs: possible exceptions, never granted. Full text in exceptionsText. */
  licenseExceptions: string[];
  /** The "applies to" rows of the Reason for Control table, as published. */
  controlText: string;
  /** The List Based License Exceptions block, as published (LVS, GBS, TSR, STA, ...). */
  exceptionsText: string;
  relatedControls: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d))).replace(/&(\w+);/g, (m, n: string) => ENTITIES[n] ?? m);
// Inline markup (italic, emphasis, superscript) is dropped without a space so "(<E>1</E>)" and "ECCN</I>." read as written; block markup becomes a space.
const clean = (html: string) =>
  decode(html.replace(/<br\s*\/?>(<\/br>)?/gi, ' ').replace(/<\/?(?:I|E|B|SU|SUP|SB|EM|STRONG|A|SPAN)(?:\s[^>]*)?>/gi, '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

const HEADING = /<FP-2>\s*<B>\s*(?=[0-9][A-E][0-9]{3}\b|EAR99\b)/g;

/** The reasons for control from the Reason for Control line and the table beneath it. */
export function parseReasons(ctrl: string): { reasons: string[]; controlText: string } {
  const lineMatch = /<I>\s*Reasons? for Control:?\s*(?:<\/I>)?([\s\S]*?)(?:<\/I>)?\s*<\/FP-1>/i.exec(ctrl);
  let line = lineMatch ? clean(lineMatch[0]).replace(/^Reasons? for Control:?\s*/i, '') : '';
  line = line.split(/Control\(s\)|List Based License Exceptions/i)[0];
  const families = [...new Set([...line.matchAll(/(?<![A-Za-z])([A-Z]{2})(?![A-Za-z])/g)].map((m) => m[1]))];

  const reasons: string[] = [];
  const text: string[] = [];
  const add = (r: string) => {
    if (!reasons.includes(r)) reasons.push(r);
  };
  for (const tr of ctrl.matchAll(/<TR>([\s\S]*?)<\/TR>/g)) {
    const cells = [...tr[1].matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/g)].map((c) => clean(c[1]));
    if (cells.length === 0 || cells.length > 2) continue;
    const [left, right] = cells.length === 2 ? cells : [cells[0], ''];
    const famLeft = /^([A-Z]{2})\b/.exec(left)?.[1] ?? null;
    const cols = [...(right || left).matchAll(/\b([A-Z]{2})\s*Column\s*(\d)\b/g)];
    text.push(cells.length === 2 ? `${left} -> ${right}` : left);
    // Part 746.8 Russian industry sector sanctions are not a Country Chart reason; Russia and Belarus are already handled as restricted destinations.
    if (left === '' || /^Russian industry sector sanctions?\b/i.test(left)) continue;
    // "NS applies to entire entry" alone (or followed, in a one-cell row, by its own column) with nothing else: unconditional.
    const entire = /^[A-Z]{2} applies to (?:the )?entire entry\.?(?:\s+[A-Z]{2} Column \d\.?)?$/i.test(left.replace(/\s*\((?:refer to|see)\b[^)]*\)/gi, ''));
    if (cols.length > 0) {
      const extra = (right || '').replace(/\b[A-Z]{2}\s*Column\s*\d\b/g, '').replace(/[\s.,;]/g, '');
      for (const m of cols) add(`${m[1]}${m[2]}${entire && m[1] === famLeft && extra === '' ? '' : '?'}`);
    } else if (famLeft) {
      add(`${famLeft}?`);
    } else {
      add('VERIFY');
    }
  }
  // A family named in the Reason for Control line that no table row settled (CW and AT in 1C350, SS, SL, EI, UN without a column): paragraph/group based.
  const covered = new Set(reasons.map((r) => r.slice(0, 2)));
  for (const f of families) if (!covered.has(f)) add(`${f}?`);
  // Unconditional beats conditional for the same family and column.
  const out = reasons.filter((r) => !(r.endsWith('?') && reasons.includes(r.slice(0, -1))));
  if (out.length === 0) return { reasons: ['VERIFY'], controlText: text.join('; ') };
  return { reasons: out, controlText: text.join('; ') };
}

/** The List Based License Exceptions block: labelled lines (LVS, GBS, TSR, STA, ...) with their continuation lines. */
export function parseExceptions(ctrl: string): { codes: string[]; text: string } {
  const start = ctrl.search(/List Based License Exceptions/i);
  if (start < 0) return { codes: [], text: '' };
  const entries: { label: string; value: string }[] = [];
  for (const m of ctrl.slice(start).matchAll(/<FP-1>([\s\S]*?)<\/FP-1>/g)) {
    const raw = m[1];
    const t = clean(raw);
    if (/^<E /.test(raw.trim()) || t === '') continue; // sub-headings such as "Special Conditions for STA"
    const lab = /^<I>\s*([A-Z]{3}(?:\/[A-Z]{3})?)\s*:?\s*<\/I>\s*:?|^<I>\s*([A-Z]{3}(?:\/[A-Z]{3})?)\s*:\s*/.exec(raw.trim());
    if (lab) entries.push({ label: lab[1] ?? lab[2], value: clean(raw.trim().slice(lab[0].length)) || clean(raw).replace(/^[A-Z/]{3,7}:?\s*/, '') });
    else if (entries.length > 0 && /^(Yes|N\/A|\$|[A-Z])/.test(t)) entries[entries.length - 1].value += ' ' + t;
  }
  // Candidates, not grants: an exception the entry says "Yes" to (possibly only for some paragraphs, or with a value limit for LVS). The app always says "verify".
  const codes = entries.filter((e) => /^(Yes\b|\$)/i.test(e.value.trim())).map((e) => e.label);
  return { codes: [...new Set(codes)], text: clip(entries.map((e) => `${e.label}: ${e.value}`).join(' | '), 2400) };
}

/** Parses the whole of Part 774's XML (or just the supplement). Throws when the layout is not the one this parser knows, so a change stops the build. */
export function parseCcl(xml: string, minEntries = 400): CclRow[] {
  const s1 = xml.indexOf('N="Supplement No. 1 to Part 774"');
  const s2 = xml.indexOf('N="Supplement No. 2 to Part 774"');
  const body = s1 >= 0 ? xml.slice(s1, s2 > s1 ? s2 : undefined) : xml;
  const starts = [...body.matchAll(HEADING)].map((m) => m.index!);
  if (starts.length === 0) throw new Error('No ECCN headings found in the Commerce Control List XML');
  const rows: CclRow[] = [];
  const seen = new Set<string>();
  starts.forEach((from, i) => {
    let part = body.slice(from, starts[i + 1] ?? body.length);
    const hd = part.search(/<HD\d/); // the next category or product-group heading is not part of this entry
    const head = /^<FP-2>([\s\S]*?)<\/FP-2>/.exec(part);
    if (!head) return;
    if (hd > 0) part = part.slice(0, hd);
    const full = clean(head[1]);
    const code = /^([0-9][A-E][0-9]{3})\b/.exec(full)?.[1];
    if (!code) return; // EAR99 headings
    if (seen.has(code)) throw new Error(`ECCN ${code} appears twice in the Commerce Control List XML`);
    seen.add(code);
    const title = clip(full.slice(code.length).replace(/\(\s*see list of items controlled\s*\)\.?/i, '').replace(/\s+/g, ' ').replace(/^[\s—-]+/, '').trim().replace(/[.:]$/, ''), 600);
    const rest = part.slice(head[0].length);
    const listAt = rest.search(/>\s*List of Items Controlled\s*</i);
    const ctrl = listAt >= 0 ? rest.slice(0, listAt) : (rest.split(/<FP><I>\s*Items:/)[0] ?? rest);
    const { reasons, controlText } = parseReasons(ctrl);
    const ex = parseExceptions(ctrl);
    const after = listAt >= 0 ? rest.slice(listAt) : rest;
    const rel = /<I>\s*Related Controls:?\s*<\/I>([\s\S]*?)<\/(?:FP-1|P)>/i.exec(after);
    const itemsAt = after.search(/<FP><I>\s*Items:?\s*<\/I>/);
    let items = itemsAt >= 0 ? clean(after.slice(itemsAt)).replace(/^Items:\s*/i, '') : '';
    if (/list of items controlled is contained in the ECCN heading/i.test(items)) items = '';
    const description = clip(items ? `${title}. Items: ${items}` : title, 900);
    rows.push({
      eccn: code,
      category: code[0],
      productGroup: code[1],
      title,
      description,
      reasons,
      licenseExceptions: ex.codes,
      controlText: clip(controlText, 2000),
      exceptionsText: ex.text,
      relatedControls: rel ? clip(clean(rel[1]).replace(/^N\/A$/i, ''), 1500) : '',
    });
  });
  if (rows.length < minEntries) throw new Error(`Only ${rows.length} ECCNs parsed from the Commerce Control List; expected about 640`);
  return rows;
}
