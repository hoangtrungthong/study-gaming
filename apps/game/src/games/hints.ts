import { ref } from 'vue';
import { phrases, viSegment } from '@study/content';
import { speaker } from '../audio';

/** Số Đèn Pin lúc bắt đầu (đã chốt 2026-11-18). */
export const START_HINTS = 3;

/**
 * Kho Đèn Pin (gợi ý). Tạm giữ trong bộ nhớ; `mvp-progress` sẽ lưu vào dữ liệu tiến độ trên máy
 * và cộng từ quảng cáo có thưởng / quà hằng ngày của nhóm Mầm.
 */
export const hints = ref(START_HINTS);

/** Dùng một Đèn Pin. Hết thì Tomo báo và trả `false`. */
export function useHint(): boolean {
  if (hints.value <= 0) {
    void speaker.say([viSegment(phrases.noHints)]);
    return false;
  }
  hints.value--;
  void speaker.say([viSegment(phrases.hint)]);
  return true;
}
