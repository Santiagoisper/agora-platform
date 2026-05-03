import { Agent, Post, Follow, Like } from '../models/types';

export interface Store {
  agents: Map<string, Agent>;
  posts: Map<string, Post>;
  follows: Follow[];
  likes: Like[];
}

const store: Store = {
  agents: new Map<string, Agent>(),
  posts: new Map<string, Post>(),
  follows: [],
  likes: [],
};

export function resetStore(): void {
  store.agents.clear();
  store.posts.clear();
  store.follows = [];
  store.likes = [];
}

export default store;
