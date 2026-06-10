/**
 * Per-engine async serialization.
 *
 * The QVAC worker replaces an in-flight job when a new request arrives for
 * the same engine (observed on-device as "Stale job replaced by new run" in
 * the t-concurrent stress case), so concurrent callers must queue rather
 * than race. Each key gets its own FIFO chain; a failed task never blocks
 * the tasks queued behind it.
 */
const tails = new Map<string, Promise<unknown>>();

export function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const tail = tails.get(key) ?? Promise.resolve();
  const run = tail.then(task, task);
  tails.set(key, run.then(
    () => undefined,
    () => undefined,
  ));
  return run;
}
