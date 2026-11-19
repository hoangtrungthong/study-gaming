<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { levelItems, phrases, termSegment, viSegment, type Deck, type LearnItem, type Level } from '@study/content';
import HintButton from '../../components/HintButton.vue';
import KnowledgeCard from '../../components/KnowledgeCard.vue';
import ResultPanel from '../../components/ResultPanel.vue';
import { speaker } from '../../audio';
import { settings } from '../../settings';
import { MATCH_CONFIG } from '../ageConfig';
import { useHint } from '../hints';
import { levelIdOf, type LevelResult } from '../result';
import { MatchGame } from './MatchGame';

// `level`: màn đang chơi; không có (hoặc màn không có từ) thì dùng toàn bộ từ của đảo.
const props = defineProps<{ deck: Deck; level?: Level }>();
const emit = defineEmits<{ exit: []; finish: [result: LevelResult] }>();

/** Đèn Pin loé sáng nghĩa đúng của từ đang chọn trong 1 giây (chốt 2026-11-18). */
const FLASH_MS = 1000;

const game = shallowRef(newGame());
// Bản phản ứng của trạng thái game để giao diện cập nhật.
const view = reactive({
  selected: null as string | null,
  matched: [] as string[],
  wrong: null as string | null,
  flash: null as string | null,
});
const lastMatched = ref<LearnItem | null>(null);
const finished = computed(() => view.matched.length === game.value.left.length);

let flashTimer: ReturnType<typeof setTimeout> | undefined;

function newGame() {
  const items = props.level ? levelItems(props.deck.subject, props.level) : [];
  return new MatchGame(items.length > 0 ? items : props.deck.items, MATCH_CONFIG[settings.ageGroup].pairs);
}

function clearFlash() {
  clearTimeout(flashTimer);
  view.flash = null;
}

async function restart() {
  clearFlash();
  game.value = newGame();
  Object.assign(view, { selected: null, matched: [], wrong: null });
  lastMatched.value = null;
  // Chờ thẻ cũ gỡ xong (nó gọi speaker.stop() khi gỡ) rồi mới đọc hướng dẫn.
  await nextTick();
  void speaker.say([viSegment(phrases.matchIntro)]);
}

function pickLeft(item: LearnItem) {
  clearFlash();
  game.value.selectLeft(item.id);
  view.selected = game.value.selected;
  // Chạm vào từ là nghe từ đó (trẻ chưa biết đọc vẫn chơi được).
  if (view.selected) void speaker.say([termSegment(props.deck, item)]);
}

const winTail = [viSegment(phrases.roundWin)];

function pickRight(item: LearnItem) {
  const result = game.value.selectRight(item.id);
  if (result === 'match') {
    view.matched = [...game.value.matched];
    view.selected = null;
    // Thẻ kiến thức tự đọc; ở cặp cuối, lời khen được đọc nối sau thẻ (prop tail).
    lastMatched.value = item;
    // Tắt tự đọc thì thẻ im lặng, nhưng lời khen cuối màn vẫn phải có. Chờ thẻ cũ gỡ xong
    // (nó gọi speaker.stop() khi gỡ) rồi mới đọc, như restart().
    if (game.value.done && !settings.autoRead) void nextTick(() => speaker.say(winTail));
    if (game.value.done) finish();
  } else if (result === 'wrong') {
    view.wrong = item.id;
    setTimeout(() => (view.wrong = null), 450);
    void speaker.say([viSegment(phrases.wrong)]);
  }
}

function hint() {
  // Nút chỉ bật khi đang chọn một từ bên trái.
  if (!useHint()) return;
  view.flash = game.value.hint();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (view.flash = null), FLASH_MS);
}

function finish() {
  clearFlash();
  const g = game.value;
  const result: LevelResult = {
    ...levelIdOf(props.level),
    game: 'match',
    stars: g.stars,
    firstTry: g.firstTry,
    wrong: g.wrong,
    usedHint: g.usedHint,
  };
  const hinted = g.hinted;
  if (hinted.length > 0) result.hinted = hinted;
  emit('finish', result);
}

onMounted(() => void speaker.say([viSegment(phrases.matchIntro)]));
onBeforeUnmount(() => {
  clearTimeout(flashTimer);
  speaker.stop();
});
</script>

<template>
  <div class="match">
    <header class="bar">
      <button class="back" type="button" @click="$emit('exit')">← Đảo</button>
      <h2 tabindex="-1">Ghép Đôi</h2>
      <span class="count">{{ view.matched.length }}/{{ game.left.length }}</span>
    </header>

    <ResultPanel
      v-if="finished"
      :stars="game.stars"
      :message="`Bạn ghép đúng ${game.left.length} cặp, sai ${game.mistakes} lần.`"
      @again="restart"
      @exit="$emit('exit')"
    />

    <template v-else>
      <div class="tools">
        <HintButton data-testid="match-hint" :disabled="!view.selected" @use="hint" />
      </div>

      <div class="board">
        <div class="column" aria-label="Từ cần ghép">
          <button
            v-for="item in game.left"
            :key="item.id"
            type="button"
            class="tile term"
            :class="{ selected: view.selected === item.id, done: view.matched.includes(item.id) }"
            :aria-pressed="view.selected === item.id"
            :disabled="view.matched.includes(item.id)"
            :data-testid="`left-${item.id}`"
            :lang="deck.termLang"
            @click="pickLeft(item)"
          >
            <span class="main">{{ item.term }}</span>
            <span v-if="item.reading" class="sub" lang="ja">{{ item.reading }}</span>
          </button>
        </div>
        <div class="column" aria-label="Nghĩa">
          <button
            v-for="item in game.right"
            :key="item.id"
            type="button"
            class="tile meaning"
            :class="{
              done: view.matched.includes(item.id),
              wrong: view.wrong === item.id,
              flash: view.flash === item.id,
            }"
            :aria-describedby="view.flash === item.id ? 'match-flash-note' : undefined"
            :disabled="view.matched.includes(item.id)"
            :data-testid="`right-${item.id}`"
            @click="pickRight(item)"
          >
            <span class="emoji" aria-hidden="true">{{ item.emoji }}</span>
            <span v-if="settings.showVietnamese" class="main">{{ item.meaningVi }}</span>
          </button>
        </div>
        <span id="match-flash-note" class="sr-only">Đèn Pin: đây là nghĩa đúng</span>
      </div>
    </template>

    <KnowledgeCard
      v-if="lastMatched"
      :key="lastMatched.id"
      :deck="deck"
      :item="lastMatched"
      :tail="finished ? winTail : undefined"
    />
  </div>
</template>

<style scoped>
.match {
  display: grid;
  gap: 14px;
  padding: 12px 16px 24px;
  max-width: 880px;
  margin: 0 auto;
}
.tools {
  display: flex;
  justify-content: flex-end;
}
.hint {
  min-height: 48px;
  padding: 0 16px;
  border-radius: 24px;
  border: 2px solid var(--sea-200);
  background: var(--sun-soft);
  font: inherit;
  cursor: pointer;
}
.hint:disabled {
  opacity: 0.5;
  cursor: default;
}
.board {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.column {
  display: grid;
  gap: 10px;
  align-content: start;
}
.tile {
  min-height: 64px;
  border-radius: 16px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  font: inherit;
  font-size: 1.15rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 10px;
  cursor: pointer;
  box-shadow: 0 4px 0 var(--sea-200);
  transition:
    transform 0.12s ease,
    background 0.2s ease;
}
.tile:active {
  transform: translateY(2px);
}
.tile.selected {
  border-color: var(--sea);
  background: var(--sea-50);
  box-shadow: 0 4px 0 var(--sea);
}
.tile.done {
  background: var(--leaf-soft);
  border-color: var(--leaf);
  box-shadow: none;
  opacity: 0.75;
  cursor: default;
}
.tile.flash {
  border-color: var(--sun);
  background: var(--sun-soft);
  box-shadow: 0 0 0 4px var(--sun-soft);
}
.tile.wrong {
  animation: shake 0.4s;
  border-color: var(--coral);
}
.term .main {
  font-weight: 700;
  font-size: 1.35rem;
}
.sub {
  color: var(--ink-soft);
  font-size: 0.95rem;
  width: 100%;
  text-align: center;
}
.emoji {
  font-size: 1.8rem;
}
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-6px);
  }
  75% {
    transform: translateX(6px);
  }
}
</style>
