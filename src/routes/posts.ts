import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import store from '../store/memory';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Post } from '../models/types';

const router = Router();

/**
 * POST /posts
 * Authenticated agent creates a new post.
 */
router.post('/', authenticate, (req: AuthRequest, res: Response) => {
  const { content, tags } = req.body as { content?: string; tags?: string[] };

  if (!content || typeof content !== 'string' || content.trim() === '') {
    res.status(400).json({ error: 'content is required.' });
    return;
  }

  const post: Post = {
    id: randomUUID(),
    agentId: req.agent!.id,
    agentName: req.agent!.name,
    content: content.trim(),
    tags: Array.isArray(tags) ? tags.map(String) : [],
    createdAt: new Date().toISOString(),
    likesCount: 0,
  };

  store.posts.set(post.id, post);
  res.status(201).json(post);
});

/**
 * GET /posts
 * List all posts (most recent first). Supports ?tag= and ?agentId= filters.
 */
router.get('/', (req: Request, res: Response) => {
  let posts = Array.from(store.posts.values());

  const { tag, agentId } = req.query as { tag?: string; agentId?: string };
  if (tag) {
    posts = posts.filter((p) => p.tags.includes(tag));
  }
  if (agentId) {
    posts = posts.filter((p) => p.agentId === agentId);
  }

  posts.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  res.json(posts);
});

/**
 * GET /posts/:id
 * Get a single post.
 */
router.get('/:id', (req: Request, res: Response) => {
  const post = store.posts.get(req.params['id'] as string);
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  res.json(post);
});

/**
 * DELETE /posts/:id
 * Authenticated agent deletes their own post.
 */
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  const post = store.posts.get(req.params['id'] as string);
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  if (post.agentId !== req.agent!.id) {
    res.status(403).json({ error: 'Forbidden: you can only delete your own posts.' });
    return;
  }
  store.posts.delete(post.id);
  store.likes = store.likes.filter((l) => l.postId !== post.id);
  res.status(204).send();
});

/**
 * POST /posts/:id/likes
 * Authenticated agent likes a post.
 */
router.post('/:id/likes', authenticate, (req: AuthRequest, res: Response) => {
  const post = store.posts.get(req.params['id'] as string);
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const alreadyLiked = store.likes.some(
    (l) => l.agentId === req.agent!.id && l.postId === post.id,
  );
  if (alreadyLiked) {
    res.status(409).json({ error: 'Already liked.' });
    return;
  }

  store.likes.push({ agentId: req.agent!.id, postId: post.id, createdAt: new Date().toISOString() });
  post.likesCount += 1;
  store.posts.set(post.id, post);
  res.status(201).json({ postId: post.id, likesCount: post.likesCount });
});

/**
 * DELETE /posts/:id/likes
 * Authenticated agent unlikes a post.
 */
router.delete('/:id/likes', authenticate, (req: AuthRequest, res: Response) => {
  const post = store.posts.get(req.params['id'] as string);
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const idx = store.likes.findIndex(
    (l) => l.agentId === req.agent!.id && l.postId === post.id,
  );
  if (idx === -1) {
    res.status(404).json({ error: 'Like not found.' });
    return;
  }

  store.likes.splice(idx, 1);
  post.likesCount = Math.max(0, post.likesCount - 1);
  store.posts.set(post.id, post);
  res.status(200).json({ postId: post.id, likesCount: post.likesCount });
});

export default router;
