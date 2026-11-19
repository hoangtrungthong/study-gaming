import { defineAsyncComponent, type Component } from 'vue';
import { gameAllowed, type GameKind, type Subject } from '@study/content';

export interface GameInfo {
  kind: GameKind;
  nameVi: string;
  descVi: string;
  icon: string;
  /** Màn của trò, tải lazy (mỗi trò một chunk). Nhận `deck`, `level`; phát `exit`, `finish`. */
  view: Component;
  /** Tải chunk của màn (dùng chung với `view`): App chờ tải xong mới đưa focus vào tiêu đề trò. */
  load: () => Promise<unknown>;
}

/** Một promise tải chung cho `view` và `load`, để chờ `load()` là chờ đúng lần tải mà màn đang dùng. */
function lazy(loader: () => Promise<{ default: Component }>): Pick<GameInfo, 'load' | 'view'> {
  let loading: Promise<{ default: Component }> | undefined;
  const load = () => (loading ??= loader());
  return { load, view: defineAsyncComponent(load) };
}

export const games: GameInfo[] = [
  {
    kind: 'match',
    nameVi: 'Ghép Đôi',
    descVi: 'Nối từ với nghĩa của nó',
    icon: '🃏',
    ...lazy(() => import('./match/MatchView.vue')),
  },
  {
    kind: 'rain',
    nameVi: 'Mưa Chữ',
    descVi: 'Gõ từ trước khi hạt mưa chạm đất',
    icon: '🌧️',
    ...lazy(() => import('./rain/RainView.vue')),
  },
  {
    kind: 'star',
    nameVi: 'Hứng Sao',
    descVi: 'Kéo giỏ hứng ngôi sao có từ đúng',
    icon: '⭐',
    ...lazy(() => import('./star/StarView.vue')),
  },
  {
    kind: 'listen',
    nameVi: 'Nghe Chọn',
    descVi: 'Nghe rồi chọn hình hoặc chữ đúng',
    icon: '👂',
    ...lazy(() => import('./listen/ListenView.vue')),
  },
  {
    kind: 'memory',
    nameVi: 'Lật Thẻ Nhớ',
    descVi: 'Lật hai thẻ cùng nghĩa',
    icon: '🎴',
    ...lazy(() => import('./memory/MemoryView.vue')),
  },
  {
    kind: 'sentence',
    nameVi: 'Xếp Câu',
    descVi: 'Kéo các khối chữ thành câu',
    icon: '🧩',
    ...lazy(() => import('./sentence/SentenceView.vue')),
  },
  {
    kind: 'write',
    nameVi: 'Viết Lại Từ',
    descVi: 'Nghe và gõ lại từ',
    icon: '✏️',
    ...lazy(() => import('./write/WriteView.vue')),
  },
  {
    kind: 'kana',
    nameVi: 'Vẽ Kana',
    descVi: 'Tô từng nét chữ kana',
    icon: '🖌️',
    ...lazy(() => import('./kana/KanaView.vue')),
  },
  {
    kind: 'maze',
    nameVi: 'Đưa Bit Về Nhà',
    descVi: 'Xếp khối lệnh đưa mèo Bit về nhà',
    icon: '🐱',
    ...lazy(() => import('./maze/MazeView.vue')),
  },
];

export function gameInfo(kind: GameKind): GameInfo {
  return games.find((g) => g.kind === kind)!;
}

/** Các trò của một đảo (Vẽ Kana chỉ đảo Nhật, Đưa Bit Về Nhà chỉ đảo IT, Xếp Câu không có ở đảo IT). */
export function gamesFor(subject: Subject): GameInfo[] {
  return games.filter((g) => gameAllowed(g.kind, subject));
}
