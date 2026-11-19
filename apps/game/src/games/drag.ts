import { shallowRef } from 'vue';

export interface DragState<T> {
  payload: T;
  x: number;
  y: number;
}

export interface DragOptions<T> {
  /** Thả lên phần tử có `data-drop="<khoá>"`. */
  onDrop: (payload: T, target: string) => void;
  /** Bấm rồi nhả mà không kéo (dưới ngưỡng): coi như chạm để chọn. */
  onTap?: (payload: T) => void;
}

/** Kéo bao xa (px) mới tính là kéo, để chạm nhẹ vẫn là chạm. */
const DRAG_THRESHOLD = 6;

/**
 * Kéo thả bằng Pointer Events, chạy được cả chuột lẫn ngón tay. Kéo-thả HTML5 không chạy trên phần lớn trình duyệt
 * điện thoại, nên không dùng. Phần tử kéo cần CSS `touch-action: none` để kéo không cuộn trang.
 */
export function useDrag<T>(options: DragOptions<T>) {
  const dragging = shallowRef<DragState<T> | null>(null);

  function start(event: PointerEvent, payload: T): void {
    const el = event.currentTarget as HTMLElement | null;
    el?.setPointerCapture?.(event.pointerId);
    const x0 = event.clientX;
    const y0 = event.clientY;
    let moved = false;

    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - x0, e.clientY - y0) < DRAG_THRESHOLD) return;
      moved = true;
      dragging.value = { payload, x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      dragging.value = null;
      if (!moved) {
        options.onTap?.(payload);
        return;
      }
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-drop]');
      if (target?.dataset.drop !== undefined) options.onDrop(payload, target.dataset.drop);
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      dragging.value = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  return { dragging, start };
}
