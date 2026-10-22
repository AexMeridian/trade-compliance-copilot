"""Pew Research Center toplines -> per-country trends of the share with a favorable view of the United States and of China.

Pew publishes each Global Attitudes survey with a "topline" table listing every country's result for every year the question was asked.
This script reads the text of those PDFs (extract each with pdfplumber first, one "=== PAGE n ===" header per page) and writes
src/lib/power/pewTrends.generated.ts. Only the "very or somewhat favorable" total is kept, one value per country and year (the spring
survey when a year has more than one, then summer); the separate "trends for comparison" tables (other survey modes) are skipped.

Usage:
  python scripts/opinion/pew_trends.py <output .ts> US=<us topline text>:Q3a CN=<china report text>:Q3b

Sources (download the PDFs, then extract the text):
  US: Pew Research Center, Spring 2026 Global Attitudes Survey, U.S. image topline, June 23, 2026 release
      https://www.pewresearch.org/wp-content/uploads/sites/20/2026/06/pg_2026.06.23_us-image-2026_topline.pdf
  CN: Pew Research Center, "Views of China and Xi Are Improving Globally", July 15, 2026 report (topline in its appendix)
      https://www.pewresearch.org/wp-content/uploads/sites/20/2026/07/pg_2026.06.15_global-views-china-2026_report.pdf
"""
import json
import re
import sys

# Pew's country names as printed in the toplines -> ISO 3166 alpha-2.
CODES = {
    'Argentina': 'AR', 'Australia': 'AU', 'Bangladesh': 'BD', 'Brazil': 'BR', 'Canada': 'CA', 'Chile': 'CL', 'Colombia': 'CO',
    'France': 'FR', 'Germany': 'DE', 'Ghana': 'GH', 'Greece': 'GR', 'Hungary': 'HU', 'India': 'IN', 'Indonesia': 'ID',
    'Israel': 'IL', 'Italy': 'IT', 'Japan': 'JP', 'Kenya': 'KE', 'Malaysia': 'MY', 'Mexico': 'MX', 'Netherlands': 'NL',
    'Nigeria': 'NG', 'Pakistan': 'PK', 'Peru': 'PE', 'Philippines': 'PH', 'Poland': 'PL', 'Russia': 'RU', 'South Africa': 'ZA',
    'South Korea': 'KR', 'Spain': 'ES', 'Sri Lanka': 'LK', 'Sweden': 'SE', 'Thailand': 'TH', 'Tunisia': 'TN', 'Turkey': 'TR',
    'Türkiye': 'TR', 'Ukraine': 'UA', 'United Kingdom': 'GB', 'U.K.': 'GB', 'U.S.': 'US', 'Vietnam': 'VN', 'Jordan': 'JO',
    'Lebanon': 'LB', 'Egypt': 'EG', 'Tanzania': 'TZ', 'Uganda': 'UG', 'Senegal': 'SN', 'Venezuela': 'VE', 'Bolivia': 'BO',
    'El Salvador': 'SV', 'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Slovakia': 'SK', 'Bulgaria': 'BG', 'Lithuania': 'LT',
    'Ethiopia': 'ET', 'Singapore': 'SG', 'Taiwan': 'TW', 'Saudi Arabia': 'SA', 'Romania': 'RO', 'Portugal': 'PT', 'Ireland': 'IE',
    'Switzerland': 'CH', 'Denmark': 'DK', 'Finland': 'FI', 'Norway': 'NO', 'Belgium': 'BE', 'Austria': 'AT', 'New Zealand': 'NZ',
    'Morocco': 'MA', 'Algeria': 'DZ', 'Iraq': 'IQ', 'Kuwait': 'KW', 'Qatar': 'QA', 'Zambia': 'ZM', 'Zimbabwe': 'ZW',
    'Cameroon': 'CM', 'Ivory Coast': 'CI', "Côte d'Ivoire": 'CI', 'Burkina Faso': 'BF', 'Mauritius': 'MU', 'Malawi': 'MW',
}
ROW = re.compile(r'^(?:(?P<country>[A-Za-zÀ-ÿ\.\' ]+?) )?(?P<season>Spring|Summer|Fall|May|March|April|June|Winter), (?P<year>\d{4}) (?P<nums>[\d ]+)$')


def parse(text, question):
    start = text.find(question + '. Please tell me if you have a very favorable')
    if start < 0:
        raise SystemExit('question %s not found' % question)
    body = text[start:]
    # The main table ends where the first mode-comparison table or the next question starts. Every page repeats the question
    # header, so look for a header with a different question number.
    other = re.search(r'\n(?!' + re.escape(question) + r'\.)Q\d+[a-z]?\. ', body)
    ends = [i for i in (body.find('TRENDS FOR COMPARISON'), other.start() if other else -1) if i > 0]
    body = body[: min(ends)] if ends else body
    country = None
    out = {}
    for line in body.splitlines():
        m = ROW.match(line.strip())
        if not m:
            continue
        nums = [int(x) for x in m.group('nums').split()]
        if len(nums) < 8:
            continue
        if m.group('country'):
            country = m.group('country').strip()
        if country is None:
            continue
        year = int(m.group('year'))
        # A year can have several rows (Summer and Fall 2020): keep the spring survey, then summer, then whatever came first.
        rank = {'Spring': 0, 'Summer': 1}.get(m.group('season'), 2)
        slot = out.setdefault(country, {})
        if year not in slot or rank < slot[year][1]:
            slot[year] = (nums[0], rank)
    return {c: {y: v[0] for y, v in ys.items()} for c, ys in out.items()}


def main():
    dst = sys.argv[1]
    blocks = []
    for spec in sys.argv[2:]:
        name, rest = spec.split('=', 1)
        src, question = rest.rsplit(':', 1)
        data = parse(open(src, encoding='utf8').read(), question)
        missing = [c for c in data if c not in CODES]
        if missing:
            raise SystemExit('unmapped country names: %s' % missing)
        result = {CODES[c]: sorted(v.items()) for c, v in data.items()}
        print(name, len(result), 'countries,', sum(len(v) for v in result.values()), 'points')
        const = {'US': 'PEW_US_FAVORABLE', 'CN': 'PEW_CN_FAVORABLE'}[name]
        blocks.append('export const %s: Record<string, [number, number][]> = %s;' % (const, json.dumps(result, separators=(',', ':'))))
    lines = [
        '// GENERATED by scripts/opinion/pew_trends.py from Pew Research Center Spring 2026 Global Attitudes Survey toplines',
        '// (U.S. image topline, June 23, 2026; China report, July 15, 2026). Do not edit by hand. Share with a very or somewhat',
        '// favorable view of the United States (PEW_US_FAVORABLE) and of China (PEW_CN_FAVORABLE), by country code and year:',
        '// [year, percent]. The U.S. entry in the China table is the American public. Pew bears no responsibility for the analyses',
        '// or interpretations presented here.',
        *blocks,
        '',
    ]
    open(dst, 'w', encoding='utf8', newline='\n').write('\n'.join(lines))


if __name__ == '__main__':
    main()
