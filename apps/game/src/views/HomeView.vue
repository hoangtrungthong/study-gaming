<script setup lang="ts">
import { decks, phrases, subjects, viSegment, type Subject } from '@study/content';
import { speaker } from '../audio';

defineEmits<{ open: [subject: Subject]; settings: [] }>();

const islandIcon: Record<Subject, string> = { en: '🔤', ja: '🌸', it: '💡' };
</script>

<template>
  <main class="home">
    <header class="hero">
      <button class="tomo" type="button" aria-label="Tomo chào bạn" @click="speaker.say([viSegment(phrases.welcome)])">
        🤖
      </button>
      <div>
        <h1 tabindex="-1">Tomo và Quần đảo Tri Thức</h1>
        <p class="lead">Chọn một hòn đảo để bắt đầu.</p>
      </div>
      <button
        class="settings"
        type="button"
        aria-label="Cài đặt"
        data-testid="open-settings"
        @click="$emit('settings')"
      >
        ⚙️
      </button>
    </header>

    <nav class="islands" aria-label="Các hòn đảo">
      <button
        v-for="s in subjects"
        :key="s"
        type="button"
        class="island"
        :class="`island-${s}`"
        :data-testid="`island-${s}`"
        @click="$emit('open', s)"
      >
        <span class="icon" aria-hidden="true">{{ islandIcon[s] }}</span>
        <span class="name">{{ decks[s].titleVi }}</span>
        <span class="target" :lang="decks[s].termLang">{{ decks[s].titleTarget }}</span>
        <span class="count">{{ decks[s].items.length }} từ</span>
      </button>
    </nav>
  </main>
</template>

<style scoped>
.home {
  max-width: 980px;
  margin: 0 auto;
  padding: 20px 16px 32px;
  display: grid;
  gap: 24px;
}
.hero {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
}
h1 {
  margin: 0;
  font-size: clamp(1.4rem, 4vw, 2.2rem);
  line-height: 1.2;
}
.lead {
  margin: 4px 0 0;
  color: var(--ink-soft);
}
.tomo {
  font-size: 3rem;
  width: 76px;
  height: 76px;
  border-radius: 24px;
  border: none;
  background: var(--sun-soft);
  cursor: pointer;
}
.settings {
  font-size: 1.6rem;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  cursor: pointer;
}
.islands {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.island {
  border: none;
  border-radius: 28px;
  padding: 22px 18px;
  min-height: 180px;
  display: grid;
  justify-items: start;
  align-content: end;
  gap: 4px;
  text-align: left;
  font: inherit;
  color: var(--ink);
  cursor: pointer;
  box-shadow: 0 8px 0 rgba(23, 59, 77, 0.18);
  transition: transform 0.15s ease;
}
.island:hover {
  transform: translateY(-3px);
}
.island:active {
  transform: translateY(2px);
}
.island-en {
  background: linear-gradient(160deg, #fbe3a6, #f6c453);
}
.island-ja {
  background: linear-gradient(160deg, #fbd7dc, #f1a7b5);
}
.island-it {
  background: linear-gradient(160deg, #cdeccf, #8fcf97);
}
.icon {
  font-size: 2.6rem;
}
.name {
  font-size: 1.35rem;
  font-weight: 700;
}
.target,
.count {
  color: rgba(23, 59, 77, 0.75);
}
</style>
