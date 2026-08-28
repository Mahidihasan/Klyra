// =========================================================
// UNIFIED WORKSPACE ITEM MODEL
// Represents requests, folders, collections, test files
// in a single hierarchical tree with stable IDs, ordering,
// parent relationships, timestamps, and metadata.
// =========================================================

import { RequestConfig } from './playground.types';

export type WorkspaceItemKind =
  | 'request'
  | 'folder'
  | 'collection'
  | 'test';

export interface WorkspaceItem {
  id: string;
  kind: WorkspaceItemKind;
  name: string;
  // Tree relationship
  parentId?: string;          // parent folder/collection id (undefined = root)
  order: number;
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
  // Pinning
  isPinned?: boolean;
  // Metadata (kind-specific)
  collectionId?: string;      // for requests inside collections
  request?: RequestConfig;    // for request items
  description?: string;
  color?: string;
  // Derived / workspace references
  workspaceId?: string;       // which user workspace this belongs to
  apiId?: string;             // optional source API reference
  endpointId?: string;        // optional source endpoint reference
  method?: string;            // optional display method for request items
  url?: string;               // optional display URL
}

// An "open tab" preserves a request's working state while switching.
export interface OpenRequestTab {
  tabId: string;              // unique tab id (stable across renames)
  itemId?: string;            // workspace item id if saved/loaded from tree
  name: string;
  config: RequestConfig;
  isDirty: boolean;
  responseRef?: {
    responseId: string;       // id of last response for this tab
    // Keep lightweight - full response lives in tab response cache
  };
}

// Response cache per tab (so switching tabs doesn't lose results)
export interface TabResponseCache {
  [tabId: string]: {
    response: any | null;
  };
}