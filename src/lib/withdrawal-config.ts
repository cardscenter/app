// Configurable knobs for the payout system. Min keeps manual processing worth
// the effort; no fee since SEPA is free within EU; only one active request
// per user enforces a clean audit trail (admin sees what's pending without
// confusion). Lives outside the "use server" actions file so server components
// and client UIs can import the value directly.
export const WITHDRAWAL_MIN_AMOUNT = 10;
