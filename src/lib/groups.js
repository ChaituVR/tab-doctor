// Tab groups created by Tab Doctor (site groups, Stale). Other rules may move tabs out of these;
// groups the user made by hand are never touched.
const KEY = 'ownGroups';
const SITE_KEY = 'siteGroups';
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
  const sites = await siteGroups();
  const stale = Object.keys(sites).filter(k => sites[k] === id);
  if (!ids.delete(id) && !stale.length) return;
  for (const k of stale) delete sites[k];
  await area().set({ [KEY]: [...ids], [SITE_KEY]: sites });
}

/** windowId:label → group id, so a site group is found again even after the user or the namer retitles it. */
export async function siteGroups() {
  const { [SITE_KEY]: map } = await area().get(SITE_KEY);
  return map || {};
}

export async function rememberSiteGroup(windowId, label, groupId) {
  const map = await siteGroups();
  const key = `${windowId}:${label}`;
  if (map[key] === groupId) return;
  await area().set({ [SITE_KEY]: { ...map, [key]: groupId } });
}
