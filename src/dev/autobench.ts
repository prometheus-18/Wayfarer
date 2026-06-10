/**
 * Dev-only benchmark autorun.
 *
 * Lets the development workstation trigger the on-device stress suite without
 * touching the screen: flip `enabled` to true, Metro fast-refreshes the app,
 * the suite runs through the real service layer, and every result is printed
 * to the Metro console with a `[BENCH]` prefix (machine-readable on the dev
 * box). No-op in release builds (`__DEV__` guard) — the user-facing entry
 * point is the Benchmark sheet in the privacy footer.
 */
import { useEffect } from 'react';
import { runStressSuite, type CaseStatus, type StressGroup } from '../qvac/stress';

export const AUTOBENCH: { enabled: boolean; groups: StressGroup[] } = {
  enabled: true,
  groups: ['ocr', 'assistant', 'probe'],
};

export function useAutoBenchmark(): void {
  useEffect(() => {
    if (!__DEV__ || !AUTOBENCH.enabled) return;
    const seen = new Map<string, CaseStatus>();
    const timer = setTimeout(async () => {
      console.log(`[BENCH] starting groups=${AUTOBENCH.groups.join(',')}`);
      try {
        const report = await runStressSuite({
          groups: AUTOBENCH.groups,
          onUpdate: (results) => {
            for (const r of results) {
              if (seen.get(r.id) === r.status) continue;
              seen.set(r.id, r.status);
              if (r.status === 'running') console.log(`[BENCH] ▶ ${r.id} ${r.title}`);
              if (r.status === 'pass' || r.status === 'fail' || r.status === 'skip') {
                console.log(
                  `[BENCH] ${r.status.toUpperCase()} ${r.id} (${r.ms ?? '?'}ms)${r.note ? ` — ${r.note}` : ''}`,
                );
              }
            }
          },
        });
        console.log(`[BENCH] REPORT ${JSON.stringify(report)}`);
        console.log('[BENCH] DONE');
      } catch (error) {
        console.log(`[BENCH] CRASH ${String((error as Error)?.message ?? error)}`);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);
}
