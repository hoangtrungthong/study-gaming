<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, shallowRef } from 'vue';
import {
  levelItems,
  phrases,
  termSegment,
  translationSegment,
  viSegment,
  type Deck,
  type Level,
  type SpeechSegment,
} from '@study/content';
import HintButton from '../../components/HintButton.vue';
import ResultPanel from '../../components/ResultPanel.vue';
import { speaker } from '../../audio';
import { settings } from '../../settings';
import { MEMORY_CONFIG } from '../ageConfig';
import { useHint } from '../hints';
import { levelIdOf, type LevelResult } from '../result';
import { MemoryGame, type MemoryCard } from './MemoryGame';

const props = defineProps<{ deck: Deck; level: Level }>();
const emit = defineEmits<{ exit: []; finish: [result: LevelResult] }>();

/** Đèn Pin soi sáng một cặp trong 1 giây (chốt 2026-11-18). */
const PEEK_MS = 1000;

const game = shallowRef(newGame());
// Bản phản ứng của trạng thái game để giao diện cập nhật.
const view = reactive({ faceUp: [] as number[], matched: [] as string[], peek: [] as number[], usedHint: false });
const finished = computed(() => view.matched.length === game.value.pairs);
// Lưới tối đa 4×4 (CC-15); 6 thẻ của nhóm Mầm xếp 3 cột cho thẻ to hơn.
const columns = computed(() => (game.value.cards.length <= 6 ? 3 : 4));

let flipTimer: ReturnType<typeof setTimeout> | undefined;
let peekTimer: ReturnType<typeof setTimeout> | undefined;

function newGame() {
  return new MemoryGame(levelItems(props.deck.subject, props.level), MEMORY_CONFIG[settings.ageGroup].pairs);
}

function clearTimers() {
  clearTimeout(flipTimer);
  clearTimeout(peekTimer);
}

function sync() {
  view.faceUp = [...game.value.faceUp];
  view.matched = [...game.value.matched];
}

function restart() {
  clearTimers();
  game.value = newGame();
  Object.assign(view, { faceUp: [], matched: [], peek: [], usedHint: false });
  void speaker.say([viSegment(phrases.memoryIntro)]);
}

const isShown = (idx: number) =>
  view.faceUp.includes(idx) || view.peek.includes(idx) || view.matched.includes(game.value.cards[idx]!.item.id);

function cardSegment(card: MemoryCard): SpeechSegment {
  return card.face === 'term' ? termSegment(props.deck, card.item) : translationSegment(card.item.meaningVi);
}

function label(card: MemoryCard, idx: number): string {
  if (!isShown(idx)) return `Thẻ úp số ${idx + 1}`;
  if (card.face === 'term') return card.item.term;
  return settings.showVietnamese ? card.item.meaningVi : card.item.emoji;
}

function flip(idx: number) {
  const card = game.value.cards[idx]!;
  const result = game.value.flip(idx);
  if (result === 'ignored') return;
  sync();
  if (result === 'first') {
    void speaker.say([cardSegment(card)]);
  } else if (result === 'match') {
    const tail = game.value.done ? [viSegment(phrases.roundWin)] : [];
    void speaker.say([termSegment(props.deck, card.item), translationSegment(card.item.meaningVi), ...tail]);
    if (game.value.done) finish();
  } else {
    void speaker.say([cardSegment(card), viSegment(phrases.wrong)]);
    flipTimer = setTimeout(() => {
      game.value.hideMismatch();
      sync();
    }, MEMORY_CONFIG[settings.ageGroup].flipBackMs);
  }
}

function hint() {
  if (!useHint()) return;
  view.usedHint = true;
  // Ván chưa xong thì luôn còn cặp chưa ghép (nút bị ẩn khi đã xong).
  view.peek = game.value.revealPair()!;
  clearTimeout(peekTimer);
  peekTimer = setTimeout(() => (view.peek = []), PEEK_MS);
}

function finish() {
  clearTimeout(peekTimer);
  view.peek = [];
  const g = game.value;
  emit('finish', {
    ...levelIdOf(props.level),
    game: 'memory',
    stars: g.stars(view.usedHint),
    firstTry: g.firstTry,
    wrong: g.wrong,
    usedHint: view.usedHint,
  });
}

onMounted(() => void speaker.say([viSegment(phrases.memoryIntro)]));
onBeforeUnmount(() => {
  clearTimers();
  speaker.stop();
});
</script>

<template>
  <div class="memory" :class="settings.ageGroup">
    <header class="bar">
      <button class="back" type="button" @click="$emit('exit')">← Đảo</button>
      <h2 tabindex="-1">Lật Thẻ Nhớ</h2>
      <span class="count">{{ view.matched.length }}/{{ game.pairs }}</span>
    </header>

    <ResultPanel
      v-if="finished"
      :stars="game.stars(view.usedHint)"
      :message="`Bạn ghép đủ ${game.pairs} cặp, lật sai ${game.mistakes} lần.`"
      @again="restart"
      @exit="$emit('exit')"
    />

    <template v-else>
      <div class="tools">
        <HintButton data-testid="memory-hint" :disabled="view.peek.length > 0" @use="hint" />
      </div>
      <div class="grid" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }" aria-label="Các thẻ">
        <button
          v-for="(card, idx) in game.cards"
          :key="idx"
          type="button"
          class="card"
          :class="{
            up: isShown(idx),
            done: view.matched.includes(card.item.id),
            peek: view.peek.includes(idx),
          }"
          :aria-label="label(card, idx)"
          :disabled="view.matched.includes(card.item.id)"
          :data-testid="`memory-card-${idx}`"
          @click="flip(idx)"
        >
          <span class="inner">
            <span class="side back-side" aria-hidden="true">?</span>
            <span class="side front-side" aria-hidden="true">
              <template v-if="card.face === 'term'">
                <span class="term" :lang="deck.termLang">{{ card.item.term }}</span>
                <span v-if="card.item.reading" class="sub" lang="ja">{{ card.item.reading }}</span>
              </template>
              <template v-else>
                <span class="emoji">{{ card.item.emoji }}</span>
                <span v-if="settings.showVietnamese" class="meaning">{{ card.item.meaningVi }}</span>
              </template>
            </span>
          </span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.memory {
  display: grid;
  gap: 14px;
  padding: 12px 16px 24px;
  max-width: 640px;
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
  opacity: 0.6;
  cursor: default;
}
.grid {
  display: grid;
  gap: 10px;
}
.card {
  aspect-ratio: 3 / 4;
  min-height: 72px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  cursor: pointer;
  perspective: 600px;
}
.inner {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transition: transform 0.35s ease;
  transform-style: preserve-3d;
}
.card.up .inner {
  transform: rotateY(180deg);
}
.side {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  border-radius: 14px;
  border: 2px solid var(--sea-200);
  box-shadow: 0 4px 0 var(--sea-200);
  backface-visibility: hidden;
  overflow-wrap: anywhere;
  text-align: center;
}
.back-side {
  background: var(--sea);
  color: white;
  font-size: 1.8rem;
  font-weight: 700;
}
.front-side {
  background: var(--paper);
  transform: rotateY(180deg);
}
.card.peek .front-side {
  background: var(--sun-soft);
  border-color: var(--sun);
}
.card.done {
  cursor: default;
}
.card.done .front-side {
  background: var(--leaf-soft);
  border-color: var(--leaf);
  box-shadow: none;
}
.term {
  font-weight: 700;
  font-size: 1.1rem;
}
.sub {
  color: var(--ink-soft);
  font-size: 0.85rem;
}
.emoji {
  font-size: 1.8rem;
}
.meaning {
  font-size: 0.95rem;
}
.mam .term {
  font-size: 1.35rem;
}
.mam .emoji {
  font-size: 2.2rem;
}
.mam .meaning {
  font-size: 1.1rem;
}
@media (prefers-reduced-motion: reduce) {
  .inner {
    transition: none;
  }
}
</style>
