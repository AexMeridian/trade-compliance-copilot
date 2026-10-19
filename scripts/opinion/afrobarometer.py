"""Turns the Afrobarometer Round 10 merged file into src/lib/power/afrobarometer.generated.ts.

Offline only: the Worker never runs this. Download the SPSS merged file from
https://www.afrobarometer.org/data/merged-data/ (Round 10), unzip it, then:

    python scripts/opinion/afrobarometer.py path/to/AB_R10.Merge.sav

Items used (all weighted with the file's within-country household weight, withinwt_hh; every respondent who gave an answer,
don't-know included, is in the base; "not asked in country" and refusals are not):
  Q67b, Q67c: "Overall, does the influence of [China / the United States] on our country have a positive or negative effect?"
  (very/somewhat negative = 1-2, neither = 3, somewhat/very positive = 4-5). Also Q67d Russia, Q67e India, Q67a the former colonial
  power, Q67h the European Union.
  Q68: which country or organization helped most with COVID-19 (shares naming China, the U.S., Russia, Europe, India, the African Union).
  Q69b: which side to take in the Russia-Ukraine war (shares: neutral, Russia, Ukraine).
Only these shares and dates leave this script, never respondent-level rows.
"""
import collections, datetime, json, os, statistics, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from savread import read_meta, read_cases

ISO2 = {
    'Algeria': 'DZ', 'Angola': 'AO', 'Benin': 'BJ', 'Botswana': 'BW', 'Burkina Faso': 'BF', 'Burundi': 'BI', 'Cabo Verde': 'CV',
    'Cameroon': 'CM', 'Central African Republic': 'CF', 'Chad': 'TD', 'Comoros': 'KM', 'Democratic Republic of the Congo': 'CD',
    'Congo-Brazzaville': 'CG', 'Djibouti': 'DJ', 'Egypt': 'EG', 'Equatorial Guinea': 'GQ', 'Eritrea': 'ER', 'Eswatini': 'SZ',
    'Ethiopia': 'ET', 'Gabon': 'GA', 'Gambia, The': 'GM', 'Ghana': 'GH', 'Guinea': 'GN', 'Guinea-Bissau': 'GW', 'Kenya': 'KE',
    'Lesotho': 'LS', 'Liberia': 'LR', 'Libya': 'LY', 'Madagascar': 'MG', 'Malawi': 'MW', 'Mali': 'ML', 'Mauritania': 'MR',
    'Mauritius': 'MU', 'Morocco': 'MA', 'Mozambique': 'MZ', 'Namibia': 'NA', 'Niger': 'NE', 'Nigeria': 'NG', 'Rwanda': 'RW',
    'Senegal': 'SN', 'Seychelles': 'SC', 'Sierra Leone': 'SL', 'Somalia': 'SO', 'South Africa': 'ZA', 'South Sudan': 'SS',
    'Sudan': 'SD', 'Tanzania': 'TZ', 'Togo': 'TG', 'Tunisia': 'TN', 'Uganda': 'UG', 'Zambia': 'ZM', 'Zimbabwe': 'ZW',
    "Côte d'Ivoire": 'CI', 'São Tomé and Príncipe': 'ST',
}
EPOCH = datetime.datetime(1582, 10, 14)  # SPSS dates are seconds since this day


def main(path):
    f = open(path, 'rb')
    meta = read_meta(f)
    vs = {v['name']: v['slot'] for v in meta['vars']}
    cols = [vs[n] for n in ('COUNTRY', 'Q67B', 'Q67C', 'withinwt_hh', 'DATEINTR', 'Q67A', 'Q67D', 'Q67E', 'Q67H', 'Q68', 'Q69B')]
    labels = meta['vlabels']['COUNTRY']
    acc = collections.defaultdict(lambda: collections.defaultdict(float))
    dates = collections.defaultdict(list)
    for row in read_cases(f, meta, cols):
        c, b, u, w, d, q67a, q67d, q67e, q67h, q68, q69b = (row[s] for s in cols)
        if c is None:
            continue
        w = w or 1.0
        for key, val in (('cn', b), ('us', u)):
            if val is None or val in (-1, 8):
                continue
            a = acc[c]
            a['n_' + key] += 1
            a['w_' + key] += w
            if val in (4, 5):
                a['pos_' + key] += w
            elif val in (1, 2):
                a['neg_' + key] += w
        for key, val in (('fc', q67a), ('ru', q67d), ('in', q67e), ('eu', q67h)):
            if val is None or val in (-1, 8, 9994):
                continue
            a = acc[c]
            a['n_' + key] += 1
            a['w_' + key] += w
            if val in (4, 5):
                a['pos_' + key] += w
            elif val in (1, 2):
                a['neg_' + key] += w
        if q68 is not None and q68 in (0, 1, 2, 3, 4, 5, 6, 7, 9):
            a = acc[c]
            a['n_cv'] += 1
            a['w_cv'] += w
            a['cv_%d' % int(q68)] += w
        if q69b is not None and q69b in (1, 2, 3, 4, 9):
            a = acc[c]
            a['n_ua'] += 1
            a['w_ua'] += w
            a['ua_%d' % int(q69b)] += w
        if d:
            dates[c].append(d)
    out = {}
    for c, a in acc.items():
        name = labels[c]
        if name not in ISO2:
            raise SystemExit('no ISO code for ' + name)
        cc = ISO2[name]
        ds = sorted(dates[c])
        t0, t1 = (EPOCH + datetime.timedelta(seconds=ds[0]), EPOCH + datetime.timedelta(seconds=ds[-1]))
        item = {}
        for key in ('cn', 'us'):
            item[key] = {'pos': round(100 * a['pos_' + key] / a['w_' + key]), 'neg': round(100 * a['neg_' + key] / a['w_' + key]), 'n': int(a['n_' + key])}
        for key in ('ru', 'in', 'fc', 'eu'):
            if a['w_' + key] > 0 and a['n_' + key] >= 300:
                item[key] = {'pos': round(100 * a['pos_' + key] / a['w_' + key]), 'neg': round(100 * a['neg_' + key] / a['w_' + key]), 'n': int(a['n_' + key])}
        if a['w_cv'] > 0 and a['n_cv'] >= 300:
            pct = lambda k: round(100 * a['cv_%d' % k] / a['w_cv'])
            item['covid'] = {'china': pct(2), 'us': pct(3), 'russia': pct(4), 'europe': pct(5), 'india': pct(6), 'au': pct(1), 'none': pct(0), 'n': int(a['n_cv'])}
        if a['w_ua'] > 0 and a['n_ua'] >= 300:
            pct = lambda k: round(100 * a['ua_%d' % k] / a['w_ua'])
            item['ukraine'] = {'neutral': pct(1), 'russia': pct(2), 'ukraine': pct(3), 'n': int(a['n_ua'])}
        item['from'] = t0.strftime('%Y-%m-%d')
        item['to'] = t1.strftime('%Y-%m-%d')
        out[cc] = item
    med = {k: round(statistics.median(v[k]['pos'] for v in out.values())) for k in ('cn', 'us')}
    body = json.dumps(dict(sorted(out.items())), indent=2)
    dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'lib', 'power', 'afrobarometer.generated.ts')
    with open(dst, 'w', encoding='utf8') as fh:
        fh.write('// GENERATED by scripts/opinion/afrobarometer.py from the Afrobarometer Round 10 merged file. Do not edit by hand.\n')
        fh.write('// Percent of adults (weighted) saying China\'s / the United States\' influence on their country is positive or negative.\n')
        fh.write('export interface AfroCovid { china: number; us: number; russia: number; europe: number; india: number; au: number; none: number; n: number }\n')
        fh.write('export interface AfroUkraine { neutral: number; russia: number; ukraine: number; n: number }\n')
        fh.write('export interface AfroCountry { cn: AfroShare; us: AfroShare; ru?: AfroShare; in?: AfroShare; fc?: AfroShare; eu?: AfroShare; covid?: AfroCovid; ukraine?: AfroUkraine; from: string; to: string }\n')
        fh.write('export interface AfroShare { pos: number; neg: number; n: number }\n')
        fh.write('export const AFRO_MEDIAN_POSITIVE = %s;\n' % json.dumps(med))
        fh.write('export const AFRO_ROUND10: Record<string, AfroCountry> = %s;\n' % body)
    print(len(out), 'countries; median positive', med)


main(sys.argv[1])
