import type { DeterminationResult } from '../types/case';

const REQUIREMENT_STYLE: Record<string, string> = {
  NLR: 'text-clear border-clear',
  'License Exception May Apply': 'text-review border-review',
  'License Required': 'text-stop border-stop',
  'Insufficient Data': 'text-review border-review',
};

export function LicensePath({ determination }: { determination: DeterminationResult }) {
  const steps = [
    { label: 'Self-classification', value: determination.eccn ?? 'EAR99 / no match' },
    { label: 'Reasons for control', value: determination.reasons_for_control?.length ? determination.reasons_for_control.join(', ') : 'none' },
    { label: 'Denied-party override', value: determination.denied_party_override ? 'Triggered' : 'Not triggered' },
    { label: 'License requirement', value: determination.license_requirement ?? 'Unresolved' },
  ];
  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-hairline-strong tabular-nums text-xs text-ink-muted">{i + 1}</div>
            {i < steps.length - 1 && <div className="my-0.5 h-6 w-px bg-hairline-strong" />}
          </div>
          <div className="pb-4">
            <div className="text-xs text-ink-muted">{step.label}</div>
            <div
              className={
                step.label === 'License requirement'
                  ? `mt-0.5 inline-block border px-2 py-0.5 tabular-nums text-sm ${REQUIREMENT_STYLE[step.value] ?? 'border-hairline text-ink'}`
                  : 'mt-0.5 tabular-nums text-sm'
              }
            >
              {step.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
