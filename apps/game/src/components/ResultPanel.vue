<script setup lang="ts">
import { onMounted, ref } from 'vue';

defineProps<{ stars: number; message: string }>();
defineEmits<{ again: []; exit: [] }>();

// Hiện kết quả thì đưa focus vào khung kết quả (nút vừa bấm đã biến mất).
const root = ref<HTMLElement | null>(null);
onMounted(() => root.value?.focus());
</script>

<template>
  <section ref="root" class="result" data-testid="result" aria-live="polite" tabindex="-1">
    <p class="stars" :aria-label="`${stars} trên 3 sao`">
      <span v-for="n in 3" :key="n" :class="{ on: n <= stars }" aria-hidden="true">★</span>
    </p>
    <p class="msg">{{ message }}</p>
    <slot />
    <div class="actions">
      <button type="button" class="primary" @click="$emit('again')">Chơi lại</button>
      <button type="button" @click="$emit('exit')">Về đảo</button>
    </div>
  </section>
</template>

<style scoped>
.result {
  background: var(--paper);
  border-radius: 24px;
  padding: 24px;
  text-align: center;
  display: grid;
  gap: 12px;
  border: 2px solid var(--sea-200);
}
.stars {
  font-size: 3rem;
  margin: 0;
  letter-spacing: 6px;
  color: var(--sea-200);
}
.stars .on {
  color: var(--sun);
}
.msg {
  margin: 0;
  font-size: 1.1rem;
}
.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
