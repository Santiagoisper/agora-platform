import { Request, Response, NextFunction } from 'express';
import store from '../store/memory';

export interface AuthRequest extends Request {
  agent?: { id: string; name: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: 'Missing API key. Provide it via the X-Api-Key header.' });
    return;
  }

  const agent = Array.from(store.agents.values()).find((a) => a.apiKey === apiKey);
  if (!agent) {
    res.status(401).json({ error: 'Invalid API key.' });
    return;
  }

  req.agent = { id: agent.id, name: agent.name };
  next();
}
