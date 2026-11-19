import { phrases, type BlockKind } from '@study/content';

/** Hình và tên của từng loại khối lệnh (tên cũng là câu Tomo đọc). */
export const BLOCK_INFO: Record<BlockKind, { icon: string; name: string }> = {
  forward: { icon: '⬆️', name: phrases.blockForward },
  left: { icon: '↩️', name: phrases.blockLeft },
  right: { icon: '↪️', name: phrases.blockRight },
  repeat: { icon: '🔁', name: phrases.blockRepeat },
};

/** Khoá chuỗi của đường dẫn khối: `[0, 2]` → `0-2`, chương trình gốc là chuỗi rỗng. */
export const pathKey = (path: number[]) => path.join('-');
export const parsePath = (key: string): number[] => (key === '' ? [] : key.split('-').map(Number));

/** Trạng thái và thao tác MazeView truyền cho danh sách khối (lồng nhau trong khối lặp). */
export interface ProgramContext {
  /** Khoá khối đang chạy. */
  active: string | null;
  /** Khoá khối gây lỗi (đụng tường). */
  failed: string | null;
  /** Khoá khối Đèn Pin chỉ ra (cần sửa / bỏ). */
  hinted: string | null;
  /** Khoá danh sách Đèn Pin chỉ chỗ thêm khối (`''` là chương trình gốc). */
  hintedList: string | null;
  /** Khoá khối lặp đang là chỗ thêm khối mới (`''`: cuối chương trình gốc). */
  target: string;
  busy: boolean;
  /** Chọn / bỏ chọn khối lặp ở `path` làm chỗ thêm khối mới (đường bàn phím và trình đọc màn hình). */
  aim: (path: number[]) => void;
  /** Đổi chỗ khối với khối kề bên trong cùng danh sách (-1: lên, 1: xuống). */
  nudge: (path: number[], delta: -1 | 1) => void;
  grab: (event: PointerEvent, path: number[]) => void;
  keyTap: (event: MouseEvent, path: number[]) => void;
  remove: (path: number[]) => void;
  times: (path: number[], delta: number) => void;
}
