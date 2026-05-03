import request from 'supertest';
import app from '../src/app';
import { resetStore } from '../src/store/memory';

beforeEach(() => resetStore());

async function registerAgent(name: string) {
  const res = await request(app).post('/agents').send({ name });
  return res.body as { id: string; apiKey: string; name: string };
}

describe('Social Graph API', () => {
  it('POST /agents/:id/follow creates a follow relationship', async () => {
    const agentA = await registerAgent('FollowerBot');
    const agentB = await registerAgent('FolloweeBot');

    const res = await request(app)
      .post(`/agents/${agentB.id}/follow`)
      .set('X-Api-Key', agentA.apiKey);

    expect(res.status).toBe(201);
    expect(res.body.followerId).toBe(agentA.id);
    expect(res.body.followeeId).toBe(agentB.id);
  });

  it('POST /agents/:id/follow updates follow/follower counts', async () => {
    const agentA = await registerAgent('CounterFollower');
    const agentB = await registerAgent('CounterFollowee');

    await request(app).post(`/agents/${agentB.id}/follow`).set('X-Api-Key', agentA.apiKey);

    const followerProfile = await request(app).get(`/agents/${agentA.id}`);
    const followeeProfile = await request(app).get(`/agents/${agentB.id}`);

    expect(followerProfile.body.followingCount).toBe(1);
    expect(followeeProfile.body.followersCount).toBe(1);
  });

  it('POST /agents/:id/follow rejects self-follow', async () => {
    const agent = await registerAgent('NarcissistBot');
    const res = await request(app)
      .post(`/agents/${agent.id}/follow`)
      .set('X-Api-Key', agent.apiKey);
    expect(res.status).toBe(400);
  });

  it('POST /agents/:id/follow rejects duplicate follow', async () => {
    const agentA = await registerAgent('DupeFollower');
    const agentB = await registerAgent('DupeFollowee');
    await request(app).post(`/agents/${agentB.id}/follow`).set('X-Api-Key', agentA.apiKey);
    const res = await request(app)
      .post(`/agents/${agentB.id}/follow`)
      .set('X-Api-Key', agentA.apiKey);
    expect(res.status).toBe(409);
  });

  it('DELETE /agents/:id/follow removes the follow relationship', async () => {
    const agentA = await registerAgent('UnfollowerBot');
    const agentB = await registerAgent('UnfolloweeBot');
    await request(app).post(`/agents/${agentB.id}/follow`).set('X-Api-Key', agentA.apiKey);

    const res = await request(app)
      .delete(`/agents/${agentB.id}/follow`)
      .set('X-Api-Key', agentA.apiKey);
    expect(res.status).toBe(200);

    const followerProfile = await request(app).get(`/agents/${agentA.id}`);
    expect(followerProfile.body.followingCount).toBe(0);
  });

  it('DELETE /agents/:id/follow returns 404 when not following', async () => {
    const agentA = await registerAgent('NotFollowingA');
    const agentB = await registerAgent('NotFollowingB');
    const res = await request(app)
      .delete(`/agents/${agentB.id}/follow`)
      .set('X-Api-Key', agentA.apiKey);
    expect(res.status).toBe(404);
  });

  it('GET /agents/:id/followers lists all followers', async () => {
    const star = await registerAgent('StarAgent');
    const fan1 = await registerAgent('Fan1');
    const fan2 = await registerAgent('Fan2');

    await request(app).post(`/agents/${star.id}/follow`).set('X-Api-Key', fan1.apiKey);
    await request(app).post(`/agents/${star.id}/follow`).set('X-Api-Key', fan2.apiKey);

    const res = await request(app).get(`/agents/${star.id}/followers`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const names = res.body.map((a: { name: string }) => a.name);
    expect(names).toContain('Fan1');
    expect(names).toContain('Fan2');
  });

  it('GET /agents/:id/following lists agents the given agent follows', async () => {
    const curator = await registerAgent('CuratorBot');
    const sourceA = await registerAgent('SourceA');
    const sourceB = await registerAgent('SourceB');

    await request(app).post(`/agents/${sourceA.id}/follow`).set('X-Api-Key', curator.apiKey);
    await request(app).post(`/agents/${sourceB.id}/follow`).set('X-Api-Key', curator.apiKey);

    const res = await request(app).get(`/agents/${curator.id}/following`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('Feed API', () => {
  it('GET /feed returns posts from followed agents', async () => {
    const reader = await registerAgent('ReaderBot');
    const writer = await registerAgent('WriterBot');

    await request(app).post(`/agents/${writer.id}/follow`).set('X-Api-Key', reader.apiKey);
    await request(app).post('/posts').set('X-Api-Key', writer.apiKey).send({ content: 'Post from writer' });

    const res = await request(app).get('/feed').set('X-Api-Key', reader.apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('Post from writer');
  });

  it('GET /feed excludes posts from non-followed agents', async () => {
    const reader = await registerAgent('ReaderOnly');
    const stranger = await registerAgent('StrangerBot');
    await request(app).post('/posts').set('X-Api-Key', stranger.apiKey).send({ content: 'Not for reader' });

    const res = await request(app).get('/feed').set('X-Api-Key', reader.apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('GET /feed returns 401 without API key', async () => {
    const res = await request(app).get('/feed');
    expect(res.status).toBe(401);
  });

  it('GET /feed returns posts from multiple followed agents sorted by most recent', async () => {
    const reader = await registerAgent('MultiReader');
    const writerA = await registerAgent('WriterA');
    const writerB = await registerAgent('WriterB');

    await request(app).post(`/agents/${writerA.id}/follow`).set('X-Api-Key', reader.apiKey);
    await request(app).post(`/agents/${writerB.id}/follow`).set('X-Api-Key', reader.apiKey);

    await request(app).post('/posts').set('X-Api-Key', writerA.apiKey).send({ content: 'Post A1' });
    await request(app).post('/posts').set('X-Api-Key', writerB.apiKey).send({ content: 'Post B1' });
    await request(app).post('/posts').set('X-Api-Key', writerA.apiKey).send({ content: 'Post A2' });

    const res = await request(app).get('/feed').set('X-Api-Key', reader.apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].content).toBe('Post A2');
  });
});
