// The model-scored accuracy scripts spend real money. They refuse to start unless the caller passes --confirm-cost with at least the estimated
// dollars, so a run is always a decision and never an accident. Estimates come from measured token counts (docs/ACCURACY.md); no model call is
// made here.

export const PER_CALL_USD = { classification: 0.02, origin: 0.022, screening: 0.018, eccn: 0.015 } as const;

export function requireCostConfirmation(argv: string[], calls: number, perCallUsd: number, label: string): void {
  const estimate = calls * perCallUsd;
  const i = argv.indexOf('--confirm-cost');
  const given = i >= 0 ? Number(argv[i + 1]) : NaN;
  console.log(`${label}: ${calls} model calls, estimated cost about $${estimate.toFixed(2)}`);
  if (!Number.isFinite(given) || given < estimate) {
    console.error(`Not started. Re-run with --confirm-cost ${Math.ceil(estimate * 100) / 100} (or more) to approve spending about that much.`);
    process.exit(3);
  }
}
