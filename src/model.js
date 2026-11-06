export const uid = () => crypto.randomUUID();
export const emptyTab = () => ({
  id: uid(),
  file: null,
  content: "",
  zoom: 1,
  scroll: 0,
  target: null,
  viewId: uid(),
  back: [],
  forward: [],
});
export const initialTabs = () => {
  const tab = emptyTab();
  return { tabs: [tab], activeId: tab.id, closed: [] };
};
export function tabsReducer(state, action) {
  switch (action.type) {
    case "new": {
      const t = emptyTab();
      return { ...state, tabs: [...state.tabs, t], activeId: t.id };
    }
    case "activate":
      return state.tabs.some((t) => t.id === action.id)
        ? { ...state, activeId: action.id }
        : state;
    case "open": {
      const target = action.newTab
        ? null
        : state.tabs.find((t) => t.id === (action.tabId || state.activeId));
      const sameFile = target?.file?.id === action.file.id;
      const t = sameFile
        ? {
            ...target,
            file: action.file,
            content: action.content,
            target: action.target || null,
          }
        : {
            ...emptyTab(),
            ...(!action.newTab && target ? { id: target.id } : {}),
            file: action.file,
            content: action.content,
            target: action.target || null,
            back: target?.file
              ? [...(target.back || []), visitSnapshot(target, action.scroll)]
              : [],
          };
      return {
        ...state,
        tabs: target
          ? state.tabs.map((x) => (x.id === target.id ? t : x))
          : [...state.tabs, t],
        activeId: t.id,
      };
    }
    case "navigate": {
      const id = action.id || state.activeId;
      const tab = state.tabs.find((t) => t.id === id);
      const direction = action.direction === "back" ? "back" : "forward",
        opposite = direction === "back" ? "forward" : "back";
      const destination = tab?.[direction]?.at(-1);
      if (!destination) return state;
      const updated = {
        ...tab,
        ...destination,
        target: null,
        [direction]: tab[direction].slice(0, -1),
        [opposite]: [
          ...(tab[opposite] || []),
          visitSnapshot(tab, action.scroll),
        ],
      };
      return {
        ...state,
        tabs: state.tabs.map((t) => (t.id === id ? updated : t)),
      };
    }
    case "patch":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === (action.id || state.activeId)
            ? { ...t, ...action.patch }
            : t,
        ),
      };
    case "close": {
      const id = action.id || state.activeId,
        index = state.tabs.findIndex((t) => t.id === id),
        tab = state.tabs[index];
      if (!tab) return state;
      const tabs = state.tabs.filter((t) => t.id !== id);
      return {
        ...state,
        tabs,
        activeId:
          state.activeId === id
            ? tabs[Math.min(index, tabs.length - 1)]?.id || null
            : state.activeId,
        closed: [tab, ...state.closed].slice(0, 20),
      };
    }
    case "close-others":
      return {
        ...state,
        tabs: state.tabs.filter((t) => t.id === state.activeId),
        closed: [
          ...state.tabs.filter((t) => t.id !== state.activeId),
          ...state.closed,
        ].slice(0, 20),
      };
    case "reopen": {
      const [tab, ...closed] = state.closed;
      if (!tab) return state;
      return { ...state, tabs: [...state.tabs, tab], activeId: tab.id, closed };
    }
    default:
      return state;
  }
}
export const clampZoom = (z) =>
  Math.min(3, Math.max(0.5, Math.round(z * 10) / 10));
export function referenceNodes(files) {
  const root = [];
  for (const file of files) {
    const parts = (file.relative || file.name).split("/");
    let parent = root;
    for (const name of parts.slice(0, -1)) {
      let folder = parent.find((n) => n.type === "folder" && n.name === name);
      if (!folder) {
        folder = { id: uid(), type: "folder", name, children: [] };
        parent.push(folder);
      }
      parent = folder.children;
    }
    parent.push({ id: uid(), type: "file", file });
  }
  return root;
}

function visitSnapshot(tab, scroll) {
  return {
    file: tab.file,
    content: tab.content,
    zoom: tab.zoom,
    scroll: scroll ?? tab.scroll,
    target: null,
    viewId: tab.viewId,
  };
}
