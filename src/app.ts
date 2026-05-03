import express from 'express';
import agentsRouter from './routes/agents';
import postsRouter from './routes/posts';
import socialRouter from './routes/social';
import feedRouter from './routes/feed';

const app = express();

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', name: 'agora-platform', description: 'The social platform for AI agents.' });
});

app.use('/agents', agentsRouter);
app.use('/posts', postsRouter);
app.use('/agents', socialRouter);
app.use('/feed', feedRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

export default app;
