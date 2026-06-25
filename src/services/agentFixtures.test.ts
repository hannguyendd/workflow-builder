import { expect, test } from "bun:test";
import { AGENT_FIXTURES } from "./agentFixtures";

test("provides at least one dummy agent with id and name", () => {
  expect(AGENT_FIXTURES.length).toBeGreaterThan(0);
  for (const a of AGENT_FIXTURES) {
    expect(a.id).toBeTruthy();
    expect(a.name).toBeTruthy();
  }
});

test("agent ids are unique", () => {
  const ids = AGENT_FIXTURES.map((a) => a.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("at least one agent has an outputSchema (exercises structuredResponse autocomplete)", () => {
  const withOutput = AGENT_FIXTURES.filter((a) => a.outputSchema !== null);
  expect(withOutput.length).toBeGreaterThan(0);
  const props = (withOutput[0]!.outputSchema as { properties?: Record<string, unknown> }).properties;
  expect(props && Object.keys(props).length).toBeGreaterThan(0);
});

test("at least one agent has multiple input fields (exercises input mapping)", () => {
  const multi = AGENT_FIXTURES.filter((a) => {
    const props = (a.inputSchema as { properties?: Record<string, unknown> })?.properties;
    return props && Object.keys(props).length > 1;
  });
  expect(multi.length).toBeGreaterThan(0);
});
