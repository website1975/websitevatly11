
import { AppData } from './types';

export const INITIAL_DATA: AppData = {
  nodes: [
    {
      id: 'root-1',
      title: 'Chương 1: Dao động',
      type: 'folder',
      url: '',
      imageUrl: '',
      parentId: null,
      lessonResources: [],
      order: 0
    },
    {
      id: 'lesson-1-1',
      title: 'Bài 1: Dao động điều hòa',
      type: 'lesson',
      url: 'https://vi.wikipedia.org/wiki/Dao_%C4%91%E1%BB%99ng_%C4%91i%E1%BB%81u_h%C3%B2a',
      imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=2070&auto=format&fit=crop',
      parentId: 'root-1',
      lessonResources: [
        { id: 'res-1', title: 'Video bổ trợ', url: 'https://youtube.com' }
      ],
      order: 0
    },
    {
      id: 'lesson-1-2',
      title: 'Bài 2: Con lắc lò xo',
      type: 'lesson',
      url: 'https://vi.wikipedia.org/wiki/Con_l%E1%BA%AFc_l%C3%B2_xo',
      imageUrl: 'https://images.unsplash.com/photo-1532187875605-7fe3b35dd562?q=80&w=2070&auto=format&fit=crop',
      parentId: 'root-1',
      lessonResources: [],
      order: 1
    },
    {
      id: 'root-2',
      title: 'Chương 2: Sóng',
      type: 'folder',
      url: '',
      imageUrl: '',
      parentId: null,
      lessonResources: [],
      order: 1
    },
    {
      id: 'lesson-2-1',
      title: 'Bài 3: Sóng cơ và sự truyền sóng',
      type: 'lesson',
      url: 'https://vi.wikipedia.org/wiki/S%C3%B3ng_c%C6%A1',
      imageUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f45d8de4?q=80&w=2000&auto=format&fit=crop',
      parentId: 'root-2',
      lessonResources: [],
      order: 0
    }
  ],
  globalResources: [
    { id: 'g-1', title: 'Thư viện trực tuyến', url: 'https://archive.org' },
    { id: 'g-2', title: 'Nội quy lớp học', url: '#' }
  ]
};
