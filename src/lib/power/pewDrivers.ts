// What sits alongside views of the United States: confidence in the U.S. president to do the right thing regarding world affairs, asked in
// the same Pew surveys. Entered from the table on Pew's chart page "Across 20 countries, views of the U.S. and confidence in the U.S.
// president have become more strongly correlated" (Spring 2026 Global Attitudes Survey; the page is dated August 28, 2026). The president
// asked about was Joe Biden in 2024 and Donald Trump in 2025 and 2026, so a change here mixes the change in view with the change in person.
// Pew states no correlation figure; the page computes its own from these 20 pairs and says so. Pew bears no responsibility for the
// analyses or interpretations presented here.
export const PEW_DRIVER_SOURCE = {
  name: 'Pew Research Center, Spring 2026 Global Attitudes Survey',
  url: 'https://www.pewresearch.org/chart/across-20-countries-views-of-the-u-s-and-confidence-in-the-u-s-president-have-become-more-strongly-correlated/',
  citation:
    'Pew Research Center, "Across 20 countries, views of the U.S. and confidence in the U.S. president have become more strongly correlated", Spring 2026 Global Attitudes Survey.',
  question: 'Confidence in the U.S. president to do the right thing regarding world affairs: "a lot" or "some" (share).',
};

// Country -> [2024, 2025, 2026] for the share with a favorable view of the U.S. and the share with confidence in the U.S. president.
export const PEW_DRIVERS: Record<string, { favorable: [number, number, number]; confidence: [number, number, number] }> = {
  AR: { favorable: [53, 52, 44], confidence: [36, 32, 29] },
  AU: { favorable: [40, 29, 24], confidence: [40, 22, 18] },
  BR: { favorable: [64, 56, 47], confidence: [37, 34, 30] },
  CA: { favorable: [54, 34, 33], confidence: [52, 22, 20] },
  FR: { favorable: [46, 36, 27], confidence: [42, 22, 15] },
  DE: { favorable: [49, 33, 27], confidence: [63, 18, 16] },
  GR: { favorable: [48, 45, 37], confidence: [34, 37, 22] },
  ID: { favorable: [57, 48, 29], confidence: [52, 34, 20] },
  IL: { favorable: [77, 83, 81], confidence: [57, 69, 66] },
  IT: { favorable: [56, 47, 31], confidence: [33, 32, 17] },
  JP: { favorable: [70, 55, 50], confidence: [54, 38, 25] },
  KE: { favorable: [78, 62, 63], confidence: [75, 64, 63] },
  MX: { favorable: [61, 29, 40], confidence: [36, 8, 11] },
  NL: { favorable: [48, 29, 25], confidence: [62, 22, 15] },
  NG: { favorable: [72, 78, 63], confidence: [66, 79, 65] },
  ZA: { favorable: [49, 50, 35], confidence: [36, 41, 26] },
  KR: { favorable: [77, 61, 45], confidence: [53, 33, 22] },
  ES: { favorable: [48, 31, 30], confidence: [35, 19, 21] },
  SE: { favorable: [47, 19, 19], confidence: [63, 15, 11] },
  GB: { favorable: [54, 50, 41], confidence: [40, 37, 26] },
};
