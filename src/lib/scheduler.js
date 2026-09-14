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
