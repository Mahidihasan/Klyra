// =========================================================
// WORKSPACE UTILITIES
// Tree operations, tab management, and state sync helpers
// for the unified workspace model.
// =========================================================

import {
  WorkspaceItem,
  WorkspaceItemKind,
  OpenRequestTab,
  RequestConfig,
  PlaygroundResponse,
} from '../types/playground';
import { generateId, emptyRequestConfig } from './playground';

// =========================================================
// TREE OPERATIONS
// =========================================================

/** Build a tree of workspace items from a flat list. */
export function buildWorkspaceTree(
  items: WorkspaceItem[],
): Array<WorkspaceItem & { children: Array<WorkspaceItem & { children: WorkspaceItem[] }> }> {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const map = new Map<string, any>();
  const roots: any[] = [];

  sorted.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  sorted.forEach((item) => {
    const node = map.get(item.id);
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/** Get all descendant ids of an item (including itself). */
export function getDescendantIds(items: WorkspaceItem[], id: string): string[] {
  const result = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    items.forEach((item) => {
      if (item.parentId && result.has(item.parentId) && !result.has(item.id)) {
        result.add(item.id);
        changed = true;
      }
    });
  }
  return Array.from(result);
}

/** Find an item by id. */
export function findWorkspaceItem(items: WorkspaceItem[], id: string): WorkspaceItem | undefined {
  return items.find((i) => i.id === id);
}

/** Get children of a parent (or roots if parentId is null). */
export function getChildrenOf(items: WorkspaceItem[], parentId: string | null): WorkspaceItem[] {
  return items
    .filter((i) => (parentId ? i.parentId === parentId : !i.parentId))
    .sort((a, b) => a.order - b.order);
}

/** Get the next order value for a new item under a parent. */
export function getNextOrder(items: WorkspaceItem[], parentId?: string): number {
  const siblings = items.filter((i) => (parentId ? i.parentId === parentId : !i.parentId));
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((s) => s.order)) + 1;
}

/** Filter items by search query (name, url, method). */
export function filterWorkspaceItems(items: WorkspaceItem[], query: string): WorkspaceItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      (i.url || '').toLowerCase().includes(q) ||
      (i.method || '').toLowerCase().includes(q),
  );
}

/** Get pinned items. */
export function getPinnedItems(items: WorkspaceItem[]): WorkspaceItem[] {
  return items.filter((i) => i.isPinned).sort((a, b) => a.order - b.order);
}

// =========================================================
// TAB MANAGEMENT
// =========================================================

/** Create a new request tab from a config. */
export function createTabFromConfig(config: RequestConfig, itemId?: string): OpenRequestTab {
  return {
    tabId: generateId(),
    itemId,
    name: config.name || 'Untitled Request',
    config: { ...config, id: config.id || generateId() },
    isDirty: false,
  };
}

/** Create a new empty request tab. */
export function createEmptyTab(): OpenRequestTab {
  const config = emptyRequestConfig();
  return createTabFromConfig(config);
}

/** Create a tab from a workspace item. */
export function createTabFromItem(item: WorkspaceItem): OpenRequestTab {
  const config = item.request ? { ...item.request } : emptyRequestConfig();
  config.name = item.name;
  if (item.method) config.method = item.method as RequestConfig['method'];
  if (item.url) config.url = item.url;
  return {
    tabId: generateId(),
    itemId: item.id,
    name: item.name,
    config,
    isDirty: false,
  };
}

/** Find an existing tab for an item. */
export function findTabForItem(tabs: OpenRequestTab[], itemId: string): OpenRequestTab | undefined {
  return tabs.find((t) => t.itemId === itemId);
}

/** Check if a tab has unsaved changes. */
export function isTabDirty(tab: OpenRequestTab): boolean {
  return tab.isDirty;
}

/** Serialize a tab's config for persistence. */
export function serializeTabConfig(config: RequestConfig): RequestConfig {
  return JSON.parse(JSON.stringify(config));
}

// =========================================================
// STATE SYNC HELPERS
// =========================================================

/** Sync a workspace item's request config back into the item list. */
export function syncItemFromTab(
  items: WorkspaceItem[],
  tab: OpenRequestTab,
): WorkspaceItem[] {
  if (!tab.itemId) return items;
  return items.map((item) => {
    if (item.id === tab.itemId) {
      return {
        ...item,
        name: tab.name,
        request: serializeTabConfig(tab.config),
        method: tab.config.method,
        url: tab.config.url,
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });
}

/** Create a workspace item from a tab (for saving). */
export function createItemFromTab(
  tab: OpenRequestTab,
  kind: WorkspaceItemKind = 'request',
  parentId?: string,
  order = 0,
): WorkspaceItem {
  return {
    id: generateId(),
    kind,
    name: tab.name || 'Untitled Request',
    parentId,
    order,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPinned: false,
    request: serializeTabConfig(tab.config),
    method: tab.config.method,
    url: tab.config.url,
  };
}

/** Compare two configs to detect changes (for dirty tracking). */
export function configsEqual(a: RequestConfig, b: RequestConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Build a response cache keyed by tab id. */
export function buildResponseCache(
  tabs: OpenRequestTab[],
  activeTabId: string,
  response: PlaygroundResponse | null,
): Record<string, { response: PlaygroundResponse | null }> {
  const cache: Record<string, { response: PlaygroundResponse | null }> = {};
  tabs.forEach((tab) => {
    cache[tab.tabId] = { response: tab.tabId === activeTabId ? response : null };
  });
  return cache;
}

// =========================================================
// MIGRATION
// =========================================================

/** Convert legacy collections into workspace items (client-side fallback). */
export function migrateLegacyToItems(
  collections: Array<{ id: string; name: string; description?: string; color?: string; requests: Array<{ id: string; name: string; config: RequestConfig }> }>,
): WorkspaceItem[] {
  const items: WorkspaceItem[] = [];
  let order = 0;
  const now = new Date().toISOString();

  collections.forEach((col) => {
    const colItem: WorkspaceItem = {
      id: `wi-col-${col.id}`,
      kind: 'collection',
      name: col.name,
      order: order++,
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      description: col.description,
      color: col.color,
    };
    items.push(colItem);
    col.requests.forEach((req) => {
      items.push({
        id: `wi-req-${req.id}`,
        kind: 'request',
        name: req.name,
        parentId: colItem.id,
        order: order++,
        createdAt: now,
        updatedAt: now,
        isPinned: false,
        collectionId: col.id,
        request: req.config,
        method: req.config.method,
        url: req.config.url,
      });
    });
  });

  return items;
}