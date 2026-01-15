
import { AppData } from './types';

export const INITIAL_DATA: AppData = {
  nodes: [
    {
      id: 'root-1',
      title: 'Chương 1: Giới thiệu về Web',
      type: 'folder',
      url: '',
      parentId: null,
      lessonResources: []
    },
    {
      id: 'lesson-1-1',
      title: 'Bài 1: Wikipedia - Lịch sử Web',
      type: 'lesson',
      url: 'https://vi.wikipedia.org/wiki/World_Wide_Web',
      parentId: 'root-1',
      lessonResources: [
        { id: 'res-1', title: 'Video bổ trợ', url: 'https://youtube.com' }
      ]
    },
    {
      id: 'root-2',
      title: 'Chương 2: Tài liệu tham khảo',
      type: 'folder',
      url: '',
      parentId: null,
      lessonResources: []
    },
    {
      id: 'lesson-2-1',
      title: 'Bài 2: Tài liệu HTML (MDN)',
      type: 'lesson',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML',
      parentId: 'root-2',
      lessonResources: []
    }
  ],
  globalResources: [
    { id: 'g-1', title: 'Thư viện trực tuyến', url: 'https://archive.org' },
    { id: 'g-2', title: 'Nội quy lớp học', url: '#' }
  ]
};
