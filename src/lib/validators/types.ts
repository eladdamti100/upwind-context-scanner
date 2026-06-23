// src/lib/validators/types.ts
// Shared contract for the universal validator library. Each validator takes a
// RAW candidate string and returns a structural/semantic verdict. These run
// where the raw value exists (a customer-side scanner or the Go generation
// layer); the masked demo pipeline consumes the bridged result via signals.

export interface ValidatorVerdict {
  valid: boolean;     // does the value satisfy its format's intrinsic structure?
  validator: string;  // name of the validator that produced this verdict
  reason?: string;    // human/ML explanation (why valid / why rejected)
}

export type Validator = (raw: string) => ValidatorVerdict;

// Convenience constructors keep call sites terse and consistent.
export const ok = (validator: string, reason?: string): ValidatorVerdict => ({
  valid: true,
  validator,
  reason,
});

export const fail = (validator: string, reason: string): ValidatorVerdict => ({
  valid: false,
  validator,
  reason,
});

// Strip spaces and dashes — most numeric identifiers are written with grouping
// separators a checksum must ignore.
export const digitsOnly = (s: string): string => s.replace(/[\s-]/g, '');
