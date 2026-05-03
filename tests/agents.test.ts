import request from 'supertest';
import app from '../src/app';
import { resetStore } from '../src/store/memory';

beforeEach(() => resetStore());

describe('Health Check', () => {
  it('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.name).toBe('agora-platform');
  });
});

describe('Agents API', () => {
  it('POST /agents registers a new agent and returns API key', async () => {
    const res = await request(app)
      .post('/agents')
      .send({ name: 'AlphaBot', description: 'A research agent', capabilities: ['search', 'summarize'] });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('AlphaBot');
    expect(res.body.apiKey).toBeDefined();
    expect(res.body.followersCount).toBe(0);
    expect(res.body.followingCount).toBe(0);
  });

  it('POST /agents rejects missing name', async () => {
    const res = await request(app).post('/agents').send({ description: 'No name' });
    expect(res.status).toBe(400);
  });

  it('POST /agents rejects duplicate name', async () => {
    await request(app).post('/agents').send({ name: 'DupeBot' });
    const res = await request(app).post('/agents').send({ name: 'DupeBot' });
    expect(res.status).toBe(409);
  });

  it('GET /agents returns list of agents without apiKey', async () => {
    await request(app).post('/agents').send({ name: 'BotOne' });
    await request(app).post('/agents').send({ name: 'BotTwo' });

    const res = await request(app).get('/agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].apiKey).toBeUndefined();
  });

  it('GET /agents/:id returns public profile', async () => {
    const created = await request(app).post('/agents').send({ name: 'SingleBot' });
    const { id } = created.body;

    const res = await request(app).get(`/agents/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('SingleBot');
    expect(res.body.apiKey).toBeUndefined();
  });

  it('GET /agents/:id returns 404 for unknown agent', async () => {
    const res = await request(app).get('/agents/nonexistent');
    expect(res.status).toBe(404);
  });

  it('PATCH /agents/:id updates own profile', async () => {
    const created = await request(app).post('/agents').send({ name: 'UpdateBot' });
    const { id, apiKey } = created.body;

    const res = await request(app)
      .patch(`/agents/${id}`)
      .set('X-Api-Key', apiKey)
      .send({ description: 'Updated description', capabilities: ['coding'] });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated description');
    expect(res.body.capabilities).toEqual(['coding']);
  });

  it('PATCH /agents/:id is forbidden for another agent', async () => {
    const agentA = await request(app).post('/agents').send({ name: 'AgentA' });
    const agentB = await request(app).post('/agents').send({ name: 'AgentB' });

    const res = await request(app)
      .patch(`/agents/${agentA.body.id}`)
      .set('X-Api-Key', agentB.body.apiKey)
      .send({ description: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('DELETE /agents/:id removes the agent', async () => {
    const created = await request(app).post('/agents').send({ name: 'DeleteBot' });
    const { id, apiKey } = created.body;

    const del = await request(app).delete(`/agents/${id}`).set('X-Api-Key', apiKey);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/agents/${id}`);
    expect(get.status).toBe(404);
  });

  it('returns 401 without API key on authenticated routes', async () => {
    const created = await request(app).post('/agents').send({ name: 'AuthTestBot' });
    const res = await request(app).patch(`/agents/${created.body.id}`).send({ description: 'x' });
    expect(res.status).toBe(401);
  });
});
