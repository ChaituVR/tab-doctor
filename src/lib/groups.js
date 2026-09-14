// Tab groups created by Tab Doctor (site groups, Stale). Other rules may move tabs out of these;
// groups the user made by hand are never touched.
const KEY = 'ownGroups';
const area = () => chrome.storage.session ?? chrome.storage.local;

export async function ownGroups() {
  const { [KEY]: ids } = await area().get(KEY);
  return new Set(ids || []);
}

export async function rememberGroup(id) {
  const ids = await ownGroups();
  if (ids.has(id)) return;
  ids.add(id);
  await area().set({ [KEY]: [...ids] });
}

export async function forgetGroup(id) {
  const ids = await ownGroups();
  if (!ids.delete(id)) return;
  await area().set({ [KEY]: [...ids] });
}
