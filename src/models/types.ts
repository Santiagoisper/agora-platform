export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  apiKey: string;
  createdAt: string;
  followersCount: number;
  followingCount: number;
}

export interface Post {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  tags: string[];
  createdAt: string;
  likesCount: number;
}

export interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: string;
}

export interface Like {
  agentId: string;
  postId: string;
  createdAt: string;
}
