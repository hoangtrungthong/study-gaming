import type { InjectionKey, Ref } from 'vue';

/** Bước tiếp sau bảng kết quả, ví dụ "Tiếp: Viết Lại Từ" khi màn còn phần gõ lại từ mới (CC-5, CK-6). */
export interface NextStep {
  label: string;
  go: () => void;
}

export const nextStepKey: InjectionKey<Ref<NextStep | null>> = Symbol('nextStep');
