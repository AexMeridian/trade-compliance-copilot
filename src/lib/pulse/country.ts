// Best-effort, text-derived country tagging -- NOT authoritative jurisdiction
// data. The Federal Register API has no country field on a document, and
// general news feeds (lib/pulse/newsTag.ts) have none either; this regexes
// the title/abstract/headline for country names instead. Verified against
// real synced Federal Register titles before the original ~32-country list
// was written (antidumping/CVD titles follow consistent USITC/Commerce
// nomenclature, e.g. "Certain Brake Drums From the People's Republic of
// China", "... From Canada, the People's Republic of China, India, the
// Republic of Korea, and Mexico") -- both bare short names and official
// long-form names appear in the same title, sometimes in the same list, so
// entries that need it match both. A document/headline naming zero, one, or
// several countries is all expected -- this is a coverage aid, not a claim
// that every action has a country.
//
// Extended from ~32 to effectively every country in lib/worldCountries.ts
// (the frontend's crosswalk) so the globe's now-clickable-everywhere cards
// (PulseGlobe.tsx) have a real path to tagged news/actions for any country,
// not just the original hand-picked set. Deliberately still conservative
// about *which* names to match, the same standard the original list set:
// only names unlikely to collide with something else common in this domain.
// Left out on purpose, same bar as the original "no Georgia" call (it reads
// as the U.S. state far more often than the country in this text):
//   - Georgia (GE) -- the original exclusion; still true.
//   - Jordan (JO) -- "Jordan" is one of the most common personal names/
//     brand names (Air Jordan, Michael Jordan) in American English text;
//     the country would be a small minority of real matches in free-text
//     news headlines, this list's biggest new consumer.
//   - Chad (TD) -- same problem as Jordan: an extremely common personal
//     first name, country a small minority of real matches.
//   - Puerto Rico (PR) -- a U.S. territory, not a foreign jurisdiction this
//     app's trade-policy/sanctions/export-control model applies to (same
//     reasoning as 'US' itself never being a taggable code).
//   - French Southern and Antarctic Lands (TF) and New Caledonia (NC) --
//     uninhabited/small French overseas territories, not realistic subjects
//     of a U.S. trade action or a news headline in this feed's history.
//   - Western Sahara (EH) -- disputed territory with no government this
//     app's per-country facts (tariffs, sanctions, blocs) could attach to.
// A name whose country sense still risks a real collision was narrowed
// instead of dropped, with a negative lookaround rather than a guess:
//   - Guinea/Equatorial Guinea/Guinea-Bissau/Papua New Guinea all share the
//     substring "Guinea" -- each gets a pattern that only fires for its own
//     form.
//   - Congo/Democratic Republic of the Congo share the substring "Congo" --
//     same treatment.
//   - Sudan/South Sudan share the substring "Sudan" -- same treatment.
//   - North Macedonia requires the full "North Macedonia" (not bare
//     "Macedonia", which is also the name of a region of Greece).
export const COUNTRY_PATTERNS: { code: string; name: string; pattern: RegExp }[] = [
  { code: 'CN', name: 'China', pattern: /\b(?:People'?s Republic of China|China)\b/i },
  { code: 'VN', name: 'Vietnam', pattern: /\b(?:Socialist Republic of Vietnam|Vietnam)\b/i },
  { code: 'KR', name: 'South Korea', pattern: /\b(?:(?<!People'?s )Republic of Korea|South Korea)\b/i },
  { code: 'MX', name: 'Mexico', pattern: /\bMexico\b/i },
  { code: 'CA', name: 'Canada', pattern: /\bCanada\b/i },
  { code: 'IN', name: 'India', pattern: /\bIndia\b/i },
  { code: 'ID', name: 'Indonesia', pattern: /\bIndonesia\b/i },
  { code: 'MY', name: 'Malaysia', pattern: /\bMalaysia\b/i },
  { code: 'OM', name: 'Oman', pattern: /\b(?:Sultanate of Oman|Oman)\b/i },
  { code: 'IT', name: 'Italy', pattern: /\bItaly\b/i },
  { code: 'JP', name: 'Japan', pattern: /\bJapan\b/i },
  { code: 'DE', name: 'Germany', pattern: /\b(?:Federal Republic of Germany|Germany)\b/i },
  { code: 'BR', name: 'Brazil', pattern: /\b(?:Federative Republic of Brazil|Brazil)\b/i },
  { code: 'TW', name: 'Taiwan', pattern: /\bTaiwan\b/i },
  { code: 'TH', name: 'Thailand', pattern: /\b(?:Kingdom of Thailand|Thailand)\b/i },
  { code: 'TR', name: 'Turkey', pattern: /\b(?:Republic of T[uü]rkiye|T[uü]rkiye|Turkey)\b/i },
  { code: 'UA', name: 'Ukraine', pattern: /\bUkraine\b/i },
  { code: 'RU', name: 'Russia', pattern: /\b(?:Russian Federation|Russia)\b/i },
  { code: 'IR', name: 'Iran', pattern: /\b(?:Islamic Republic of Iran|Iran)\b/i },
  { code: 'KP', name: 'North Korea', pattern: /\b(?:Democratic People'?s Republic of Korea|Korea, Democratic People'?s Republic of|North Korea)\b/i },
  { code: 'HK', name: 'Hong Kong', pattern: /\bHong Kong\b/i },
  { code: 'CU', name: 'Cuba', pattern: /\bCuba\b/i },
  { code: 'SY', name: 'Syria', pattern: /\b(?:Syrian Arab Republic|Syria)\b/i },
  { code: 'VE', name: 'Venezuela', pattern: /\bVenezuela\b/i },
  { code: 'BY', name: 'Belarus', pattern: /\bBelarus\b/i },
  { code: 'MM', name: 'Myanmar', pattern: /\b(?:Myanmar|Burma)\b/i },
  { code: 'AF', name: 'Afghanistan', pattern: /\bAfghanistan\b/i },
  { code: 'GB', name: 'United Kingdom', pattern: /\b(?:United Kingdom|U\.K\.)\b/ },
  { code: 'FR', name: 'France', pattern: /\bFrance\b/i },
  { code: 'CH', name: 'Switzerland', pattern: /\b(?:Swiss Confederation|Switzerland)\b/i },
  { code: 'IL', name: 'Israel', pattern: /\bIsrael\b/i },
  { code: 'SA', name: 'Saudi Arabia', pattern: /\b(?:Kingdom of Saudi Arabia|Saudi Arabia)\b/i },
  { code: 'AE', name: 'United Arab Emirates', pattern: /\bUnited Arab Emirates\b/i },
  { code: 'EU', name: 'European Union', pattern: /\bEuropean Union\b/i },
  // -- extended coverage below --
  { code: 'AL', name: 'Albania', pattern: /\bAlbania\b/i },
  { code: 'DZ', name: 'Algeria', pattern: /\bAlgeria\b/i },
  { code: 'AO', name: 'Angola', pattern: /\bAngola\b/i },
  { code: 'AZ', name: 'Azerbaijan', pattern: /\bAzerbaijan\b/i },
  { code: 'AR', name: 'Argentina', pattern: /\bArgentina\b/i },
  { code: 'AU', name: 'Australia', pattern: /\bAustralia\b/i },
  { code: 'AT', name: 'Austria', pattern: /\bAustria\b/i },
  { code: 'BS', name: 'Bahamas', pattern: /\bBahamas\b/i },
  { code: 'BD', name: 'Bangladesh', pattern: /\bBangladesh\b/i },
  { code: 'AM', name: 'Armenia', pattern: /\bArmenia\b/i },
  { code: 'BE', name: 'Belgium', pattern: /\bBelgium\b/i },
  { code: 'BT', name: 'Bhutan', pattern: /\bBhutan\b/i },
  { code: 'BO', name: 'Bolivia', pattern: /\bBolivia\b/i },
  { code: 'BA', name: 'Bosnia and Herzegovina', pattern: /\bBosnia\b/i },
  { code: 'BW', name: 'Botswana', pattern: /\bBotswana\b/i },
  { code: 'BZ', name: 'Belize', pattern: /\bBelize\b/i },
  { code: 'SB', name: 'Solomon Islands', pattern: /\bSolomon Islands\b/i },
  { code: 'BN', name: 'Brunei', pattern: /\bBrunei\b/i },
  { code: 'BG', name: 'Bulgaria', pattern: /\bBulgaria\b/i },
  { code: 'BI', name: 'Burundi', pattern: /\bBurundi\b/i },
  { code: 'KH', name: 'Cambodia', pattern: /\bCambodia\b/i },
  { code: 'CM', name: 'Cameroon', pattern: /\bCameroon\b/i },
  { code: 'CF', name: 'Central African Republic', pattern: /\bCentral African Republic\b/i },
  { code: 'LK', name: 'Sri Lanka', pattern: /\bSri Lanka\b/i },
  { code: 'CL', name: 'Chile', pattern: /\bChile\b/i },
  { code: 'CO', name: 'Colombia', pattern: /\bColombia\b/i },
  { code: 'CG', name: 'Congo', pattern: /(?<!Democratic Republic of the )(?<!Dem\. Rep\. )\bCongo\b/i },
  { code: 'CD', name: 'Democratic Republic of the Congo', pattern: /\b(?:Democratic Republic of the Congo|DRC)\b/i },
  { code: 'CR', name: 'Costa Rica', pattern: /\bCosta Rica\b/i },
  { code: 'HR', name: 'Croatia', pattern: /\bCroatia\b/i },
  { code: 'CY', name: 'Cyprus', pattern: /\bCyprus\b/i },
  { code: 'CZ', name: 'Czechia', pattern: /\b(?:Czechia|Czech Republic)\b/i },
  { code: 'BJ', name: 'Benin', pattern: /\bBenin\b/i },
  { code: 'DK', name: 'Denmark', pattern: /\bDenmark\b/i },
  { code: 'DO', name: 'Dominican Republic', pattern: /\bDominican Republic\b/i },
  { code: 'EC', name: 'Ecuador', pattern: /\bEcuador\b/i },
  { code: 'SV', name: 'El Salvador', pattern: /\bEl Salvador\b/i },
  { code: 'GQ', name: 'Equatorial Guinea', pattern: /\bEquatorial Guinea\b/i },
  { code: 'ET', name: 'Ethiopia', pattern: /\bEthiopia\b/i },
  { code: 'ER', name: 'Eritrea', pattern: /\bEritrea\b/i },
  { code: 'EE', name: 'Estonia', pattern: /\bEstonia\b/i },
  { code: 'FK', name: 'Falkland Islands', pattern: /\bFalkland Islands\b/i },
  { code: 'FJ', name: 'Fiji', pattern: /\bFiji\b/i },
  { code: 'FI', name: 'Finland', pattern: /\bFinland\b/i },
  { code: 'DJ', name: 'Djibouti', pattern: /\bDjibouti\b/i },
  { code: 'GA', name: 'Gabon', pattern: /\bGabon\b/i },
  { code: 'GM', name: 'Gambia', pattern: /\bGambia\b/i },
  { code: 'PS', name: 'Palestine', pattern: /\b(?:Palestine|Palestinian Territories)\b/i },
  { code: 'GH', name: 'Ghana', pattern: /\bGhana\b/i },
  { code: 'GR', name: 'Greece', pattern: /\bGreece\b/i },
  { code: 'GL', name: 'Greenland', pattern: /\bGreenland\b/i },
  { code: 'GT', name: 'Guatemala', pattern: /\bGuatemala\b/i },
  { code: 'GN', name: 'Guinea', pattern: /(?<!Equatorial )(?<!New )\bGuinea\b(?!-Bissau)/i },
  { code: 'GY', name: 'Guyana', pattern: /\bGuyana\b/i },
  { code: 'HT', name: 'Haiti', pattern: /\bHaiti\b/i },
  { code: 'HN', name: 'Honduras', pattern: /\bHonduras\b/i },
  { code: 'HU', name: 'Hungary', pattern: /\bHungary\b/i },
  { code: 'IS', name: 'Iceland', pattern: /\bIceland\b/i },
  { code: 'IQ', name: 'Iraq', pattern: /\bIraq\b/i },
  { code: 'IE', name: 'Ireland', pattern: /\bIreland\b/i },
  { code: 'CI', name: "Côte d'Ivoire", pattern: /\b(?:C[oô]te d['’]Ivoire|Ivory Coast)\b/i },
  { code: 'JM', name: 'Jamaica', pattern: /\bJamaica\b/i },
  { code: 'KZ', name: 'Kazakhstan', pattern: /\bKazakhstan\b/i },
  { code: 'KE', name: 'Kenya', pattern: /\bKenya\b/i },
  { code: 'KW', name: 'Kuwait', pattern: /\bKuwait\b/i },
  { code: 'KG', name: 'Kyrgyzstan', pattern: /\bKyrgyzstan\b/i },
  { code: 'LA', name: 'Laos', pattern: /\bLaos\b/i },
  { code: 'LB', name: 'Lebanon', pattern: /\bLebanon\b/i },
  { code: 'LS', name: 'Lesotho', pattern: /\bLesotho\b/i },
  { code: 'LV', name: 'Latvia', pattern: /\bLatvia\b/i },
  { code: 'LR', name: 'Liberia', pattern: /\bLiberia\b/i },
  { code: 'LY', name: 'Libya', pattern: /\bLibya\b/i },
  { code: 'LT', name: 'Lithuania', pattern: /\bLithuania\b/i },
  { code: 'LU', name: 'Luxembourg', pattern: /\bLuxembourg\b/i },
  { code: 'MG', name: 'Madagascar', pattern: /\bMadagascar\b/i },
  { code: 'MW', name: 'Malawi', pattern: /\bMalawi\b/i },
  { code: 'ML', name: 'Mali', pattern: /\bMali\b/i },
  { code: 'MR', name: 'Mauritania', pattern: /\bMauritania\b/i },
  { code: 'MN', name: 'Mongolia', pattern: /\bMongolia\b/i },
  { code: 'MD', name: 'Moldova', pattern: /\bMoldova\b/i },
  { code: 'ME', name: 'Montenegro', pattern: /\bMontenegro\b/i },
  { code: 'MA', name: 'Morocco', pattern: /\bMorocco\b/i },
  { code: 'MZ', name: 'Mozambique', pattern: /\bMozambique\b/i },
  { code: 'NA', name: 'Namibia', pattern: /\bNamibia\b/i },
  { code: 'NP', name: 'Nepal', pattern: /\bNepal\b/i },
  // Deliberately not also matching "Holland": Case New Holland (CNH) is a
  // major agricultural-equipment maker, and this feed covers equipment
  // tariffs -- "New Holland" tractors would wrongly tag the Netherlands.
  { code: 'NL', name: 'Netherlands', pattern: /\bNetherlands\b/i },
  { code: 'VU', name: 'Vanuatu', pattern: /\bVanuatu\b/i },
  { code: 'NZ', name: 'New Zealand', pattern: /\bNew Zealand\b/i },
  { code: 'NI', name: 'Nicaragua', pattern: /\bNicaragua\b/i },
  { code: 'NE', name: 'Niger', pattern: /\bNiger\b/i },
  { code: 'NG', name: 'Nigeria', pattern: /\bNigeria\b/i },
  { code: 'NO', name: 'Norway', pattern: /\bNorway\b/i },
  { code: 'PK', name: 'Pakistan', pattern: /\bPakistan\b/i },
  { code: 'PA', name: 'Panama', pattern: /\bPanama\b/i },
  { code: 'PG', name: 'Papua New Guinea', pattern: /\bPapua New Guinea\b/i },
  { code: 'PY', name: 'Paraguay', pattern: /\bParaguay\b/i },
  { code: 'PE', name: 'Peru', pattern: /\bPeru\b/i },
  { code: 'PH', name: 'Philippines', pattern: /\bPhilippines\b/i },
  { code: 'PL', name: 'Poland', pattern: /\bPoland\b/i },
  { code: 'PT', name: 'Portugal', pattern: /\bPortugal\b/i },
  { code: 'GW', name: 'Guinea-Bissau', pattern: /\bGuinea-Bissau\b/i },
  { code: 'TL', name: 'Timor-Leste', pattern: /\b(?:Timor-Leste|East Timor)\b/i },
  { code: 'QA', name: 'Qatar', pattern: /\bQatar\b/i },
  { code: 'RO', name: 'Romania', pattern: /\bRomania\b/i },
  { code: 'RW', name: 'Rwanda', pattern: /\bRwanda\b/i },
  { code: 'SN', name: 'Senegal', pattern: /\bSenegal\b/i },
  { code: 'RS', name: 'Serbia', pattern: /\bSerbia\b/i },
  { code: 'SL', name: 'Sierra Leone', pattern: /\bSierra Leone\b/i },
  { code: 'SK', name: 'Slovakia', pattern: /\bSlovakia\b/i },
  { code: 'SI', name: 'Slovenia', pattern: /\bSlovenia\b/i },
  { code: 'SO', name: 'Somalia', pattern: /\bSomalia\b/i },
  { code: 'ZA', name: 'South Africa', pattern: /\bSouth Africa\b/i },
  { code: 'ZW', name: 'Zimbabwe', pattern: /\bZimbabwe\b/i },
  { code: 'ES', name: 'Spain', pattern: /\bSpain\b/i },
  { code: 'SS', name: 'South Sudan', pattern: /\bSouth Sudan\b/i },
  { code: 'SD', name: 'Sudan', pattern: /(?<!South )\bSudan\b/i },
  { code: 'SR', name: 'Suriname', pattern: /\bSuriname\b/i },
  { code: 'SZ', name: 'Eswatini', pattern: /\b(?:Eswatini|Swaziland)\b/i },
  { code: 'SE', name: 'Sweden', pattern: /\bSweden\b/i },
  { code: 'TJ', name: 'Tajikistan', pattern: /\bTajikistan\b/i },
  { code: 'TG', name: 'Togo', pattern: /\bTogo\b/i },
  { code: 'TT', name: 'Trinidad and Tobago', pattern: /\bTrinidad\b/i },
  { code: 'TN', name: 'Tunisia', pattern: /\bTunisia\b/i },
  { code: 'TM', name: 'Turkmenistan', pattern: /\bTurkmenistan\b/i },
  { code: 'UG', name: 'Uganda', pattern: /\bUganda\b/i },
  { code: 'MK', name: 'North Macedonia', pattern: /\bNorth Macedonia\b/i },
  { code: 'EG', name: 'Egypt', pattern: /\bEgypt\b/i },
  { code: 'TZ', name: 'Tanzania', pattern: /\bTanzania\b/i },
  { code: 'BF', name: 'Burkina Faso', pattern: /\bBurkina Faso\b/i },
  { code: 'UY', name: 'Uruguay', pattern: /\bUruguay\b/i },
  { code: 'UZ', name: 'Uzbekistan', pattern: /\bUzbekistan\b/i },
  { code: 'YE', name: 'Yemen', pattern: /\bYemen\b/i },
  { code: 'ZM', name: 'Zambia', pattern: /\bZambia\b/i },
];

// Kept for any caller that wants a code's display name without importing
// the whole pattern list; derived from COUNTRY_PATTERNS so the two can't
// drift out of sync the way two independently hand-typed lists could.
export const COUNTRY_LABELS: Record<string, string> = Object.fromEntries(COUNTRY_PATTERNS.map((p) => [p.code, p.name]));

export function extractCountries(text: string): string[] {
  const hits: string[] = [];
  for (const { code, pattern } of COUNTRY_PATTERNS) {
    if (pattern.test(text)) hits.push(code);
  }
  return hits;
}

/**
 * The countries an item is actually *about*: those its headline names. A story
 * whose body merely mentions Iran in passing is not about Iran, so linking on
 * every body mention produces noise. Falls back to the stored (title + body)
 * tags when the headline names no country at all (e.g. "Iranian Transactions
 * and Sanctions Regulations").
 */
export function focusCountries(title: string, stored: string[]): string[] {
  const inTitle = extractCountries(title);
  return inTitle.length > 0 ? inTitle : stored;
}
