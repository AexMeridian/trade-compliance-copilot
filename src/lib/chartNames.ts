// The Country Chart's names for destinations, as ISO 3166-1 alpha-2 codes (the key the rest of the app uses). Names are exactly as the eCFR
// prints them, including its spelling mistakes ("Seycheles"). A name that is not here stops the import instead of being guessed.
export const CHART_NAME_TO_ISO: Record<string, string> = {
  Afghanistan: 'AF', Albania: 'AL', Algeria: 'DZ', Andorra: 'AD', Angola: 'AO', 'Antigua and Barbuda': 'AG', Argentina: 'AR', Armenia: 'AM', Aruba: 'AW',
  Australia: 'AU', Austria: 'AT', Azerbaijan: 'AZ', 'Bahamas, The': 'BS', Bahrain: 'BH', Bangladesh: 'BD', Barbados: 'BB', Belarus: 'BY', Belgium: 'BE',
  Belize: 'BZ', Benin: 'BJ', Bhutan: 'BT', Bolivia: 'BO', 'Bosnia and Herzegovina': 'BA', Botswana: 'BW', Brazil: 'BR', Brunei: 'BN', Bulgaria: 'BG',
  'Burkina Faso': 'BF', Burma: 'MM', Burundi: 'BI', Cambodia: 'KH', Cameroon: 'CM', Canada: 'CA', 'Cape Verde': 'CV', 'Central African Republic': 'CF',
  Chad: 'TD', Chile: 'CL', China: 'CN', Colombia: 'CO', Comoros: 'KM', 'Congo (Democratic Republic of the)': 'CD', 'Congo (Republic of the)': 'CG',
  'Costa Rica': 'CR', "Cote d'Ivoire": 'CI', Croatia: 'HR', Cuba: 'CU', 'Curaçao': 'CW', Cyprus: 'CY', 'Czech Republic': 'CZ', Denmark: 'DK', Djibouti: 'DJ',
  Dominica: 'DM', 'Dominican Republic': 'DO', Ecuador: 'EC', Egypt: 'EG', 'El Salvador': 'SV', 'Equatorial Guinea': 'GQ', Eritrea: 'ER', Estonia: 'EE',
  Eswatini: 'SZ', Ethiopia: 'ET', Fiji: 'FJ', Finland: 'FI', France: 'FR', Gabon: 'GA', 'Gambia, The': 'GM', Georgia: 'GE', Germany: 'DE', Ghana: 'GH',
  Greece: 'GR', Grenada: 'GD', Guatemala: 'GT', Guinea: 'GN', 'Guinea-Bissau': 'GW', Guyana: 'GY', Haiti: 'HT', Honduras: 'HN', Hungary: 'HU', Iceland: 'IS',
  India: 'IN', Indonesia: 'ID', Iran: 'IR', Iraq: 'IQ', Ireland: 'IE', Israel: 'IL', Italy: 'IT', Jamaica: 'JM', Japan: 'JP', Jordan: 'JO', Kazakhstan: 'KZ',
  Kenya: 'KE', Kiribati: 'KI', 'Korea, North': 'KP', 'Korea, South': 'KR', Kosovo: 'XK', Kuwait: 'KW', Kyrgyzstan: 'KG', Laos: 'LA', Latvia: 'LV', Lebanon: 'LB',
  Lesotho: 'LS', Liberia: 'LR', Libya: 'LY', Liechtenstein: 'LI', Lithuania: 'LT', Luxembourg: 'LU', Macau: 'MO', Madagascar: 'MG', Malawi: 'MW', Malaysia: 'MY',
  Maldives: 'MV', Mali: 'ML', Malta: 'MT', 'Marshall Islands': 'MH', Mauritania: 'MR', Mauritius: 'MU', Mexico: 'MX', 'Micronesia (Federated State of)': 'FM',
  Moldova: 'MD', Monaco: 'MC', Mongolia: 'MN', Montenegro: 'ME', Morocco: 'MA', Mozambique: 'MZ', Namibia: 'NA', Nauru: 'NR', Nepal: 'NP', Netherlands: 'NL',
  'New Zealand': 'NZ', Nicaragua: 'NI', Niger: 'NE', Nigeria: 'NG', 'North Macedonia': 'MK', Norway: 'NO', Oman: 'OM', Pakistan: 'PK', Palau: 'PW', Panama: 'PA',
  'Papua New Guinea': 'PG', Paraguay: 'PY', Peru: 'PE', Philippines: 'PH', Poland: 'PL', Portugal: 'PT', Qatar: 'QA', Romania: 'RO', Russia: 'RU', Rwanda: 'RW',
  'St. Kitts and Nevis': 'KN', 'St. Lucia': 'LC', 'St. Vincent and the Grenadines': 'VC', Samoa: 'WS', 'San Marino': 'SM', 'Sao Tome and Principe': 'ST',
  'Saudi Arabia': 'SA', Senegal: 'SN', Serbia: 'RS', Seycheles: 'SC', 'Sierra Leone': 'SL', Singapore: 'SG',
  'Sint Maarten (the Dutch two-fifths of the island of Saint Martin)': 'SX', Slovakia: 'SK', Slovenia: 'SI', 'Solomon Islands': 'SB', Somalia: 'SO',
  'South Africa': 'ZA', 'South Sudan, Republic of': 'SS', Spain: 'ES', 'Sri Lanka': 'LK', Sudan: 'SD', Suriname: 'SR', Sweden: 'SE', Switzerland: 'CH', Syria: 'SY',
  Taiwan: 'TW', Tajikistan: 'TJ', Tanzania: 'TZ', Thailand: 'TH', 'Timor-Leste': 'TL', Togo: 'TG', Tonga: 'TO', 'Trinidad and Tobago': 'TT', Tunisia: 'TN',
  'Türkiye': 'TR', Turkmenistan: 'TM', Tuvalu: 'TV', Uganda: 'UG', Ukraine: 'UA', 'United Arab Emirates': 'AE', 'United Kingdom': 'GB', Uruguay: 'UY',
  Uzbekistan: 'UZ', Vanuatu: 'VU', 'Vatican City': 'VA', Venezuela: 'VE', Vietnam: 'VN', 'Western Sahara': 'EH', Yemen: 'YE', Zambia: 'ZM', Zimbabwe: 'ZW',
};

/** Display names for the coverage table (the chart's own names are awkward, e.g. "Korea, South"). */
export const DISPLAY_NAME: Record<string, string> = {
  'Bahamas, The': 'The Bahamas', 'Gambia, The': 'The Gambia', 'Korea, North': 'North Korea', 'Korea, South': 'South Korea', Seycheles: 'Seychelles',
  'Congo (Democratic Republic of the)': 'Democratic Republic of the Congo', 'Congo (Republic of the)': 'Republic of the Congo',
  'Micronesia (Federated State of)': 'Micronesia', 'South Sudan, Republic of': 'South Sudan',
  'Sint Maarten (the Dutch two-fifths of the island of Saint Martin)': 'Sint Maarten', 'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'St. Lucia': 'Saint Lucia', 'St. Vincent and the Grenadines': 'Saint Vincent and the Grenadines',
};
