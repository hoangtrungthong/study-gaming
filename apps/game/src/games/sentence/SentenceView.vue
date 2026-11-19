<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import {
  chunkSegment,
  levelSentences,
  phrases,
  sentenceSegments,
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
import { SENTENCE_CONFIG } from '../ageConfig';
import { useDrag } from '../drag';
import { useHint } from '../hints';
import { levelIdOf, starsByMistakes, type LevelResult } from '../result';
import { SentenceGame, type Piece } from './SentenceGame';

const props = defineProps<{ deck: Deck; level: Level }>();
const emit = defineEmits<{ exit: []; finish: [result: LevelResult] }>();

const game = shallowRef(newGame());
// Bản phản ứng của trạng thái game để giao diện cập nhật.
const view = reactive({
  index: 0,
  pieces: [] as Piece[],
  tray: [] as boolean[],
  slots: [] as (number | null)[],
  done: false,
});
const selected = ref<number | null>(null);
/** Khối vừa bị trả về khay vì sai chỗ: rung đỏ một lúc. */
const bounced = ref<number[]>([]);
/** Câu đã xếp đúng, đang đọc lại trước khi sang câu mới. */
const solved = ref(false);
const usedHint = ref(false);
/**
 * Lượt đọc lại câu đúng. `speaker.say` cũng xong khi bị cắt (gỡ màn gọi `speaker.stop()`), nên sau khi chờ đọc phải
 * kiểm còn đúng lượt này không; gỡ màn thì tăng số để mọi lượt đang chờ bỏ cuộc.
 */
let readBack = 0;
const current = computed(() => (view.done ? undefined : game.value.sentences[view.index]));
const full = computed(() => view.slots.length > 0 && view.slots.every((p) => p !== null));
const stars = computed(() => starsByMistakes(game.value.mistakes, game.value.sentences.length, usedHint.value));

function newGame() {
  return new SentenceGame(levelSentences(props.deck.subject, props.level), SENTENCE_CONFIG[settings.ageGroup]);
}

function sync() {
  const g = game.value;
  Object.assign(view, { index: g.index, pieces: g.pieces, tray: [...g.tray], slots: [...g.slots], done: g.done });
}
sync();

/** Đề của câu: Mầm/Chồi nghe nghĩa tiếng Việt, Cây nghe câu gốc. Ẩn tiếng Việt thì ai cũng nghe câu gốc. */
function promptSegments(): SpeechSegment[] {
  const s = current.value;
  if (!s) return [];
  if (settings.ageGroup !== 'cay' && settings.showVietnamese) return [translationSegment(s.textVi)];
  return [sentenceSegments(props.deck, s)[0]!];
}

function pieceSegment(piece: Piece): SpeechSegment {
  const s = current.value!;
  return piece.chunk === null
    ? { lang: props.deck.termLang, text: piece.text }
    : chunkSegment(props.deck, s, piece.chunk);
}

const interactive = () => !solved.value && !view.done;

function selectPiece(piece: number) {
  if (!interactive()) return;
  selected.value = selected.value === piece ? null : piece;
  // Chạm khối là nghe khối đó (trẻ chưa biết đọc vẫn chơi được).
  if (selected.value !== null) void speaker.say([pieceSegment(view.pieces[piece]!)]);
}

function tapSlot(slot: number) {
  if (!interactive()) return;
  if (selected.value !== null) {
    game.value.place(selected.value, slot);
    selected.value = null;
  } else {
    game.value.remove(slot);
  }
  sync();
}

function tapPiece(piece: number) {
  const slot = game.value.slotOf(piece);
  if (slot >= 0) tapSlot(slot);
  else selectPiece(piece);
}

const { dragging, start } = useDrag<number>({
  onDrop(piece, target) {
    if (!interactive()) return;
    selected.value = null;
    if (target === 'tray') {
      const slot = game.value.slotOf(piece);
      if (slot >= 0) game.value.remove(slot);
    } else {
      game.value.place(piece, Number(target.slice('slot-'.length)));
    }
    sync();
  },
  onTap: tapPiece,
});

function onPointerDown(event: PointerEvent, piece: number | null | undefined) {
  if (piece === null || piece === undefined || !interactive()) return;
  start(event, piece);
}

// Chạm bằng ngón tay / chuột đã do useDrag (onTap) xử lý; `click` chỉ còn cho bàn phím (detail = 0).
function onTrayClick(event: MouseEvent, piece: number) {
  if (event.detail === 0) tapPiece(piece);
}
function onSlotClick(event: MouseEvent, slot: number) {
  if (event.detail === 0 || view.slots[slot] === null) tapSlot(slot);
}

async function submit() {
  if (!interactive() || !full.value) return;
  const before = [...view.slots];
  const result = game.value.submit();
  selected.value = null;
  if (result.ok) {
    solved.value = true;
    sync();
    const token = ++readBack;
    await speaker.say(sentenceSegments(props.deck, current.value!));
    if (token !== readBack) return;
    solved.value = false;
    game.value.next();
    sync();
    if (view.done) finish();
    else void speaker.say(promptSegments());
    return;
  }
  bounced.value = result.wrongSlots.map((slot) => before[slot]!);
  setTimeout(() => (bounced.value = []), 450);
  sync();
  void speaker.say([viSegment(phrases.sentenceWrong), ...promptSegments()]);
}

function hint() {
  if (!interactive() || game.value.allCorrect() || !useHint()) return;
  usedHint.value = true;
  selected.value = null;
  game.value.placeOneCorrect();
  sync();
}

function finish() {
  const g = game.value;
  const result: LevelResult = {
    ...levelIdOf(props.level),
    game: 'sentence',
    stars: stars.value,
    firstTry: [...g.firstTry],
    wrong: [...g.wrong],
    usedHint: usedHint.value,
  };
  void speaker.say([viSegment(phrases.roundWin)]);
  emit('finish', result);
}

function replay() {
  void speaker.say(promptSegments());
}

async function restart() {
  game.value = newGame();
  usedHint.value = false;
  selected.value = null;
  bounced.value = [];
  sync();
  // Chờ màn kết quả gỡ xong rồi mới đọc.
  await nextTick();
  void speaker.say([viSegment(phrases.sentenceIntro), ...promptSegments()]);
}

onMounted(() => void speaker.say([viSegment(phrases.sentenceIntro), ...promptSegments()]));
onBeforeUnmount(() => {
  readBack++;
  speaker.stop();
});
</script>

<template>
  <div class="sentence">
    <header class="bar">
      <button class="back" type="button" @click="$emit('exit')">← Đảo</button>
      <h2 tabindex="-1">Xếp Câu</h2>
      <span class="count">{{ Math.min(view.index + 1, game.sentences.length) }}/{{ game.sentences.length }}</span>
    </header>

    <ResultPanel
      v-if="view.done"
      :stars="stars"
      :message="`Bạn xếp xong ${game.sentences.length} câu, sai ${game.mistakes} lần.`"
      @again="restart"
      @exit="$emit('exit')"
    />

    <div v-else-if="current" class="board">
      <div class="prompt">
        <span v-if="current.emoji" class="emoji" aria-hidden="true">{{ current.emoji }}</span>
        <p v-if="settings.showVietnamese" class="vi">{{ current.textVi }}</p>
        <button type="button" class="replay" data-testid="sentence-replay" :disabled="solved" @click="replay">
          🔊 Nghe lại
        </button>
      </div>

      <div class="slots" :class="{ solved }" aria-label="Câu đang xếp">
        <button
          v-for="(piece, i) in view.slots"
          :key="i"
          type="button"
          class="slot"
          :class="{ filled: piece !== null }"
          :data-drop="`slot-${i}`"
          :data-testid="`sentence-slot-${i}`"
          :aria-label="piece === null ? `Chỗ trống số ${i + 1}` : undefined"
          @pointerdown="onPointerDown($event, piece)"
          @click="onSlotClick($event, i)"
        >
          <template v-if="piece !== null">
            <span class="main" :lang="deck.termLang">{{ view.pieces[piece]!.text }}</span>
            <span v-if="view.pieces[piece]!.reading" class="sub" lang="ja">{{ view.pieces[piece]!.reading }}</span>
          </template>
        </button>
      </div>

      <div class="tray" data-drop="tray" aria-label="Khay khối chữ">
        <template v-for="(inTray, i) in view.tray" :key="i">
          <button
            v-if="inTray"
            type="button"
            class="chunk"
            :class="{ selected: selected === i, wrong: bounced.includes(i) }"
            :aria-pressed="selected === i"
            :data-testid="`sentence-chunk-${i}`"
            @pointerdown="onPointerDown($event, i)"
            @click="onTrayClick($event, i)"
          >
            <span class="main" :lang="deck.termLang">{{ view.pieces[i]!.text }}</span>
            <span v-if="view.pieces[i]!.reading" class="sub" lang="ja">{{ view.pieces[i]!.reading }}</span>
          </button>
          <span v-else class="chunk ghost" aria-hidden="true"></span>
        </template>
      </div>

      <div class="actions">
        <HintButton data-testid="sentence-hint" :disabled="solved" @use="hint" />
        <button type="button" class="primary" data-testid="sentence-done" :disabled="!full || solved" @click="submit">
          Xong
        </button>
      </div>
    </div>

    <div
      v-if="dragging"
      class="chunk floating"
      aria-hidden="true"
      :style="{ left: `${dragging.x}px`, top: `${dragging.y}px` }"
    >
      <span class="main" :lang="deck.termLang">{{ view.pieces[dragging.payload]?.text }}</span>
    </div>
  </div>
</template>

<style scoped>
.sentence {
  display: grid;
  gap: 14px;
  padding: 12px 16px 24px;
  max-width: 880px;
  margin: 0 auto;
}
.board {
  display: grid;
  gap: 18px;
}
.prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  text-align: center;
}
.emoji {
  font-size: 2.6rem;
}
.vi {
  margin: 0;
  font-size: 1.2rem;
  color: var(--ink-soft);
}
.replay {
  min-height: 48px;
  padding: 0 14px;
  border-radius: 999px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  font: inherit;
  cursor: pointer;
}
.replay:disabled {
  opacity: 0.5;
  cursor: default;
}
.slots,
.tray {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  border-radius: 18px;
}
.slots {
  background: var(--sea-50);
  border: 2px dashed var(--sea-200);
}
.slots.solved {
  background: var(--leaf-soft);
  border-color: var(--leaf);
}
.tray {
  min-height: 80px;
}
.slot,
.chunk {
  min-width: 72px;
  min-height: 56px;
  border-radius: 14px;
  font: inherit;
  font-size: 1.2rem;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  touch-action: none;
  user-select: none;
}
.slot {
  border: 2px dashed var(--sea-200);
  background: transparent;
  cursor: pointer;
}
.slot.filled,
.chunk {
  border: 2px solid var(--sea-200);
  background: var(--paper);
  box-shadow: 0 4px 0 var(--sea-200);
  cursor: grab;
}
.chunk.selected {
  border-color: var(--sea);
  background: var(--sea-50);
  box-shadow: 0 4px 0 var(--sea);
}
.chunk.wrong {
  animation: shake 0.4s;
  border-color: var(--coral);
  color: var(--coral);
}
.chunk.ghost {
  visibility: hidden;
}
.chunk.floating {
  position: fixed;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 10;
  opacity: 0.9;
}
.main {
  font-weight: 700;
}
.sub {
  color: var(--ink-soft);
  font-size: 0.85rem;
}
.actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}
.actions button {
  min-height: 48px;
  min-width: 120px;
  border-radius: 999px;
  font: inherit;
  font-size: 1.1rem;
  cursor: pointer;
  border: 2px solid var(--sea-200);
  background: var(--paper);
}
.actions .primary {
  background: var(--sea);
  border-color: var(--sea);
  color: var(--paper);
}
.actions button:disabled {
  opacity: 0.5;
  cursor: default;
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
