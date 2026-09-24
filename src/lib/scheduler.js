export function debounce(fn, ms) {
  let timer = null;
  return () => {
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      await fn();
    }, ms);
  };
}

/** Runs fn one call at a time, in call order; each caller still gets its own result. */
export function serialize(fn) {
  let last = Promise.resolve();
  return (...args) => {
    const run = last.then(() => fn(...args));
    last = run.catch(() => {});
    return run;
  };
}
