<script setup lang="ts">
import type { Deck } from '@study/content';

defineProps<{ deck: Deck }>();
defineEmits<{ play: [game: 'match' | 'rain']; back: [] }>();
</script>

<template>
  <main class="island">
    <header class="bar">
      <button class="back" type="button" @click="$emit('back')">← Bản đồ</button>
      <h2 tabindex="-1">{{ deck.titleVi }}</h2>
      <span></span>
    </header>
    <div class="games">
      <button type="button" class="game" data-testid="play-match" @click="$emit('play', 'match')">
        <span class="icon" aria-hidden="true">🃏</span>
        <span class="name">Ghép Đôi</span>
        <span class="desc">Nối từ với nghĩa của nó</span>
      </button>
      <button type="button" class="game" data-testid="play-rain" @click="$emit('play', 'rain')">
        <span class="icon" aria-hidden="true">🌧️</span>
        <span class="name">Mưa Chữ</span>
        <span class="desc">Gõ từ trước khi hạt mưa chạm đất</span>
      </button>
    </div>
  </main>
</template>

<style scoped>
.island {
  max-width: 880px;
  margin: 0 auto;
  padding: 12px 16px 24px;
  display: grid;
  gap: 18px;
}
.games {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
.game {
  border: 2px solid var(--sea-200);
  border-radius: 24px;
  background: var(--paper);
  padding: 22px;
  display: grid;
  gap: 6px;
  justify-items: start;
  text-align: left;
  font: inherit;
  cursor: pointer;
  box-shadow: 0 6px 0 var(--sea-200);
}
.game:active {
  transform: translateY(2px);
}
.icon {
  font-size: 2.4rem;
}
.name {
  font-size: 1.3rem;
  font-weight: 700;
}
.desc {
  color: var(--ink-soft);
}
</style>
