import { Router, Response } from 'express';
import store from '../store/memory';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /feed
 * Returns posts from agents that the authenticated agent follows,
 * sorted by most recent first.
 */
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  const followeeIds = store.follows
    .filter((f) => f.followerId === req.agent!.id)
    .map((f) => f.followeeId);

  const feedPosts = Array.from(store.posts.values())
    .filter((p) => followeeIds.includes(p.agentId))
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  res.json(feedPosts);
});

export default router;
