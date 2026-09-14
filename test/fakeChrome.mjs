// Minimal in-memory stand-in for the chrome.* APIs the rules and libs touch.
export function fakeChrome({ tabs = [], groups = [] } = {}) {
  const state = {
    tabs: tabs.map(t => ({ pinned: false, active: false, groupId: -1, windowId: 1, ...t })),
    groups: groups.map(g => ({ title: '', color: 'grey', collapsed: false, windowId: 1, ...g })),
    nextGroupId: 100,
    removed: [], discarded: [], activated: [], focused: [],
    session: {}, local: {}
  };
  const matches = q => item => Object.entries(q).every(([k, v]) => item[k] === v);
  const area = store => ({
    get: async k => k == null ? { ...store } : Array.isArray(k) ? Object.fromEntries(k.map(x => [x, store[x]])) : { [k]: store[k] },
    set: async v => { Object.assign(store, v); },
    remove: async k => { for (const x of [].concat(k)) delete store[x]; }
  });
  const tab = id => {
    const t = state.tabs.find(t => t.id === id);
    if (!t) throw new Error(`No tab with id: ${id}.`);
    return t;
  };
  const group = id => {
    const g = state.groups.find(g => g.id === id);
    if (!g) throw new Error(`No group with id: ${id}.`);
    return g;
  };
  const chrome = {
    storage: { session: area(state.session), local: area(state.local) },
    tabs: {
      query: async q => state.tabs.filter(matches(q)),
      get: async id => tab(id),
      remove: async id => { tab(id); state.tabs = state.tabs.filter(t => t.id !== id); state.removed.push(id); },
      update: async (id, props) => {
        const t = tab(id);
        if (props.active) { state.tabs.filter(x => x.windowId === t.windowId).forEach(x => { x.active = false; }); state.activated.push(id); }
        return Object.assign(t, props);
      },
      group: async ({ tabIds, groupId, createProperties }) => {
        let gid = groupId;
        if (gid == null) { gid = state.nextGroupId++; state.groups.push({ id: gid, windowId: createProperties?.windowId ?? 1, title: '', color: 'grey', collapsed: false }); }
        for (const id of tabIds) tab(id).groupId = gid;
        return gid;
      },
      ungroup: async ids => { for (const id of [].concat(ids)) tab(id).groupId = -1; },
      discard: async id => { tab(id).discarded = true; state.discarded.push(id); }
    },
    tabGroups: {
      query: async q => state.groups.filter(matches(q)),
      get: async id => group(id),
      update: async (id, props) => Object.assign(group(id), props)
    },
    windows: {
      update: async id => { state.focused.push(id); return { id }; },
      get: async id => ({ id, left: 0, top: 0, width: 1000, height: 800 })
    },
    runtime: { getURL: p => `chrome-extension://test/${p}` }
  };
  globalThis.chrome = chrome;
  return { chrome, state };
}
