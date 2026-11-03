export const CMOS_MODEL: { readonly id: string; readonly name: string; readonly notSilicon: string };
export const CMOS_BANNER: string;
export const LOGIC: { readonly highFrac: number; readonly lowFrac: number };
export function cmosParams(over?: Record<string, number>): CmosParams;
export function assessInverter(p: CmosParams, opts?: { steps?: number; noiseSigma?: number; noiseDraws?: number; seed?: number }): InverterReport;
export function nandTruth(p: CmosParams): { a: number; b: number; expect: number; vout: number | null; y: number | string; defined: boolean; ok: boolean }[];
export interface CmosParams { VDD: number; Vth0: number; T: number; T0: number; dVth: number; kn0: number; kp0: number; lambda: number; Cload: number }
export interface InverterReport {
  model: string; banner: string; failed: boolean; validLow: boolean; validHigh: boolean;
  vol: number | null; voh: number | null; vil: number | null; vih: number | null; nml: number | null; nmh: number | null;
  reason: string; noiseErrors: number; noiseDraws: number;
  delay: { fall_s: number | null; rise_s: number | null; note: string };
  curve: { vin: number; vout: number | null; defined: boolean }[];
}
