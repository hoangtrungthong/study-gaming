<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, triggerRef } from 'vue';
import {
  findKana,
  kanaSegment,
  loadKanaStrokes,
  phrases,
  termSegment,
  translationSegment,
  viSegment,
  type Deck,
  type KanaStrokes,
  type Level,
  type SpeechSegment,
} from '@study/content';
import HintButton from '../../components/HintButton.vue';
import ResultPanel from '../../components/ResultPanel.vue';
import { speaker } from '../../audio';
import { settings } from '../../settings';
import { KANA_CONFIG } from '../ageConfig';
import { useHint } from '../hints';
import { levelIdOf, type LevelResult } from '../result';
import { exampleWord } from './exampleWord';
import { KanaTrace } from './KanaTrace';
import { BOX, type Point } from './strokeMatch';

const props = defineProps<{ deck: Deck; level: Level }>();
const emit = defineEmits<{ exit: []; finish: [result: LevelResult] }>();

/** Thời gian khen một chữ vừa tô xong trước khi sang chữ sau. */
const CELEBRATE_MS = 1200;
/** Thời gian nét mờ đi sau khi vẽ sai. */
const FADE_MS = 500;
/** Mỗi nét trong hoạt ảnh thứ tự nét (cũng là thời gian hiện nét mẫu của Đèn Pin). */
const STROKE_MS = 700;

let chars: KanaStrokes[] = [];
const game = shallowRef(new KanaTrace([], 0));
const view = reactive({
  ready: false,
  index: 0,
  strokeIndex: 0,
  finished: false,
  usedHint: false,
  /** Nét vừa sai: mũi tên nhấp nháy (nhóm Cây: mũi tên chỉ hiện sau khi sai). */
  wrongStroke: false,
  /** Chữ vừa tô xong, đang khen. */
  celebrating: null as KanaStrokes | null,
  /** Nét đang hiện lại theo Đèn Pin. */
  hintStroke: -1,
  /** Đang chạy hoạt ảnh cả chữ theo thứ tự nét. */
  replaying: false,
});
// Nét đang vẽ: thêm điểm tại chỗ rồi triggerRef, không chép cả mảng mỗi lần pointermove.
const drawing = shallowRef<Point[] | null>(null);
const fading = ref<Point[] | null>(null);
const board = ref<SVGSVGElement | null>(null);

const shown = computed(() => view.celebrating ?? game.value.chars[view.index]);
const busy = computed(() => view.celebrating !== null || view.finished);
const expected = computed(() => (busy.value ? undefined : shown.value?.strokes[view.strokeIndex]));
const showArrow = computed(() => KANA_CONFIG[settings.ageGroup].arrowsAlways || view.wrongStroke);

let alive = true;
let celebrateTimer: ReturnType<typeof setTimeout> | undefined;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;
let hintTimer: ReturnType<typeof setTimeout> | undefined;
let replayTimer: ReturnType<typeof setTimeout> | undefined;
/** Khung bảng vẽ đo một lần lúc đặt bút: đo lại mỗi pointermove buộc trình duyệt tính lại bố cục. */
let boardRect: DOMRect | undefined;

const line = (pts: readonly Point[]) => pts.map(([x, y]) => `${x},${y}`).join(' ');

function clearTimers() {
  clearTimeout(celebrateTimer);
  clearTimeout(fadeTimer);
  clearTimeout(hintTimer);
  clearTimeout(replayTimer);
}

function sync() {
  view.index = game.value.index;
  view.strokeIndex = game.value.strokeIndex;
}

/** Lời đọc khi vào một chữ: tên chữ, rồi một từ ví dụ bắt đầu bằng chữ đó (nếu bộ từ có) cùng nghĩa của từ. */
function charSegments(char: string): SpeechSegment[] {
  const word = exampleWord(props.deck.items, char);
  return [kanaSegment(char), ...(word ? [termSegment(props.deck, word), translationSegment(word.meaningVi)] : [])];
}

function start() {
  clearTimers();
  game.value = new KanaTrace(chars, KANA_CONFIG[settings.ageGroup].tolerance);
  Object.assign(view, {
    finished: false,
    usedHint: false,
    wrongStroke: false,
    celebrating: null,
    hintStroke: -1,
    replaying: false,
  });
  drawing.value = null;
  fading.value = null;
  sync();
  const first = game.value.current;
  void speaker.say([viSegment(phrases.kanaIntro), ...(first ? charSegments(first.char) : [])]);
}

function submit(points: Point[]) {
  const char = game.value.current!;
  const result = game.value.submitStroke(points);
  if (result === 'wrong') {
    view.wrongStroke = true;
    fading.value = points;
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => (fading.value = null), FADE_MS);
    void speaker.say([viSegment(phrases.kanaStrokeWrong)]);
    return;
  }
  view.wrongStroke = false;
  view.hintStroke = -1;
  if (result === 'ok') return sync();
  if (result === 'done') {
    sync();
    view.finished = true;
    void speaker.say([kanaSegment(char.char), viSegment(phrases.kanaDone)]);
    finish();
    return;
  }
  // Xong một chữ: giữ chữ vừa tô trên bảng để khen, rồi mới sang chữ sau.
  view.celebrating = char;
  void speaker.say([kanaSegment(char.char)]);
  celebrateTimer = setTimeout(() => {
    view.celebrating = null;
    sync();
    void speaker.say(charSegments(game.value.current!.char));
  }, CELEBRATE_MS);
}

function toBox(e: PointerEvent): Point {
  const r = boardRect!;
  return [((e.clientX - r.left) / r.width) * BOX, ((e.clientY - r.top) / r.height) * BOX];
}

function down(e: PointerEvent) {
  if (!expected.value) return;
  // Giữ sự kiện cho bảng vẽ cả khi ngón tay trượt ra ngoài.
  board.value!.setPointerCapture?.(e.pointerId);
  boardRect = board.value!.getBoundingClientRect();
  drawing.value = [toBox(e)];
}

function move(e: PointerEvent) {
  if (!drawing.value) return;
  drawing.value.push(toBox(e));
  triggerRef(drawing);
}

function up() {
  const points = drawing.value;
  drawing.value = null;
  if (points && expected.value) submit(points);
}

function cancel() {
  drawing.value = null;
}

/**
 * Nút ẩn (chỉ hiện khi được focus bằng bàn phím) nộp đúng nét chuẩn đang chờ: người dùng bàn phím / trình đọc màn
 * hình không vẽ được bằng chuột vẫn đi tiếp được, và E2E có đường đi ổn định không phụ thuộc toạ độ màn hình.
 */
function autoStroke() {
  if (expected.value) submit(expected.value.map(([x, y]) => [x, y] as Point));
}

function hint() {
  if (!useHint()) return;
  view.usedHint = true;
  view.hintStroke = game.value.hint();
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => (view.hintStroke = -1), STROKE_MS * 2);
}

function replay() {
  view.replaying = true;
  clearTimeout(replayTimer);
  replayTimer = setTimeout(() => (view.replaying = false), STROKE_MS * (shown.value!.strokes.length + 1));
}

function finish() {
  const g = game.value;
  emit('finish', {
    ...levelIdOf(props.level),
    game: 'kana',
    stars: g.stars(view.usedHint),
    firstTry: [...g.firstTry],
    wrong: [...g.wrong],
    usedHint: view.usedHint,
  });
}

onMounted(async () => {
  const all = await loadKanaStrokes();
  if (!alive) return;
  chars = (props.level.kana ?? []).map((c) => findKana(all, c)).filter((k): k is KanaStrokes => k !== undefined);
  view.ready = true;
  start();
});
onBeforeUnmount(() => {
  alive = false;
  clearTimers();
  speaker.stop();
});
</script>

<template>
  <div class="kana" :class="settings.ageGroup" :data-ready="view.ready">
    <header class="bar">
      <button class="back" type="button" @click="$emit('exit')">← Đảo</button>
      <h2 tabindex="-1">Vẽ Kana</h2>
      <span class="count">{{ Math.min(view.index + 1, game.chars.length) }}/{{ game.chars.length }}</span>
    </header>

    <p v-if="view.ready && game.chars.length === 0" class="empty">Màn này chưa có chữ để tô.</p>

    <ResultPanel
      v-else-if="view.finished"
      :stars="game.stars(view.usedHint)"
      :message="`Bạn tô xong ${game.chars.length} chữ, vẽ sai ${game.mistakes} nét.`"
      @again="start"
      @exit="$emit('exit')"
    />

    <template v-else-if="shown">
      <div class="tools">
        <p class="char" data-testid="kana-char" lang="ja">
          {{ shown.char }} <small>{{ shown.romaji }}</small>
        </p>
        <button type="button" class="tool" data-testid="kana-replay" :disabled="view.replaying" @click="replay">
          🔁 Xem thứ tự nét
        </button>
        <HintButton class="tool" data-testid="kana-hint" :disabled="busy || view.hintStroke >= 0" @use="hint" />
      </div>

      <svg
        ref="board"
        class="board"
        :class="{ celebrate: view.celebrating }"
        :viewBox="`0 0 ${BOX} ${BOX}`"
        role="img"
        :aria-label="`Bảng tô chữ ${shown.char}, nét ${view.strokeIndex + 1} trên ${shown.strokes.length}`"
        data-testid="kana-board"
        @pointerdown.prevent="down"
        @pointermove.prevent="move"
        @pointerup="up"
        @pointercancel="cancel"
      >
        <defs>
          <marker id="kana-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" class="arrow-head" />
          </marker>
        </defs>
        <line x1="54.5" y1="4" x2="54.5" y2="105" class="grid" />
        <line x1="4" y1="54.5" x2="105" y2="54.5" class="grid" />

        <polyline v-for="(s, i) in shown.strokes" :key="`g${i}`" :points="line(s)" class="guide" />
        <polyline
          v-for="(s, i) in shown.strokes.slice(0, view.celebrating ? shown.strokes.length : view.strokeIndex)"
          :key="`d${i}`"
          :points="line(s)"
          class="done-stroke"
        />

        <template v-if="expected">
          <polyline
            v-if="showArrow"
            :points="line(expected)"
            class="next"
            :class="{ blink: view.wrongStroke }"
            marker-end="url(#kana-arrow)"
          />
          <circle :cx="expected[0]![0]" :cy="expected[0]![1]" r="4.5" class="start-dot" />
          <text :x="expected[0]![0]" :y="expected[0]![1]" class="start-num">{{ view.strokeIndex + 1 }}</text>
        </template>

        <polyline
          v-if="view.hintStroke >= 0 && shown.strokes[view.hintStroke]"
          :points="line(shown.strokes[view.hintStroke]!)"
          pathLength="1"
          class="animate hint-stroke"
          data-testid="kana-hint-stroke"
        />
        <template v-if="view.replaying">
          <polyline
            v-for="(s, i) in shown.strokes"
            :key="`r${i}`"
            :points="line(s)"
            pathLength="1"
            class="animate replay-stroke"
            :style="{ animationDelay: `${i * 0.7}s` }"
          />
        </template>

        <polyline v-if="fading" :points="line(fading)" class="fading" />
        <polyline v-if="drawing" :points="line(drawing)" class="drawing" />
      </svg>

      <button type="button" class="sr-only auto" data-testid="kana-auto-stroke" :disabled="busy" @click="autoStroke">
        Tô giúp nét {{ view.strokeIndex + 1 }}
      </button>
      <p v-if="view.celebrating" class="cheer" aria-live="polite">Giỏi lắm!</p>
    </template>
  </div>
</template>

<style scoped>
.kana {
  display: grid;
  gap: 12px;
  padding: 12px 16px 24px;
  max-width: 560px;
  margin: 0 auto;
}
.tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.char {
  margin: 0 auto 0 0;
  font-size: 2.2rem;
  font-weight: 700;
}
.char small {
  font-size: 1rem;
  color: var(--ink-soft);
}
.tool {
  min-height: 48px;
  padding: 0 14px;
  border-radius: 24px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  font: inherit;
  cursor: pointer;
}
.tool.hint {
  background: var(--sun-soft);
}
.tool:disabled {
  opacity: 0.6;
  cursor: default;
}
.board {
  width: min(100%, 72vh);
  aspect-ratio: 1;
  justify-self: center;
  background: white;
  border: 2px solid var(--sea-200);
  border-radius: 20px;
  /* Vẽ không làm cuộn trang hay phóng to trên điện thoại (Yêu cầu 7.5). */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: crosshair;
}
.board.celebrate {
  animation: pop 0.6s ease;
}
.mam .board {
  width: min(100%, 80vh);
}
polyline {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.grid {
  stroke: var(--sea-50);
  stroke-width: 0.6;
  stroke-dasharray: 2 2;
}
.guide {
  stroke: #e3e8eb;
  stroke-width: 8;
}
.done-stroke {
  stroke: var(--ink);
  stroke-width: 6;
}
.next {
  stroke: var(--sea-200);
  stroke-width: 2;
  stroke-dasharray: 3 3;
}
.next.blink {
  animation: blink 0.5s 3;
}
.arrow-head {
  fill: var(--sea);
}
.start-dot {
  fill: var(--leaf);
}
.start-num {
  fill: white;
  font-size: 6px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}
.drawing {
  stroke: var(--sea);
  stroke-width: 5;
}
.fading {
  stroke: var(--coral);
  stroke-width: 5;
  animation: fade 0.5s forwards;
}
.animate {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 0.7s ease forwards;
}
.hint-stroke {
  stroke: var(--sun);
  stroke-width: 7;
}
.replay-stroke {
  stroke: var(--leaf);
  stroke-width: 6;
}
.auto:focus-visible {
  position: static;
  width: auto;
  height: auto;
  margin: 0;
  clip: auto;
  justify-self: center;
  min-height: 48px;
}
.cheer {
  margin: 0;
  text-align: center;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--leaf);
}
.empty {
  text-align: center;
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes fade {
  to {
    opacity: 0;
  }
}
@keyframes blink {
  50% {
    opacity: 0.2;
  }
}
@keyframes pop {
  50% {
    transform: scale(1.04);
  }
}
</style>
