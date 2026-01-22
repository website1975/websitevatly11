
export type NodeType = 'folder' | 'lesson';

export interface ResourceLink {
  id: string;
  title: string;
  url: string;
}

export interface ForumComment {
  id: string;
  nodeId: string;
  author: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  isAdmin: boolean;
}

export interface BookNode {
  id: string;
  title: string;
  type: NodeType;
  url: string;
  imageUrl?: string; // Trường mới: Ảnh minh họa bài học
  parentId: string | null;
  lessonResources: ResourceLink[];
}

export interface AppData {
  nodes: BookNode[];
  globalResources: ResourceLink[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
