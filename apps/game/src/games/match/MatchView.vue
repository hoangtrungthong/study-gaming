<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { phrases, termSegment, viSegment, type Deck, type LearnItem } from '@study/content';
import KnowledgeCard from '../../components/KnowledgeCard.vue';
import ResultPanel from '../../components/ResultPanel.vue';
import { speaker } from '../../audio';
import { settings } from '../../settings';
import { MATCH_CONFIG } from '../ageConfig';
import { MatchGame } from './MatchGame';

const props = defineProps<{ deck: Deck }>();
defineEmits<{ exit: [] }>();

const game = shallowRef(newGame());
// Bản phản ứng của trạng thái game để giao diện cập nhật.
const view = reactive({ selected: null as string | null, matched: [] as string[], wrong: null as string | null });
const lastMatched = ref<LearnItem | null>(null);
const finished = computed(() => view.matched.length === game.value.left.length);

function newGame() {
  return new MatchGame(props.deck.items, MATCH_CONFIG[settings.ageGroup].pairs);
}

async function restart() {
  game.value = newGame();
  Object.assign(view, { selected: null, matched: [], wrong: null });
  lastMatched.value = null;
  // Chờ thẻ cũ gỡ xong (nó gọi speaker.stop() khi gỡ) rồi mới đọc hướng dẫn.
  await nextTick();
  void speaker.say([viSegment(phrases.matchIntro)]);
}

function pickLeft(item: LearnItem) {
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
  } else if (result === 'wrong') {
    view.wrong = item.id;
    setTimeout(() => (view.wrong = null), 450);
    void speaker.say([viSegment(phrases.wrong)]);
  }
}

onMounted(() => void speaker.say([viSegment(phrases.matchIntro)]));
onBeforeUnmount(() => speaker.stop());
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

    <div v-else class="board">
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
          :class="{ done: view.matched.includes(item.id), wrong: view.wrong === item.id }"
          :disabled="view.matched.includes(item.id)"
          :data-testid="`right-${item.id}`"
          @click="pickRight(item)"
        >
          <span class="emoji" aria-hidden="true">{{ item.emoji }}</span>
          <span v-if="settings.showVietnamese" class="main">{{ item.meaningVi }}</span>
        </button>
      </div>
    </div>

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
