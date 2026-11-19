<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { levelItems, phrases, termSegment, viSegment, type Deck, type LearnItem, type Level } from '@study/content';
import HintButton from '../../components/HintButton.vue';
import KnowledgeCard from '../../components/KnowledgeCard.vue';
import ResultPanel from '../../components/ResultPanel.vue';
import { speaker } from '../../audio';
import { settings } from '../../settings';
import { LISTEN_CONFIG } from '../ageConfig';
import { useHint } from '../hints';
import { levelIdOf, starsByMistakes, type LevelResult } from '../result';
import { ListenGame } from './ListenGame';

const props = defineProps<{ deck: Deck; level: Level }>();
const emit = defineEmits<{ exit: []; finish: [result: LevelResult] }>();

const config = computed(() => LISTEN_CONFIG[settings.ageGroup]);
const game = shallowRef(newGame());
// Bản phản ứng của trạng thái game để giao diện cập nhật.
const view = reactive({ index: 0, disabled: [] as string[], solved: false });
const finished = ref(false);
const usedHint = ref(false);
const stars = computed(() => starsByMistakes(game.value.mistakes, game.value.rounds.length, usedHint.value));
const answer = computed(() => game.value.rounds[view.index]!.answer);

/**
 * Hiện gì trên lựa chọn: `picture` chỉ hình; `both` hình + nghĩa; `text` chỉ nghĩa. Nghĩa tiếng Việt là dòng dịch nên
 * khi ẩn tiếng Việt thì bỏ; lúc đó `text` quay về hình (hiện từ đang học thì lộ đáp án vì đề đọc chính từ đó).
 */
const showText = computed(() => config.value.mode !== 'picture' && settings.showVietnamese);
const showEmoji = computed(() => config.value.mode !== 'text' || !showText.value);

function newGame() {
  const pool = levelItems(props.deck.subject, props.level);
  const { options, rounds } = LISTEN_CONFIG[settings.ageGroup];
  // Màn ít từ (không đủ emoji khác nhau) thì lấy thêm lựa chọn nhiễu từ cả đảo.
  const distinct = new Set(pool.map((i) => i.emoji)).size;
  return new ListenGame(pool, { options, rounds }, Math.random, distinct >= options ? pool : props.deck.items);
}

function sync() {
  Object.assign(view, { index: game.value.index, disabled: [...game.value.disabled], solved: game.value.solved });
}

const prompt = () => termSegment(props.deck, answer.value);

function replay() {
  void speaker.say([prompt()]);
}

function choose(item: LearnItem) {
  const result = game.value.choose(item.id);
  sync();
  // Đúng: thẻ kiến thức tự đọc; tắt tự đọc thì vẫn khen một câu.
  if (result === 'correct' && !settings.autoRead) void speaker.say([viSegment(phrases.correct)]);
  else if (result === 'wrong') void speaker.say([viSegment(phrases.wrong), prompt()]);
}

function hint() {
  if (!game.value.canEliminate || !useHint()) return;
  usedHint.value = true;
  game.value.eliminateWrong();
  sync();
}

async function next() {
  if (game.value.done) return finish();
  game.value.next();
  sync();
  // Chờ thẻ cũ gỡ xong (nó gọi speaker.stop() khi gỡ) rồi mới đọc đề mới.
  await nextTick();
  replay();
}

async function finish() {
  finished.value = true;
  const g = game.value;
  emit('finish', {
    ...levelIdOf(props.level),
    game: 'listen',
    stars: stars.value,
    firstTry: [...g.firstTry],
    wrong: [...g.wrong],
    usedHint: usedHint.value,
  });
  await nextTick();
  void speaker.say([viSegment(phrases.roundWin)]);
}

async function restart() {
  game.value = newGame();
  usedHint.value = false;
  finished.value = false;
  sync();
  await nextTick();
  void speaker.say([viSegment(phrases.listenIntro), prompt()]);
}

onMounted(() => void speaker.say([viSegment(phrases.listenIntro), prompt()]));
onBeforeUnmount(() => speaker.stop());
</script>

<template>
  <div class="listen" :class="`age-${settings.ageGroup}`">
    <header class="bar">
      <button class="back" type="button" @click="$emit('exit')">← Đảo</button>
      <h2 tabindex="-1">Nghe Chọn</h2>
      <span class="count">{{ view.index + 1 }}/{{ game.rounds.length }}</span>
    </header>

    <ResultPanel
      v-if="finished"
      :stars="stars"
      :message="`Bạn nghe đúng ${game.rounds.length} từ, sai ${game.mistakes} lần.`"
      @again="restart"
      @exit="$emit('exit')"
    />

    <template v-else>
      <div class="tools">
        <button class="replay" type="button" data-testid="listen-replay" @click="replay">🔁 Nghe lại</button>
        <HintButton data-testid="listen-hint" :disabled="view.solved || !game.canEliminate" @use="hint" />
      </div>

      <div class="options" :class="`mode-${config.mode}`" aria-label="Lựa chọn">
        <button
          v-for="(item, i) in game.rounds[view.index]!.options"
          :key="`${view.index}-${item.id}`"
          type="button"
          class="option"
          :class="{ out: view.disabled.includes(item.id), right: view.solved && item.id === answer.id }"
          :disabled="view.solved || view.disabled.includes(item.id)"
          :aria-label="showText ? undefined : `Hình ${i + 1}: ${item.meaningVi}`"
          :data-testid="`listen-option-${item.id}`"
          @click="choose(item)"
        >
          <span v-if="showEmoji" class="emoji" aria-hidden="true">{{ item.emoji }}</span>
          <span v-if="showText" class="text">{{ item.meaningVi }}</span>
        </button>
      </div>

      <template v-if="view.solved">
        <KnowledgeCard :key="view.index" :deck="deck" :item="answer" />
        <button class="next primary" type="button" data-testid="listen-next" @click="next">Tiếp →</button>
      </template>
    </template>
  </div>
</template>

<style scoped>
.listen {
  display: grid;
  gap: 14px;
  padding: 12px 16px 24px;
  max-width: 880px;
  margin: 0 auto;
}
.tools {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.replay,
.hint,
.next {
  min-height: 56px;
  border-radius: 28px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  font: inherit;
  font-size: 1.2rem;
  padding: 8px 20px;
  cursor: pointer;
  box-shadow: 0 4px 0 var(--sea-200);
}
.replay {
  font-size: 1.5rem;
  min-height: 72px;
  padding: 8px 28px;
  border-color: var(--sea);
  background: var(--sea-50);
}
.hint:disabled {
  opacity: 0.5;
  cursor: default;
}
.next {
  justify-self: center;
  background: var(--sea);
  color: white;
  border-color: var(--sea);
  font-weight: 700;
}
.options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.age-mam .options {
  grid-template-columns: repeat(3, 1fr);
}
.option {
  min-height: 88px;
  border-radius: 18px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  font: inherit;
  font-size: 1.2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  cursor: pointer;
  box-shadow: 0 4px 0 var(--sea-200);
  transition:
    transform 0.12s ease,
    opacity 0.2s ease;
}
.option:active {
  transform: translateY(2px);
}
.option:disabled {
  cursor: default;
}
.option.out {
  opacity: 0.3;
  box-shadow: none;
}
.option.right {
  background: var(--leaf-soft);
  border-color: var(--leaf);
}
.emoji {
  font-size: 2.6rem;
}
.mode-picture .emoji {
  font-size: 3.6rem;
}
.text {
  font-weight: 600;
}
.age-mam .option {
  min-height: 120px;
}
</style>
