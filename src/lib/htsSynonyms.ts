// Everyday product words that the tariff schedule does not use, mapped to the words it does. The search only matches the schedule's own
// vocabulary, so "laptop" finds nothing useful while "portable automatic data processing machines" finds the right heading. The extra
// words are added to the search, never replacing the user's own, and the model still chooses among the real schedule lines that come back.
// Add a pair when a labelled product's correct subheading is missing from the search results (npm run test:accuracy shows which).

const SYNONYMS: [RegExp, string][] = [
  [/\blaptops?\b|\bnotebook (computer|pc)s?\b/i, 'portable automatic data processing machines'],
  [/\bdesktop (computer|pc)s?\b|\bpersonal computers?\b/i, 'automatic data processing machines'],
  [/\bcomputer monitors?\b|\bpc monitors?\b/i, 'monitors automatic data processing'],
  [/\bsmart ?phones?\b|\bmobile phones?\b|\bcell ?phones?\b/i, 'telephones for cellular networks'],
  [/\blipsticks?\b|\blip ?gloss\b/i, 'lip make-up preparations'],
  [/\bmascara\b|\beye ?shadow\b|\beyeliner\b/i, 'eye make-up preparations'],
  [/\bshopping bags?\b|\bcarrier bags?\b|\bplastic bags?\b/i, 'sacks and bags conveyance packing plastics'],
  [/\bsneakers?\b|\btrainers\b|\bathletic (shoes?|footwear)\b|\brunning shoes?\b/i, 'sports footwear tennis shoes training shoes'],
  [/\bvacuum cleaners?\b/i, 'vacuum cleaners electromechanical domestic appliances'],
  [/\btruck\b|\blorry\b/i, 'motor vehicles for the transport of goods'],
  [/\bpickup\b/i, 'motor vehicles for the transport of goods'],
  [/\bhot[- ]rolled (flat )?(steel|coils?)\b|\bsteel coils?\b|\bsteel sheets?\b|\bsteel plates?\b/i, 'flat-rolled products of iron or nonalloy steel'],
  [/\binsulated (electric )?wires?\b|\belectric (wires?|cables?)\b|\bpower cables?\b/i, 'electric conductors for a voltage'],
  [/\bcotton fabrics?\b|\bwoven cotton\b/i, 'woven fabrics of cotton'],
  [/\bknitted fabrics?\b|\bjersey fabrics?\b/i, 'knitted or crocheted fabrics'],
  [/\bwrist ?watch(es)?\b/i, 'wrist watches'],
  [/\bsolar (panels?|modules?|cells?)\b|\bphotovoltaic\b/i, 'photosensitive semiconductor devices photovoltaic cells modules panels'],
  [/\bmicrochips?\b|\bprocessors?\b|\bcpus?\b|\bgpus?\b/i, 'electronic integrated circuits processors controllers'],
  [/\bflash drives?\b|\bthumb drives?\b|\busb sticks?\b|\bssds?\b/i, 'solid-state non-volatile storage devices'],
  [/\bheadphones?\b|\bearbuds?\b|\bearphones?\b/i, 'headphones earphones'],
  [/\btoner\b|\bink cartridges?\b/i, 'printing machinery parts accessories'],
  [/\bduvet\b|\bcomforter\b/i, 'bedding quilts'],
  [/\bhoodies?\b|\bsweatshirts?\b/i, 'sweaters pullovers sweatshirts'],
  [/\bleggings\b|\byoga pants\b/i, 'trousers tights knitted'],
  [/\bsunglasses\b/i, 'spectacles goggles sunglasses'],
  [/\bhandbags?\b|\bpurses?\b/i, 'handbags whether or not with shoulder strap'],
  [/\bsuitcases?\b|\bluggage\b/i, 'trunks suitcases vanity cases'],
  [/\btoys?\b/i, 'toys'],
  [/\bmattress(es)?\b/i, 'mattresses articles of bedding'],
  [/\bfrench fries\b|\bchips\b/i, 'potatoes prepared or preserved frozen'],
  [/\bolive oil\b/i, 'olive oil virgin'],
  [/\bsoy sauce\b/i, 'soy sauce sauces condiments'],
  [/\bpasta\b|\bspaghetti\b|\bnoodles\b/i, 'pasta uncooked'],
  [/\be-?bikes?\b|\belectric bicycles?\b/i, 'bicycles with electric motor'],
  [/\bsyringes?\b|\bneedles?\b/i, 'syringes needles catheters cannulae'],
  [/\bface masks?\b|\bsurgical masks?\b/i, 'textile articles for medical use masks'],
];

/** The query with the schedule's own words added for any everyday term it contains. */
export function expandTradeTerms(query: string): string {
  const extra: string[] = [];
  for (const [re, words] of SYNONYMS) if (re.test(query)) extra.push(words);
  return extra.length ? `${query} ${extra.join(' ')}` : query;
}
