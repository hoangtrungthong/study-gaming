<script setup lang="ts">
import { computed } from 'vue';
import { shuffle, type Rng } from '../games/random';

/**
 * Bàn phím ảo chữ to cho nhóm Mầm: chỉ có các chữ (hoặc かな) khác nhau của đáp án, xáo thứ tự.
 * Không bật bàn phím của máy.
 */
const props = defineProps<{ answer: string; lang?: string; rng?: Rng }>();
const emit = defineEmits<{ press: [key: string]; backspace: [] }>();

const keys = computed(() => shuffle([...new Set([...props.answer].filter((c) => c.trim() !== ''))], props.rng));
</script>

<template>
  <div class="vkb" role="group" aria-label="Bàn phím" data-testid="virtual-keyboard">
    <button
      v-for="k in keys"
      :key="k"
      type="button"
      class="key"
      :lang="lang"
      :data-testid="`vkey-${k}`"
      @click="emit('press', k)"
    >
      {{ k }}
    </button>
    <button type="button" class="key back" aria-label="Xoá chữ cuối" data-testid="vkey-back" @click="emit('backspace')">
      ⌫
    </button>
  </div>
</template>

<style scoped>
.vkb {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}
.key {
  min-width: 64px;
  min-height: 64px;
  font: inherit;
  font-size: 1.8rem;
  font-weight: 700;
  border-radius: 16px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  box-shadow: 0 4px 0 var(--sea-200);
  cursor: pointer;
}
.key:active {
  transform: translateY(2px);
}
.back {
  background: var(--sand);
}
</style>
