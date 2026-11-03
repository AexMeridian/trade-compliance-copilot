// Guards the order of fields in the model's forced tools. The model writes the fields in schema order, so the reasoning must come before the
// answer it supports; with the answer first, the model commits to a value and then writes reasoning that cannot change it (found in testing:
// reasoning that named 0902.30 under a selected_code of 0902.40). No network, no model. Run: npm run test:unit

import assert from 'node:assert/strict';
import { buildClassificationTool } from '../src/prompts/classification.js';
import { buildOriginTool } from '../src/prompts/origin.js';
import { buildScreeningTool } from '../src/prompts/screening.js';
import { buildExportEccnTool } from '../src/prompts/determination.js';

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}\n  ${(err as Error).message}`);
  }
}

const keys = (tool: { input_schema: unknown }) => Object.keys((tool.input_schema as { properties: Record<string, unknown> }).properties);
const before = (list: string[], first: string, second: string) => assert.ok(list.indexOf(first) >= 0 && list.indexOf(first) < list.indexOf(second), `${first} must come before ${second} in ${list.join(', ')}`);

test('classification: reasoning comes before the selected code', () => before(keys(buildClassificationTool(['A'])), 'reasoning_steps', 'selected_code'));
test('origin: reasoning comes before the verdict fields', () => {
  const k = keys(buildOriginTool());
  before(k, 'reasoning_steps', 'qualifies');
  before(k, 'reasoning_steps', 'tariff_shift_met');
});
test('ECCN: reasoning comes before the selected ECCN', () => before(keys(buildExportEccnTool(['EAR99'])), 'reasoning_steps', 'selected_eccn'));
test('screening: the memo and matched fields come before the verdict', () => {
  const tool = buildScreeningTool(['a']);
  const items = ((tool.input_schema as { properties: { assessments: { items: { properties: Record<string, unknown> } } } }).properties.assessments.items.properties);
  const k = Object.keys(items);
  before(k, 'risk_memo', 'verdict');
  before(k, 'matched_fields', 'verdict');
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
