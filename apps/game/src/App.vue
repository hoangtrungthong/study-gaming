<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { decks, type Subject } from '@study/content';
import { loadManifest } from './audio';
import { reloadToUpdate, updateReady } from './pwa';
import HomeView from './views/HomeView.vue';
import IslandView from './views/IslandView.vue';
import SettingsView from './views/SettingsView.vue';
import MatchView from './games/match/MatchView.vue';
import RainView from './games/rain/RainView.vue';

type Screen = 'home' | 'island' | 'match' | 'rain' | 'settings';
const screen = ref<Screen>('home');
const subject = ref<Subject>('en');
const deck = computed(() => decks[subject.value]);

function openIsland(s: Subject) {
  subject.value = s;
  screen.value = 'island';
}

// Đổi màn thì đưa focus về tiêu đề màn mới, để người dùng bàn phím / trình đọc màn hình không bị lạc.
watch(screen, async () => {
  await nextTick();
  document.querySelector<HTMLElement>('main h1, main h2, .match h2, .rain h2')?.focus();
});

onMounted(() => void loadManifest());
</script>

<template>
  <div v-if="updateReady" class="update" role="status" data-testid="update-banner">
    Đã có bản mới của game.
    <button type="button" class="primary" @click="reloadToUpdate">Tải lại</button>
  </div>
  <HomeView v-if="screen === 'home'" @open="openIsland" @settings="screen = 'settings'" />
  <IslandView v-else-if="screen === 'island'" :deck="deck" @back="screen = 'home'" @play="(g) => (screen = g)" />
  <MatchView v-else-if="screen === 'match'" :deck="deck" @exit="screen = 'island'" />
  <RainView v-else-if="screen === 'rain'" :deck="deck" @exit="screen = 'island'" />
  <SettingsView v-else @back="screen = 'home'" />
</template>

<style scoped>
.update {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  padding: 8px 16px;
  background: var(--sun-soft);
}
</style>
