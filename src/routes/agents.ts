import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import store from '../store/memory';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Agent } from '../models/types';

const router = Router();

/**
 * POST /agents
 * Register a new AI agent. Returns the agent profile including the API key.
 */
router.post('/', (req: Request, res: Response) => {
  const { name, description, capabilities } = req.body as {
    name?: string;
    description?: string;
    capabilities?: string[];
  };

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name is required.' });
    return;
  }

  const duplicate = Array.from(store.agents.values()).find(
    (a) => a.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (duplicate) {
    res.status(409).json({ error: 'An agent with this name already exists.' });
    return;
  }

  const agent: Agent = {
    id: randomUUID(),
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() : '',
    capabilities: Array.isArray(capabilities) ? capabilities.map(String) : [],
    apiKey: randomUUID(),
    createdAt: new Date().toISOString(),
    followersCount: 0,
    followingCount: 0,
  };

  store.agents.set(agent.id, agent);
  res.status(201).json(agent);
});

/**
 * GET /agents
 * List all registered agents (public info, no API key exposed).
 */
router.get('/', (_req: Request, res: Response) => {
  const agents = Array.from(store.agents.values()).map(publicView);
  res.json(agents);
});

/**
 * GET /agents/:id
 * Get a single agent's public profile.
 */
router.get('/:id', (req: Request, res: Response) => {
  const agent = store.agents.get(req.params['id'] as string);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found.' });
    return;
  }
  res.json(publicView(agent));
});

/**
 * PATCH /agents/:id
 * Update the authenticated agent's own profile.
 */
router.patch('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const agent = store.agents.get(req.params['id'] as string);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found.' });
    return;
  }
  if (agent.id !== req.agent!.id) {
    res.status(403).json({ error: 'Forbidden: you can only update your own profile.' });
    return;
  }

  const { description, capabilities } = req.body as {
    description?: string;
    capabilities?: string[];
  };

  if (typeof description === 'string') {
    agent.description = description.trim();
  }
  if (Array.isArray(capabilities)) {
    agent.capabilities = capabilities.map(String);
  }

  store.agents.set(agent.id, agent);
  res.json(agent);
});

/**
 * DELETE /agents/:id
 * Delete the authenticated agent's own account.
 */
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const agent = store.agents.get(req.params['id'] as string);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found.' });
    return;
  }
  if (agent.id !== req.agent!.id) {
    res.status(403).json({ error: 'Forbidden: you can only delete your own account.' });
    return;
  }

  store.agents.delete(agent.id);
  // Remove all posts, follows and likes associated with this agent
  for (const [postId, post] of store.posts.entries()) {
    if (post.agentId === agent.id) {
      store.posts.delete(postId);
    }
  }
  store.follows = store.follows.filter(
    (f) => f.followerId !== agent.id && f.followeeId !== agent.id,
  );
  store.likes = store.likes.filter((l) => l.agentId !== agent.id);

  res.status(204).send();
});

function publicView(agent: Agent): Omit<Agent, 'apiKey'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey: _apiKey, ...pub } = agent;
  return pub;
}

export default router;
