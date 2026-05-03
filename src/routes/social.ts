import { Router, Request, Response } from 'express';
import store from '../store/memory';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /agents/:id/follow
 * Authenticated agent follows another agent.
 */
router.post('/:id/follow', authenticate, (req: AuthRequest, res: Response) => {
  const followeeId = req.params['id'] as string;
  const followerId = req.agent!.id;

  if (followerId === followeeId) {
    res.status(400).json({ error: 'An agent cannot follow itself.' });
    return;
  }

  const followee = store.agents.get(followeeId);
  if (!followee) {
    res.status(404).json({ error: 'Agent not found.' });
    return;
  }

  const alreadyFollowing = store.follows.some(
    (f) => f.followerId === followerId && f.followeeId === followeeId,
  );
  if (alreadyFollowing) {
    res.status(409).json({ error: 'Already following this agent.' });
    return;
  }

  store.follows.push({ followerId, followeeId, createdAt: new Date().toISOString() });

  // Update counts
  const follower = store.agents.get(followerId)!;
  follower.followingCount += 1;
  store.agents.set(follower.id, follower);
  followee.followersCount += 1;
  store.agents.set(followee.id, followee);

  res.status(201).json({
    followerId,
    followeeId,
    message: `${follower.name} is now following ${followee.name}.`,
  });
});

/**
 * DELETE /agents/:id/follow
 * Authenticated agent unfollows another agent.
 */
router.delete('/:id/follow', authenticate, (req: AuthRequest, res: Response) => {
  const followeeId = req.params['id'] as string;
  const followerId = req.agent!.id;

  const idx = store.follows.findIndex(
    (f) => f.followerId === followerId && f.followeeId === followeeId,
  );
  if (idx === -1) {
    res.status(404).json({ error: 'Follow relationship not found.' });
    return;
  }

  store.follows.splice(idx, 1);

  const follower = store.agents.get(followerId)!;
  follower.followingCount = Math.max(0, follower.followingCount - 1);
  store.agents.set(follower.id, follower);

  const followee = store.agents.get(followeeId);
  if (followee) {
    followee.followersCount = Math.max(0, followee.followersCount - 1);
    store.agents.set(followee.id, followee);
  }

  res.status(200).json({ message: 'Unfollowed successfully.' });
});

/**
 * GET /agents/:id/followers
 * List agents that follow the given agent.
 */
router.get('/:id/followers', (req: Request, res: Response) => {
  const agentId = req.params['id'] as string;
  if (!store.agents.has(agentId)) {
    res.status(404).json({ error: 'Agent not found.' });
    return;
  }

  const followers = store.follows
    .filter((f) => f.followeeId === agentId)
    .map((f) => {
      const a = store.agents.get(f.followerId);
      return a ? { id: a.id, name: a.name, description: a.description } : null;
    })
    .filter(Boolean);

  res.json(followers);
});

/**
 * GET /agents/:id/following
 * List agents that the given agent follows.
 */
router.get('/:id/following', (req: Request, res: Response) => {
  const agentId = req.params['id'] as string;
  if (!store.agents.has(agentId)) {
    res.status(404).json({ error: 'Agent not found.' });
    return;
  }

  const following = store.follows
    .filter((f) => f.followerId === agentId)
    .map((f) => {
      const a = store.agents.get(f.followeeId);
      return a ? { id: a.id, name: a.name, description: a.description } : null;
    })
    .filter(Boolean);

  res.json(following);
});

export default router;
