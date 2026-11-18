import { ref } from 'vue';

/** Có bản mới của game đã tải xong, chờ người chơi bấm tải lại. */
export const updateReady = ref(false);
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;

type RegisterSW = (options: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
}) => (reloadPage?: boolean) => Promise<void>;

/**
 * Đăng ký service worker ở chế độ hỏi trước: có bản mới thì hiện thông báo, không tự tải lại
 * giữa ván chơi. Lần cài đầu tiên vẫn lưu sẵn toàn bộ game để chơi không cần mạng.
 */
export function setupPwa(register: RegisterSW): void {
  applyUpdate = register({
    immediate: true,
    onNeedRefresh: () => {
      updateReady.value = true;
    },
  });
}

export async function reloadToUpdate(): Promise<void> {
  if (!applyUpdate) return;
  try {
    await applyUpdate(true);
    updateReady.value = false;
  } catch {
    // Cập nhật lỗi: giữ thông báo để người chơi bấm lại.
  }
}
