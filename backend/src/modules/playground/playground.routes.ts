import { Router, Request, Response } from 'express';
// During development, use the file-based store (persists to .data/playground.json)
// so folders/files survive page refresh without requiring user-based storage.
// Switch back to playgroundDbStore when PostgreSQL-based persistence is ready.
import { playgroundStore as playgroundDbStore } from './playground.storage';
import { executeRequest } from './playground.service';
import { ExecuteRequestPayload } from './playground.types';
import { WorkspaceItem } from './playground.workspace';
import { chatWithGemini, inspectRequest } from './playground.ai';

const router = Router();

// ============ GET Full playground data ============
router.get('/data', async (_req: Request, res: Response) => {
  try {
    const data = await playgroundDbStore.getData();
    // Create secure copy with masked secrets for UI
    const secureData = {
      ...data,
      environments: data.environments.map(env => ({
        ...env,
        secrets: Object.keys(env.secrets).reduce((acc, key) => {
          acc[key] = '••••••••'; // Mask all secret values
          return acc;
        }, {} as Record<string, string>)
      }))
    };
    res.json(secureData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get playground data' });
  }
});

// ============ Workspaces ============
router.get('/workspaces', async (_req: Request, res: Response) => {
  try {
    const workspaces = await playgroundDbStore.getWorkspaces();
    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get workspaces' });
  }
});

router.post('/workspaces', async (req: Request, res: Response) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Workspace name is required' });
    }
    const workspace = await playgroundDbStore.createWorkspace(name);
    res.status(201).json(workspace);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

router.patch('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const { name } = req.body || {};
    const ws = await playgroundDbStore.renameWorkspace(req.params.id, name);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(ws);
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename workspace' });
  }
});

router.post('/workspaces/:id/pin', async (req: Request, res: Response) => {
  try {
    const ws = await playgroundDbStore.togglePinWorkspace(req.params.id);
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json(ws);
  } catch (error) {
    res.status(500).json({ error: 'Failed to pin workspace' });
  }
});

router.delete('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const ok = await playgroundDbStore.deleteWorkspace(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Workspace not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// ============ Workspace APIs ============
router.get('/apis', async (_req: Request, res: Response) => {
  try {
    const apis = await playgroundDbStore.getWorkspaceApis();
    res.json(apis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get workspace APIs' });
  }
});

router.post('/apis', async (req: Request, res: Response) => {
  try {
    const api = req.body;
    if (!api || !api.id || !api.name) {
      return res.status(400).json({ error: 'API id and name are required' });
    }
    const createdApi = await playgroundDbStore.createApi(api);
    res.status(201).json(createdApi);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create API' });
  }
});

router.put('/apis/:id', async (req: Request, res: Response) => {
  try {
    const api = req.body;
    if (!api || api.id !== req.params.id) {
      return res.status(400).json({ error: 'API id mismatch' });
    }
    const updated = await playgroundDbStore.updateApi(api);
    if (!updated) return res.status(404).json({ error: 'API not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update API' });
  }
});

router.delete('/apis/:id', async (req: Request, res: Response) => {
  try {
    const ok = await playgroundDbStore.deleteApi(req.params.id);
    if (!ok) return res.status(404).json({ error: 'API not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete API' });
  }
});

// ============ Local APIs ============
router.get('/local-apis', async (_req: Request, res: Response) => {
  try {
    const apis = await playgroundDbStore.getLocalApis();
    res.json(apis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get local APIs' });
  }
});

router.post('/local-apis', async (req: Request, res: Response) => {
  try {
    const api = req.body;
    if (!api || !api.id || !api.baseUrl) {
      return res.status(400).json({ error: 'Local API id and baseUrl are required' });
    }
    const createdApi = await playgroundDbStore.createLocalApi(api);
    res.status(201).json(createdApi);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create local API' });
  }
});

router.delete('/local-apis/:id', async (req: Request, res: Response) => {
  try {
    const ok = await playgroundDbStore.deleteLocalApi(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Local API not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete local API' });
  }
});

// ============ Collections ============
router.get('/collections', async (_req: Request, res: Response) => {
  try {
    const collections = await playgroundDbStore.getCollections();
    res.json(collections);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get collections' });
  }
});

router.post('/collections', async (req: Request, res: Response) => {
  try {
    const col = req.body;
    if (!col || !col.name) {
      return res.status(400).json({ error: 'Collection name is required' });
    }
    const createdCol = await playgroundDbStore.createCollection(col);
    res.status(201).json(createdCol);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

router.put('/collections/:id', async (req: Request, res: Response) => {
  try {
    const col = req.body;
    if (!col || col.id !== req.params.id) {
      return res.status(400).json({ error: 'Collection id mismatch' });
    }
    const updated = await playgroundDbStore.updateCollection(col);
    if (!updated) return res.status(404).json({ error: 'Collection not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

router.delete('/collections/:id', async (req: Request, res: Response) => {
  try {
    const ok = await playgroundDbStore.deleteCollection(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Collection not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

router.post('/collections/:id/requests', async (req: Request, res: Response) => {
  try {
    const request = req.body;
    if (!request || !request.id) {
      return res.status(400).json({ error: 'Request id is required' });
    }
    const updated = await playgroundDbStore.addRequestToCollection(req.params.id, request);
    if (!updated) return res.status(404).json({ error: 'Collection not found' });
    res.status(201).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add request to collection' });
  }
});

router.delete('/collections/:collectionId/requests/:requestId', async (req: Request, res: Response) => {
  try {
    const updated = await playgroundDbStore.deleteRequestFromCollection(
      req.params.collectionId,
      req.params.requestId,
    );
    if (!updated) return res.status(404).json({ error: 'Collection not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete request from collection' });
  }
});

// ============ History ============
router.get('/history', async (_req: Request, res: Response) => {
  try {
    const history = await playgroundDbStore.getHistory();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

router.post('/history', async (req: Request, res: Response) => {
  try {
    const entry = req.body;
    if (!entry || !entry.requestName || !entry.url) {
      return res.status(400).json({ error: 'History entry requires requestName and url' });
    }
    const createdEntry = await playgroundDbStore.addHistoryEntry(entry);
    res.status(201).json(createdEntry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add history entry' });
  }
});

router.delete('/history', async (_req: Request, res: Response) => {
  try {
    await playgroundDbStore.clearHistory();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

router.delete('/history/:id', async (req: Request, res: Response) => {
  try {
    const ok = await playgroundDbStore.deleteHistoryEntry(req.params.id);
    if (!ok) return res.status(404).json({ error: 'History entry not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete history entry' });
  }
});

// ============ Environments ============
router.get('/environments', async (_req: Request, res: Response) => {
  try {
    const environments = await playgroundDbStore.getEnvironments();
    res.json(environments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get environments' });
  }
});

router.post('/environments', async (req: Request, res: Response) => {
  try {
    const env = req.body;
    if (!env || !env.name) {
      return res.status(400).json({ error: 'Environment name is required' });
    }
    const createdEnv = await playgroundDbStore.createEnvironment(env);
    res.status(201).json(createdEnv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create environment' });
  }
});

router.put('/environments/:id', async (req: Request, res: Response) => {
  try {
    const env = req.body;
    if (!env || env.id !== req.params.id) {
      return res.status(400).json({ error: 'Environment id mismatch' });
    }
    const updated = await playgroundDbStore.updateEnvironment(env);
    if (!updated) return res.status(404).json({ error: 'Environment not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update environment' });
  }
});

router.delete('/environments/:id', async (req: Request, res: Response) => {
  try {
    const ok = await playgroundDbStore.deleteEnvironment(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Environment not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete environment' });
  }
});

// ============ API Examples ============
router.get('/examples', async (_req: Request, res: Response) => {
  try {
    const examples = await playgroundDbStore.getApiExamples();
    res.json(examples);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get API examples' });
  }
});

router.post('/examples', async (req: Request, res: Response) => {
  try {
    const example = req.body;
    if (!example || !example.id || !example.name) {
      return res.status(400).json({ error: 'Example id and name are required' });
    }
    const createdExample = await playgroundDbStore.createApiExample(example);
    res.status(201).json(createdExample);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create API example' });
  }
});

router.delete('/examples/:id', async (req: Request, res: Response) => {
  try {
    const ok = await playgroundDbStore.deleteApiExample(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Example not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete API example' });
  }
});

// ============ Workspace Items (unified tree) ============
router.get('/workspace-items', async (_req: Request, res: Response) => {
  try {
    const items = await playgroundDbStore.getWorkspaceItems();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get workspace items' });
  }
});

router.post('/workspace-items/migrate', async (_req: Request, res: Response) => {
  try {
    const items = await playgroundDbStore.migrateFromLegacy();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to migrate workspace items' });
  }
});

router.post('/workspace-items', async (req: Request, res: Response) => {
  try {
    const item = req.body as Partial<WorkspaceItem>;
    if (!item || !item.name) {
      return res.status(400).json({ error: 'Workspace item name is required' });
    }
    const createdItem = await playgroundDbStore.createWorkspaceItem(item);
    res.status(201).json(createdItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create workspace item' });
  }
});

router.patch('/workspace-items/:id', async (req: Request, res: Response) => {
  try {
    const patch = req.body as Partial<WorkspaceItem>;
    const updated = await playgroundDbStore.updateWorkspaceItem(req.params.id, patch);
    if (!updated) return res.status(404).json({ error: 'Workspace item not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update workspace item' });
  }
});

router.delete('/workspace-items/:id', async (req: Request, res: Response) => {
  try {
    const ok = await playgroundDbStore.deleteWorkspaceItem(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Workspace item not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete workspace item' });
  }
});

router.post('/workspace-items/:id/move', async (req: Request, res: Response) => {
  try {
    const { parentId, order } = req.body || {};
    const updated = await playgroundDbStore.moveWorkspaceItem(req.params.id, parentId || null, order);
    if (!updated) return res.status(404).json({ error: 'Workspace item not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to move workspace item' });
  }
});

router.post('/workspace-items/:id/reorder', async (req: Request, res: Response) => {
  try {
    const { order } = req.body || {};
    if (typeof order !== 'number') {
      return res.status(400).json({ error: 'Order is required' });
    }
    const updated = await playgroundDbStore.reorderWorkspaceItem(req.params.id, order);
    if (!updated) return res.status(404).json({ error: 'Workspace item not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder workspace item' });
  }
});

router.post('/workspace-items/:id/pin', async (req: Request, res: Response) => {
  try {
    const updated = await playgroundDbStore.togglePinWorkspaceItem(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Workspace item not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to pin workspace item' });
  }
});

router.post('/workspace-items/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const copy = await playgroundDbStore.duplicateWorkspaceItem(req.params.id);
    if (!copy) return res.status(404).json({ error: 'Workspace item not found' });
    res.status(201).json(copy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to duplicate workspace item' });
  }
});

// ============ Gemini AI Chat (action-oriented) ============
router.post('/ai/chat', async (req: Request, res: Response) => {
  try {
    const { messages, playgroundContext } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }
    const result = await chatWithGemini(messages, playgroundContext || {});
    // Return structured action result - the Playground executes actions on request state
    res.json(result);
  } catch (err: any) {
    const status = err.message?.includes('not configured') ? 503 : 500;
    res.status(status).json({ error: err.message || 'AI chat failed' });
  }
});

// ============ Gemini Automatic Request Inspection ============
// Called whenever the API URL or important request state changes.
// Returns structured findings that the Playground turns into actionable cards.
router.post('/ai/inspect', async (req: Request, res: Response) => {
  try {
    const { playgroundContext } = req.body;
    if (!playgroundContext || typeof playgroundContext !== 'object') {
      return res.status(400).json({ error: 'Playground context is required' });
    }
    const findings = await inspectRequest(playgroundContext);
    res.json(findings);
  } catch (err: any) {
    const status = err.message?.includes('not configured') ? 503 : 500;
    res.status(status).json({ error: err.message || 'Request inspection failed' });
  }
});

// ============ Execute Request ============
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { config, environment } = req.body as ExecuteRequestPayload;
    if (!config || !config.url) {
      return res.status(400).json({ error: 'Request config with a URL is required' });
    }
    const result = await executeRequest(config, environment || null);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Request execution failed' });
  }
});

export default router;