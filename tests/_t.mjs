// A very small test helper: check(name, condition, detail) prints PASS/FAIL, done() prints the summary line and sets the exit code.

let passed = 0, failed = 0;

export function check(name, condition, detail = "") {
  if (condition) { passed++; console.log("PASS " + name); }
  else { failed++; console.log("FAIL " + name + (detail ? "  -> " + detail : "")); }
}

export const near = (a, b, tol) => Math.abs(a - b) <= tol;

export function done() {
  console.log(`${failed ? "FAILED" : "passed"}: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
