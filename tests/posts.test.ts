import request from 'supertest';
import app from '../src/app';
import { resetStore } from '../src/store/memory';

beforeEach(() => resetStore());

async function registerAgent(name: string) {
  const res = await request(app).post('/agents').send({ name });
  return res.body as { id: string; apiKey: string; name: string };
}

describe('Posts API', () => {
  it('POST /posts creates a post for authenticated agent', async () => {
    const agent = await registerAgent('PostBot');

    const res = await request(app)
      .post('/posts')
      .set('X-Api-Key', agent.apiKey)
      .send({ content: 'Hello, Agora!', tags: ['intro', 'ai'] });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.content).toBe('Hello, Agora!');
    expect(res.body.agentId).toBe(agent.id);
    expect(res.body.agentName).toBe(agent.name);
    expect(res.body.tags).toEqual(['intro', 'ai']);
    expect(res.body.likesCount).toBe(0);
  });

  it('POST /posts rejects missing content', async () => {
    const agent = await registerAgent('ContentBot');
    const res = await request(app)
      .post('/posts')
      .set('X-Api-Key', agent.apiKey)
      .send({ tags: ['tag'] });
    expect(res.status).toBe(400);
  });

  it('POST /posts requires authentication', async () => {
    const res = await request(app).post('/posts').send({ content: 'Sneaky post' });
    expect(res.status).toBe(401);
  });

  it('GET /posts returns all posts sorted by most recent', async () => {
    const agent = await registerAgent('FeedAgent');
    await request(app).post('/posts').set('X-Api-Key', agent.apiKey).send({ content: 'First' });
    await request(app).post('/posts').set('X-Api-Key', agent.apiKey).send({ content: 'Second' });

    const res = await request(app).get('/posts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // Most recent first
    expect(res.body[0].content).toBe('Second');
  });

  it('GET /posts?tag= filters by tag', async () => {
    const agent = await registerAgent('TagAgent');
    await request(app).post('/posts').set('X-Api-Key', agent.apiKey).send({ content: 'Tagged post', tags: ['ml'] });
    await request(app).post('/posts').set('X-Api-Key', agent.apiKey).send({ content: 'Untagged post' });

    const res = await request(app).get('/posts?tag=ml');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('Tagged post');
  });

  it('GET /posts?agentId= filters by agent', async () => {
    const agentA = await registerAgent('AgentAlpha');
    const agentB = await registerAgent('AgentBeta');
    await request(app).post('/posts').set('X-Api-Key', agentA.apiKey).send({ content: 'Alpha post' });
    await request(app).post('/posts').set('X-Api-Key', agentB.apiKey).send({ content: 'Beta post' });

    const res = await request(app).get(`/posts?agentId=${agentA.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('Alpha post');
  });

  it('GET /posts/:id returns a single post', async () => {
    const agent = await registerAgent('SinglePostBot');
    const created = await request(app)
      .post('/posts')
      .set('X-Api-Key', agent.apiKey)
      .send({ content: 'My post' });

    const res = await request(app).get(`/posts/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('My post');
  });

  it('GET /posts/:id returns 404 for unknown post', async () => {
    const res = await request(app).get('/posts/nonexistent');
    expect(res.status).toBe(404);
  });

  it('DELETE /posts/:id removes the post', async () => {
    const agent = await registerAgent('DelPostBot');
    const created = await request(app)
      .post('/posts')
      .set('X-Api-Key', agent.apiKey)
      .send({ content: 'To be deleted' });

    const del = await request(app)
      .delete(`/posts/${created.body.id}`)
      .set('X-Api-Key', agent.apiKey);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/posts/${created.body.id}`);
    expect(get.status).toBe(404);
  });

  it('DELETE /posts/:id is forbidden for another agent', async () => {
    const agentA = await registerAgent('OwnerAgent');
    const agentB = await registerAgent('ThiefAgent');
    const created = await request(app)
      .post('/posts')
      .set('X-Api-Key', agentA.apiKey)
      .send({ content: "AgentA's post" });

    const res = await request(app)
      .delete(`/posts/${created.body.id}`)
      .set('X-Api-Key', agentB.apiKey);
    expect(res.status).toBe(403);
  });

  it('POST /posts/:id/likes increments like count', async () => {
    const agentA = await registerAgent('LikerA');
    const agentB = await registerAgent('LikerB');
    const post = await request(app)
      .post('/posts')
      .set('X-Api-Key', agentA.apiKey)
      .send({ content: 'Like this!' });

    const like = await request(app)
      .post(`/posts/${post.body.id}/likes`)
      .set('X-Api-Key', agentB.apiKey);
    expect(like.status).toBe(201);
    expect(like.body.likesCount).toBe(1);
  });

  it('POST /posts/:id/likes rejects duplicate like', async () => {
    const agentA = await registerAgent('DupeLikerA');
    const agentB = await registerAgent('DupeLikerB');
    const post = await request(app)
      .post('/posts')
      .set('X-Api-Key', agentA.apiKey)
      .send({ content: 'Like only once!' });

    await request(app).post(`/posts/${post.body.id}/likes`).set('X-Api-Key', agentB.apiKey);
    const res = await request(app)
      .post(`/posts/${post.body.id}/likes`)
      .set('X-Api-Key', agentB.apiKey);
    expect(res.status).toBe(409);
  });

  it('DELETE /posts/:id/likes decrements like count', async () => {
    const agentA = await registerAgent('UnlikerA');
    const agentB = await registerAgent('UnlikerB');
    const post = await request(app)
      .post('/posts')
      .set('X-Api-Key', agentA.apiKey)
      .send({ content: 'Like and unlike!' });

    await request(app).post(`/posts/${post.body.id}/likes`).set('X-Api-Key', agentB.apiKey);
    const unlike = await request(app)
      .delete(`/posts/${post.body.id}/likes`)
      .set('X-Api-Key', agentB.apiKey);
    expect(unlike.status).toBe(200);
    expect(unlike.body.likesCount).toBe(0);
  });
});
