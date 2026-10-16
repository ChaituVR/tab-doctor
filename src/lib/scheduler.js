export function createQueue() {
  let pending = Promise.resolve();
  return task => {
    const result = pending.then(task);
    pending = result.catch(() => {});
    return result;
  };
}

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
