<script setup lang="ts">
import { computed, nextTick, onMounted, provide, ref, watch } from 'vue';
import { decks, islandContent, islandMazes, type GameKind, type Level, type Subject } from '@study/content';
import { loadManifest } from './audio';
import { reloadToUpdate, updateReady } from './pwa';
import HomeView from './views/HomeView.vue';
import IslandView from './views/IslandView.vue';
import SettingsView from './views/SettingsView.vue';
import { gameInfo } from './games/registry';
import { capForHint, type LevelResult } from './games/result';
import { nextStepKey, type NextStep } from './components/nextStep';

type Screen = 'home' | 'island' | 'game' | 'settings';
const screen = ref<Screen>('home');
const subject = ref<Subject>('en');
const game = ref<GameKind>('match');
const deck = computed(() => decks[subject.value]);
// Lối vào tạm (spec mvp-games CC-25): trò chơi với toàn bộ nội dung của đảo.
// Mê cung thì chơi lần lượt từng cái theo thứ tự màn; thắng thì bảng kết quả có nút sang mê cung sau.
const mazeIndex = ref(0);
const mazeWon = ref(false);
const mazes = computed(() => islandMazes(subject.value));
const level = computed<Level>(() => {
  const all = islandContent(subject.value, game.value);
  const maze = game.value === 'maze' ? mazes.value[mazeIndex.value] : undefined;
  return maze ? { ...all, maze } : all;
});
// Màn có từ mới: xong trò chính thì gõ lại các từ đó (Viết Lại Từ) mới tính xong màn (CC-5).
const writing = ref(false);
const view = computed(() => gameInfo(writing.value ? 'write' : game.value).view);
/** Kết quả màn gần nhất; mvp-progress sẽ lưu sao từ đây. */
const lastResult = ref<LevelResult | null>(null);
const mainResult = ref<LevelResult | null>(null);
// Viết Lại Từ hỏi từ mới bé vừa gặp trong lượt chơi chính; lượt đó không gặp từ mới nào thì hỏi các từ mới của màn.
const writeLevel = computed<Level>(() => {
  const all = level.value.newWords ?? [];
  const main = mainResult.value;
  const played = new Set([...(main?.firstTry ?? []), ...(main?.wrong ?? []), ...(main?.hinted ?? [])]);
  const met = all.filter((id) => played.has(id));
  return { ...level.value, game: 'write', newWords: met.length > 0 ? met : all };
});
const gameLevel = computed(() => (writing.value ? writeLevel.value : level.value));
// Xong trò chính thì bảng kết quả hiện nút "Tiếp: …"; bé thấy sao trước rồi mới đi tiếp (CK-6).
const nextStep = computed<NextStep | null>(() => {
  if (writing.value) return null;
  if (mainResult.value) return { label: 'Tiếp: Viết Lại Từ', go: () => (writing.value = true) };
  if (mazeWon.value && mazeIndex.value < mazes.value.length - 1) {
    return {
      label: 'Tiếp: Mê cung sau',
      go: () => {
        mazeIndex.value++;
        mazeWon.value = false;
      },
    };
  }
  return null;
});
provide(nextStepKey, nextStep);

function play(kind: GameKind) {
  game.value = kind;
  writing.value = false;
  mainResult.value = null;
  // Đã thắng mê cung cuối: lần sau chơi lại từ mê cung đầu.
  if (mazeWon.value && mazeIndex.value === mazes.value.length - 1) mazeIndex.value = 0;
  mazeWon.value = false;
  // Màn mới: kết quả cũ không còn là của màn đang chơi (về đảo giữa chừng thì màn chưa tính xong).
  lastResult.value = null;
  screen.value = 'game';
}

function onFinish(result: LevelResult) {
  if (writing.value && mainResult.value) {
    // Sao của màn là sao trò chính; Viết Lại Từ không trừ sao, chỉ ghi thêm từ còn sai. Dùng Đèn Pin thì tối đa 2 sao.
    const usedHint = mainResult.value.usedHint || result.usedHint;
    lastResult.value = {
      ...mainResult.value,
      stars: capForHint(mainResult.value.stars, usedHint),
      wrong: [...new Set([...mainResult.value.wrong, ...result.wrong])],
      usedHint,
    };
    return;
  }
  if (game.value !== 'write' && level.value.newWords?.length) {
    mainResult.value = result;
    return;
  }
  if (game.value === 'maze') mazeWon.value = true;
  lastResult.value = result;
}

defineExpose({ lastResult, nextStep, gameLevel });

function openIsland(s: Subject) {
  subject.value = s;
  screen.value = 'island';
}

// Đổi màn thì đưa focus về tiêu đề màn mới, để người dùng bàn phím / trình đọc màn hình không bị lạc.
// Màn trò chơi tải lazy: chờ chunk tải xong (lần đầu mở trò) rồi mới tìm tiêu đề.
watch(
  // Sang mê cung sau: cùng màn MazeView nhưng gắn lại (đổi key), focus cũng phải về tiêu đề.
  [screen, view, mazeIndex],
  async () => {
    if (screen.value === 'game') {
      await gameInfo(writing.value ? 'write' : game.value).load();
      // Màn lazy tự gắn sau vài lượt microtask khi chunk về; chờ hết lượt đó (một macrotask) rồi mới tìm tiêu đề.
      await new Promise((resolve) => setTimeout(resolve));
    }
    await nextTick();
    document.querySelector<HTMLElement>('main h1, main h2, .match h2, .rain h2, .game-view h2')?.focus();
  },
  { flush: 'post' },
);

onMounted(() => void loadManifest());
</script>

<template>
  <div v-if="updateReady" class="update" role="status" data-testid="update-banner">
    Đã có bản mới của game.
    <button type="button" class="primary" @click="reloadToUpdate">Tải lại</button>
  </div>
  <HomeView v-if="screen === 'home'" @open="openIsland" @settings="screen = 'settings'" />
  <IslandView v-else-if="screen === 'island'" :deck="deck" @back="screen = 'home'" @play="play" />
  <component
    :is="view"
    v-else-if="screen === 'game'"
    :key="`${subject}-${game}-${writing}-${mazeIndex}`"
    class="game-view"
    :deck="deck"
    :level="gameLevel"
    @finish="onFinish"
    @exit="screen = 'island'"
  />
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
