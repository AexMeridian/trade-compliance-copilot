// Repairs text whose UTF-8 bytes were read as Windows-1252 and then encoded as UTF-8 again, which turns an en dash into "â€“" and a
// multiplication sign into "Ã—". The audit of November 2026 found this in stored sample reports. It happens wherever a file or pipe is
// decoded with the wrong code page on the way into the database (Windows consoles and PowerShell do it by default); the repo has no code
// that does it, so reads repair the damage instead and a test pins the behaviour. Text that is not damaged is returned unchanged.

const CP1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

function toByte(ch: string): number | null {
  const cp = ch.codePointAt(0)!;
  if (cp <= 0xff) return cp;
  return CP1252_HIGH[cp] ?? null;
}

// A lead character (Â, Ã, â and the other UTF-8 lead bytes read as Latin-1) followed by one to three continuation characters.
const DAMAGED = /[Â-ô][\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘-‚“-„†-•…‰‹›€™]{1,3}/g;

export function repairMojibake(text: string): string {
  if (!/[Â-ô]/.test(text)) return text;
  return text.replace(DAMAGED, (match) => {
    const bytes: number[] = [];
    for (const ch of match) {
      const b = toByte(ch);
      if (b === null) return match;
      bytes.push(b);
    }
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(new Uint8Array(bytes));
    } catch {
      return match;
    }
  });
}

/** True if the text still holds a sequence that looks like UTF-8 read as Windows-1252. */
export function looksMojibake(text: string): boolean {
  return /â€|Ã[\u0080-¿ŒœŠšŸŽžƒˆ˜–—‘-‚“-„†-•…‰‹›€™]/.test(text);
}
