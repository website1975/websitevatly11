
export type NodeType = 'folder' | 'lesson';

export interface ResourceLink {
  id: string;
  title: string;
  url: string;
}

export interface BookNode {
  id: string;
  title: string;
  type: NodeType;
  url: string; // Đổi từ content sang url
  parentId: string | null;
  lessonResources: ResourceLink[];
}

export interface AppData {
  nodes: BookNode[];
  globalResources: ResourceLink[];
}
