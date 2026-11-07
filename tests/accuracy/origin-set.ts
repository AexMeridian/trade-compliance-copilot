// Labelled USMCA origin scenarios for the model-scored test. Each is worked out by hand from the rule the app has loaded for that heading
// (tests/accuracy/q.ts lists them): chapters 84, 85 and 87 other than 8703/8704 need a change of heading or 60% regional value content;
// 8703/8704 need 75% (net cost); chapters 61-63 need yarn, fabric and cutting/sewing all in the USMCA countries (10% de minimis).
// `accept` is every answer that is defensible from the facts given; answering "true" when it is not in `accept` is the failure that matters.
// Where a scenario leaves out a fact the rule needs, the right answer is "insufficient" (or a flagged "false"), never "true".

export type Answer = 'true' | 'false' | 'insufficient';
export interface OriginScenario {
  name: string;
  code: string;
  assembly: string;
  components: { description: string; origin_country: string; value_pct: number | null }[];
  accept: Answer[];
  /** What the labeller worked out, for the report. */
  why: string;
}

const c = (description: string, origin_country: string, value_pct: number | null) => ({ description, origin_country, value_pct });

export const ORIGIN_SCENARIOS: OriginScenario[] = [
  // Chapters 84 and 85: change of heading, or 60% regional value content.
  {
    name: 'laptop, every foreign input is a different heading',
    code: '8471.30.0100', assembly: 'MX',
    components: [c('CPU, HTS 8542', 'TW', 20), c('memory chips, HTS 8542', 'KR', 15), c('display module, HTS 8524', 'CN', 10), c('chassis, HTS 8473', 'US', 15), c('battery, HTS 8507', 'MX', 10), c('main circuit board assembled in Mexico, HTS 8473', 'MX', 30)],
    accept: ['true'], why: 'Originating value is 55% (under 60) but no foreign input is in heading 8471, so the change-of-heading test is met.',
  },
  {
    name: 'handset with a foreign module in the same heading',
    code: '8517.13.0000', assembly: 'MX',
    components: [c('pre-assembled radio module, HTS 8517', 'CN', 45), c('housing and board, HTS 8517 parts under 8517.71', 'MX', 55)],
    accept: ['false'], why: '55% is under 60 and the foreign module is in heading 8517, so neither test is met.',
  },
  {
    name: 'pump with 70% regional content',
    code: '8413.70.2000', assembly: 'US',
    components: [c('pump casing, HTS 8413', 'US', 40), c('impeller and shaft, HTS 8413', 'MX', 30), c('pump head, HTS 8413', 'CN', 30)],
    accept: ['true'], why: '70% originating is above 60.',
  },
  {
    name: 'motor with 60% of the value from China in the same heading',
    code: '8501.31.4000', assembly: 'US',
    components: [c('rotor, HTS 8501', 'US', 20), c('housing, HTS 8501', 'CA', 20), c('stator assemblies, HTS 8501', 'CN', 60)],
    accept: ['false'], why: '40% originating and the foreign input is in heading 8501.',
  },
  {
    name: 'control panel entirely from the USMCA countries',
    code: '8537.10.9170', assembly: 'MX',
    components: [c('enclosure', 'MX', 40), c('wiring and terminals', 'US', 35), c('relays', 'CA', 25)],
    accept: ['true'], why: '100% originating.',
  },
  {
    name: 'machine exactly at 60%',
    code: '8479.89.9499', assembly: 'US',
    components: [c('frame and drive, HTS 8479', 'US', 60), c('control unit, HTS 8479', 'DE', 40)],
    accept: ['true'], why: '60% meets the threshold (at least 60).',
  },
  {
    name: 'machine just under 60%',
    code: '8479.89.9499', assembly: 'US',
    components: [c('frame and drive, HTS 8479', 'US', 59), c('control unit, HTS 8479', 'DE', 41)],
    accept: ['false'], why: '59% is under 60 and the foreign input is in the same heading.',
  },
  {
    name: 'heater with no values given',
    code: '8516.29.0000', assembly: 'MX',
    components: [c('heating element', 'CN', null), c('housing', 'MX', null), c('controller', 'JP', null)],
    accept: ['insufficient'], why: 'No values and no headings: neither test can be run.',
  },
  {
    name: 'heater with origins only',
    code: '8516.79.0070', assembly: 'MX',
    components: [c('element', 'CN', null), c('casing', 'MX', null)],
    accept: ['insufficient'], why: 'Missing values and headings.',
  },
  {
    name: 'all US components, assembled in China',
    code: '8471.50.0150', assembly: 'CN',
    components: [c('board, HTS 8473', 'US', 60), c('enclosure, HTS 8473', 'US', 40)],
    accept: ['false', 'insufficient'], why: 'Final assembly outside the USMCA countries; the good is not produced there.',
  },
  {
    name: 'valve at 62%',
    code: '8481.80.9050', assembly: 'MX',
    components: [c('valve body, HTS 8481', 'MX', 40), c('actuator, HTS 8481', 'US', 22), c('seals, HTS 8481', 'JP', 38)],
    accept: ['true'], why: '62% originating.',
  },
  {
    name: 'television with every foreign input in another heading',
    code: '8528.72.6400', assembly: 'MX',
    components: [c('LCD panel, HTS 8524', 'KR', 40), c('mainboard, HTS 8534', 'CN', 20), c('enclosure and assembly labor', 'MX', 40)],
    accept: ['true'], why: 'Originating value 40%, but each foreign input is classified outside 8528: change of heading is met.',
  },
  {
    name: 'refrigerator with foreign compressor and steel',
    code: '8418.10.0020', assembly: 'MX',
    components: [c('compressor, HTS 8414', 'TH', 25), c('cabinet assembly', 'MX', 55), c('steel sheet, HTS 7210', 'CN', 20)],
    accept: ['true'], why: 'Both foreign inputs are in other headings: change of heading met even though regional content is 55%.',
  },
  {
    name: 'power tool with a same-heading housing from China',
    code: '8467.21.0000', assembly: 'MX',
    components: [c('motor, HTS 8501', 'JP', 30), c('housing, HTS 8467', 'CN', 20), c('chuck and gearbox', 'MX', 50)],
    accept: ['false'], why: '50% originating is under 60 and the housing is classified in 8467, the same heading.',
  },
  {
    name: 'charger with US parts assembled in China',
    code: '8504.40.9580', assembly: 'CN',
    components: [c('transformer, HTS 8504', 'US', 70), c('housing', 'MX', 30)],
    accept: ['false', 'insufficient'], why: 'Final assembly outside the USMCA countries.',
  },
  // Chapter 87 other than 8703/8704: change of heading or 60%.
  {
    name: 'brake parts at 65%',
    code: '8708.30.5090', assembly: 'MX',
    components: [c('brake discs, HTS 8708', 'MX', 65), c('friction pads, HTS 8708', 'CN', 35)],
    accept: ['true'], why: '65% originating is above 60.',
  },
  {
    name: 'motorcycle from foreign parts in another heading',
    code: '8711.20.0090', assembly: 'MX',
    components: [c('engine parts, HTS 8714', 'JP', 60), c('frame and assembly', 'MX', 40)],
    accept: ['true'], why: 'The foreign parts are classified in 8714, not 8711: change of heading met.',
  },
  {
    name: 'trailer with Chinese steel frames',
    code: '8716.39.0090', assembly: 'US',
    components: [c('steel frames, HTS 7308', 'CN', 70), c('axles and fittings, HTS 8716', 'US', 30)],
    accept: ['true', 'insufficient'], why: 'The only foreign input is in 7308, a different heading, so the heading test is met; a careful answer may also flag it.',
  },
  {
    name: 'vehicle parts at 40%',
    code: '8708.99.8180', assembly: 'US',
    components: [c('stamped parts, HTS 8708', 'US', 40), c('assemblies, HTS 8708', 'CN', 60)],
    accept: ['false'], why: '40% originating, foreign input in the same heading.',
  },
  {
    name: 'bicycle-type vehicle parts with nothing given',
    code: '8714.10.0000', assembly: 'MX',
    components: [c('frame', 'CN', null), c('fittings', 'MX', null)],
    accept: ['insufficient'], why: 'No values and no headings.',
  },
  // Heading 8703 and 8704: 75% (net cost method).
  {
    name: 'car at 80%',
    code: '8703.23.0190', assembly: 'US',
    components: [c('engine and transmission', 'US', 50), c('body and chassis', 'MX', 30), c('electronics', 'JP', 20)],
    accept: ['true', 'insufficient'], why: '80% is above 75; the rule notes also require labor value content and steel/aluminum purchasing, so flagging that is fine, but not a "false".',
  },
  {
    name: 'car at exactly 75%',
    code: '8703.23.0190', assembly: 'MX',
    components: [c('powertrain', 'US', 45), c('body', 'MX', 30), c('electronics and trim', 'KR', 25)],
    accept: ['true', 'insufficient'], why: '75% meets the threshold.',
  },
  {
    name: 'car at 70%',
    code: '8703.24.0190', assembly: 'MX',
    components: [c('powertrain', 'US', 40), c('body', 'MX', 30), c('electronics and trim', 'CN', 30)],
    accept: ['false'], why: '70% is under 75.',
  },
  {
    name: 'car at 60%',
    code: '8703.80.0000', assembly: 'US',
    components: [c('powertrain', 'DE', 40), c('body', 'US', 35), c('interior', 'CA', 25)],
    accept: ['false'], why: 'Originating value is 60% (US 35 + CA 25), under 75.',
  },
  {
    name: 'pickup at 85%',
    code: '8704.21.0000', assembly: 'MX',
    components: [c('engine', 'US', 40), c('body and frame', 'MX', 45), c('infotainment', 'JP', 15)],
    accept: ['true', 'insufficient'], why: '85% is above 75; labor value content is not modelled.',
  },
  {
    name: 'pickup at 74%',
    code: '8704.31.0000', assembly: 'MX',
    components: [c('engine', 'US', 34), c('body', 'MX', 40), c('axles and electronics', 'CN', 26)],
    accept: ['false'], why: '74% is under 75.',
  },
  {
    name: 'car with no values',
    code: '8703.22.0190', assembly: 'US',
    components: [c('engine', 'JP', null), c('body', 'US', null)],
    accept: ['insufficient'], why: 'No values.',
  },
  {
    name: 'truck built entirely in Mexico and Canada',
    code: '8704.22.5000', assembly: 'MX',
    components: [c('chassis and body', 'MX', 60), c('engine', 'CA', 40)],
    accept: ['true', 'insufficient'], why: '100% originating.',
  },
  // Chapters 61-63: yarn forward.
  {
    name: 'knit shirt, yarn to sewing all in the USMCA countries',
    code: '6109.10.0012', assembly: 'MX',
    components: [c('cotton yarn spun in the US', 'US', 40), c('knit fabric made in Mexico', 'MX', 35), c('cut and sewn in Mexico', 'MX', 25)],
    accept: ['true'], why: 'Yarn, fabric and sewing all in the USMCA territory.',
  },
  {
    name: 'knit shirt with Indian yarn',
    code: '6109.10.0012', assembly: 'MX',
    components: [c('cotton yarn spun in India', 'IN', 40), c('knit fabric made in Mexico', 'MX', 35), c('cut and sewn in Mexico', 'MX', 25)],
    accept: ['false'], why: 'Yarn formed outside the territory.',
  },
  {
    name: 'trousers from Chinese fabric',
    code: '6203.42.4011', assembly: 'MX',
    components: [c('yarn spun in the US', 'US', 20), c('woven fabric made in China', 'CN', 45), c('cut and sewn in Mexico', 'MX', 35)],
    accept: ['false'], why: 'Fabric formed outside the territory.',
  },
  {
    name: 'blouse made wholly in Mexico from US cotton',
    code: '6206.30.3040', assembly: 'MX',
    components: [c('yarn spun in Mexico from US cotton', 'MX', 30), c('woven fabric made in Mexico', 'MX', 40), c('cut and sewn in Mexico', 'MX', 30)],
    accept: ['true'], why: 'All three stages in the territory.',
  },
  {
    name: 'sweater knit and sewn in Canada from US yarn',
    code: '6110.20.2079', assembly: 'CA',
    components: [c('yarn spun in the US', 'US', 45), c('fabric knit in Canada', 'CA', 30), c('cut and sewn in Canada', 'CA', 25)],
    accept: ['true'], why: 'All stages in the territory.',
  },
  {
    name: 'sweater with Vietnamese knitting',
    code: '6110.20.2079', assembly: 'MX',
    components: [c('yarn spun in the US', 'US', 40), c('fabric knit in Vietnam', 'VN', 35), c('cut and sewn in Mexico', 'MX', 25)],
    accept: ['false'], why: 'Fabric formed outside the territory.',
  },
  {
    name: 'sheets woven in the US and sewn in Mexico',
    code: '6302.21.9010', assembly: 'MX',
    components: [c('yarn spun in the US', 'US', 40), c('fabric woven in the US', 'US', 35), c('cut and hemmed in Mexico', 'MX', 25)],
    accept: ['true'], why: 'All stages in the territory.',
  },
  {
    name: 'sheets with Pakistani fabric',
    code: '6302.21.9010', assembly: 'MX',
    components: [c('yarn spun in Pakistan', 'PK', 35), c('fabric woven in Pakistan', 'PK', 40), c('cut and hemmed in Mexico', 'MX', 25)],
    accept: ['false'], why: 'Yarn and fabric formed outside the territory.',
  },
  {
    name: 'shirt with the yarn origin unknown',
    code: '6109.10.0012', assembly: 'MX',
    components: [c('knit fabric, yarn origin not known', 'MX', 60), c('cut and sewn in Mexico', 'MX', 40)],
    accept: ['insufficient'], why: 'Where the yarn was formed is the deciding fact and is not given.',
  },
  {
    name: 'shirt with 5% trim from China',
    code: '6205.20.2046', assembly: 'MX',
    components: [c('cotton yarn spun in the US', 'US', 35), c('fabric woven in Mexico', 'MX', 35), c('cut and sewn in Mexico', 'MX', 25), c('plastic buttons, 5% of weight', 'CN', 5)],
    accept: ['true', 'insufficient'], why: 'The non-originating trim is under the 10% de minimis, so the shirt can still qualify.',
  },
  {
    name: 'garment sewn in Honduras from US fabric',
    code: '6104.62.2006', assembly: 'HN',
    components: [c('yarn spun in the US', 'US', 30), c('fabric knit in the US', 'US', 40), c('cut and sewn in Honduras', 'HN', 30)],
    accept: ['false'], why: 'Sewing outside the territory.',
  },
  {
    name: 'made-up textile article formed in Canada, US and Mexico',
    code: '6307.90.9889', assembly: 'MX',
    components: [c('yarn spun in the US', 'US', 30), c('fabric woven in Canada', 'CA', 40), c('cut and sewn in Mexico', 'MX', 30)],
    accept: ['true'], why: 'All stages in the territory.',
  },
];
