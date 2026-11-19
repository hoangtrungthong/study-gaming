<script setup lang="ts">
import { hints } from '../games/hints';

// Nút Đèn Pin dùng chung cho mọi trò: luôn hiện số Đèn Pin còn lại.
// Hết Đèn Pin thì chỉ mờ đi (`aria-disabled`) chứ không tắt hẳn: vẫn bấm/Tab tới được để Tomo nói
// "Hết Đèn Pin rồi…" (trò gọi useHint()) và trình đọc màn hình vẫn đọc được số còn lại.
// `disabled`: trò tự tắt hẳn khi lúc này không có gì để gợi ý (vd. chưa chọn thẻ).
defineProps<{ disabled?: boolean }>();
defineEmits<{ use: [] }>();
</script>

<template>
  <button
    type="button"
    class="hint"
    :disabled="disabled"
    :aria-disabled="hints <= 0 ? 'true' : undefined"
    :aria-label="`Đèn Pin, còn ${hints}`"
    @click="$emit('use')"
  >
    🔦 Đèn Pin <b>{{ hints }}</b>
  </button>
</template>

<style scoped>
.hint[aria-disabled='true'] {
  opacity: 0.5;
  cursor: default;
}
</style>
