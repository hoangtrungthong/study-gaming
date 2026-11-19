<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import {
  levelItems,
  phrases,
  termSegment,
  translationSegment,
  viSegment,
  type Deck,
  type LearnItem,
  type Level,
  type SpeechSegment,
} from '@study/content';
import HintButton from '../../components/HintButton.vue';
import ResultPanel from '../../components/ResultPanel.vue';
import { speaker } from '../../audio';
import { settings } from '../../settings';
import { STAR_CONFIG } from '../ageConfig';
import { useHint } from '../hints';
import { levelIdOf, starsByMistakes, type LevelResult } from '../result';
import { promptLabel } from '../rain/labels';
import { StarGame, type Star, type StarEvent } from './StarGame';

const props = defineProps<{ deck: Deck; level: Level }>();
const emit = defineEmits<{ exit: []; finish: [result: LevelResult] }>();

/** Giây làm chậm rơi cho mỗi Đèn Pin (đã chốt 2026-11-18). */
const SLOW_SECONDS = 5;
/** Mỗi lần nhấn phím ← → giỏ đi một đoạn bằng phần này của khung chơi. */
const KEY_STEP = 0.08;

type Phase = 'setup' | 'playing' | 'over';
const phase = ref<Phase>('setup');
const playArea = ref<HTMLElement | null>(null);
const catchList = ref<HTMLElement | null>(null);
const promptButton = ref<HTMLElement | null>(null);
const game = shallowRef<StarGame | null>(null);
const usedHint = ref(false);
// Bản sao phản ứng để vẽ đề, số đề và danh sách đọc màn hình.
const hud = ref({ round: 0, prompt: null as LearnItem | null, stars: [] as Star[], slowed: false });

let stopScene: (() => void) | null = null;
/** Người chơi đang dùng nút hứng bằng bàn phím: giữ focus trong danh sách khi sao đổi. */
let keepCatchFocus = false;
let unmounted = false;

const items = computed(() => {
  const list = levelItems(props.deck.subject, props.level);
  return list.length > 0 ? list : props.deck.items;
});
const fontScale = computed(() => (settings.ageGroup === 'mam' ? 1.3 : 1));
const rounds = computed(() => game.value?.prompts.length ?? 0);
const stars = computed(() => starsByMistakes(game.value?.mistakes ?? 0, rounds.value, usedHint.value));
const message = computed(() => `Bạn hứng đúng ${rounds.value} ngôi sao, nhầm ${game.value?.mistakes ?? 0} lần.`);

function refreshHud() {
  const g = game.value!;
  hud.value = { round: g.round, prompt: g.prompt ?? null, stars: [...g.stars], slowed: g.slowed };
}

/** Đề: đọc nghĩa (dòng dịch); ẩn tiếng Việt thì chỉ hiện hình và Tomo nhắc tìm từ của hình. */
function promptSegments(): SpeechSegment[] {
  const prompt = game.value?.prompt;
  if (!prompt) return [];
  return settings.showVietnamese ? [translationSegment(prompt.meaningVi)] : [viSegment(phrases.starFindPicture)];
}

/** Gọi mỗi khung hình: mọi câu của một khung gộp thành một lượt đọc, không thì câu sau cắt câu trước. */
function handleEvents(events: readonly StarEvent[]) {
  if (catchList.value?.contains(document.activeElement)) keepCatchFocus = true;
  const segments: SpeechSegment[] = [];
  let over = false;
  for (const e of events) {
    if (e.type === 'caught')
      segments.push(termSegment(props.deck, e.star.item), translationSegment(e.star.item.meaningVi));
    if (e.type === 'wrong') segments.push(viSegment(phrases.starWrong), ...promptSegments());
    if (e.type === 'lost') segments.push(viSegment(phrases.starLost), ...promptSegments());
    if (e.type === 'round') segments.push(...promptSegments());
    if (e.type === 'over') over = true;
  }
  if (over) segments.push(viSegment(phrases.roundWin));
  if (segments.length > 0) void speaker.say(segments);
  if (events.length > 0) refreshHud();
  if (over) finish();
  if (keepCatchFocus) void restoreCatchFocus();
}

/**
 * Hứng sao (hay sao rơi xuống) gỡ mất nút đang focus: focus rơi về <body> và danh sách ẩn đi, người dùng bàn phím
 * phải Tab lại từ đầu. Nên đưa focus sang nút hứng đầu tiên còn lại; hết sao thì tạm đặt lên đề, đợi lượt sao mới
 * rơi xuống rồi đưa vào nút đầu tiên. Người chơi đã tự chuyển focus đi chỗ khác thì thôi.
 */
async function restoreCatchFocus() {
  await nextTick();
  const list = catchList.value;
  const active = document.activeElement;
  if (list?.contains(active)) return;
  if (!list || (active !== document.body && active !== promptButton.value)) {
    keepCatchFocus = false;
    return;
  }
  (list.querySelector('button') ?? promptButton.value)?.focus();
}

async function start() {
  speaker.stop();
  usedHint.value = false;
  keepCatchFocus = false;
  phase.value = 'playing';
  game.value = new StarGame(items.value, STAR_CONFIG[settings.ageGroup]);
  refreshHud();
  void speaker.say(promptSegments());
  await nextTick();
  const { startStarScene } = await import('./StarScene');
  const g = game.value;
  // Người chơi có thể đã thoát trong lúc cảnh Phaser đang tải.
  if (unmounted || phase.value !== 'playing' || !playArea.value) return;
  const handle = startStarScene(playArea.value, {
    game: g,
    fontScale: fontScale.value,
    label: (star) => promptLabel(star.item, 'term'),
    onEvents: handleEvents,
    onStarTap: (star) => void speaker.say([termSegment(props.deck, star.item)]),
    onBasketMove: (x) => g.moveBasket(x),
  });
  stopScene = handle.destroy;
}

function finish() {
  const g = game.value!;
  phase.value = 'over';
  stopScene?.();
  stopScene = null;
  const result: LevelResult = {
    ...levelIdOf(props.level),
    game: 'star',
    stars: stars.value,
    firstTry: g.firstTry,
    wrong: g.wrong,
    usedHint: usedHint.value,
  };
  emit('finish', result);
}

function catchStar(star: Star) {
  handleEvents(game.value!.catchStar(star.id));
}

function hint() {
  if (phase.value !== 'playing' || !useHint()) return;
  usedHint.value = true;
  game.value!.slowDown(SLOW_SECONDS);
  refreshHud();
}

function onKey(e: KeyboardEvent) {
  const g = game.value;
  if (phase.value !== 'playing' || !g) return;
  if (e.key === 'ArrowLeft') g.moveBasket(g.basketX - KEY_STEP);
  else if (e.key === 'ArrowRight') g.moveBasket(g.basketX + KEY_STEP);
  else return;
  e.preventDefault();
}

/** Chạm / bấm chuột là đang chơi bằng tay: thôi giữ focus trong danh sách nút hứng. */
function onPointer() {
  keepCatchFocus = false;
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', onPointer);
  void speaker.say([viSegment(phrases.starIntro)]);
});
onBeforeUnmount(() => {
  unmounted = true;
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('pointerdown', onPointer);
  stopScene?.();
  speaker.stop();
});
</script>

<template>
  <div class="star">
    <header class="bar">
      <button class="back" type="button" @click="$emit('exit')">← Đảo</button>
      <h2 tabindex="-1">Hứng Sao</h2>
      <span v-if="phase === 'playing'" class="hud">
        <span aria-label="Đề">⭐ {{ hud.round + 1 }}/{{ rounds }}</span>
        <!-- Đang rơi chậm thì tắt nút: bấm thêm chỉ tốn Đèn Pin vì không cộng dồn. -->
        <HintButton data-testid="star-hint" :disabled="phase !== 'playing' || hud.slowed" @use="hint" />
      </span>
    </header>

    <section v-if="phase === 'setup'" class="setup">
      <p>Nghe Tomo đọc nghĩa, rồi kéo giỏ 🧺 hứng ngôi sao có từ đúng.</p>
      <p class="tip">Trên máy tính có thể dùng phím ← →.</p>
      <button type="button" class="primary big" data-testid="star-start" @click="start">Bắt đầu</button>
    </section>

    <template v-else-if="phase === 'playing'">
      <button
        v-if="hud.prompt"
        ref="promptButton"
        type="button"
        class="prompt"
        data-testid="star-prompt"
        @click="speaker.say(promptSegments())"
      >
        <span class="emoji" aria-hidden="true">{{ hud.prompt.emoji }}</span>
        <span v-if="settings.showVietnamese">{{ hud.prompt.meaningVi }}</span>
        <span v-else class="sr-only">Hình {{ hud.prompt.emoji }}</span>
        <span aria-hidden="true">🔊</span>
      </button>
      <div ref="playArea" class="sky" data-testid="star-sky"></div>
      <ul ref="catchList" class="catch-list sr-only" aria-live="polite" data-testid="star-falling">
        <li v-for="s in hud.stars" :key="s.id" :data-item-id="s.item.id">
          <button type="button" :data-testid="`star-catch-${s.item.id}`" :lang="deck.termLang" @click="catchStar(s)">
            Hứng {{ s.item.term }}
          </button>
        </li>
      </ul>
    </template>

    <ResultPanel v-else :stars="stars" :message="message" @again="start" @exit="$emit('exit')" />
  </div>
</template>

<style scoped>
.star {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  padding: 12px 16px;
  gap: 10px;
  max-width: 980px;
  margin: 0 auto;
}
.hud {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 1.1rem;
}
.hint {
  font: inherit;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
}
.hint:disabled {
  opacity: 0.5;
  cursor: default;
}
.setup {
  display: grid;
  gap: 14px;
  justify-items: center;
  text-align: center;
  padding: 24px 0;
}
.tip {
  color: var(--ink-soft);
}
.prompt {
  font: inherit;
  font-size: 1.4rem;
  font-weight: bold;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  border-radius: 16px;
  padding: 10px 16px;
  cursor: pointer;
}
.prompt .emoji {
  font-size: 2rem;
}
/* Nút hứng chỉ dành cho bàn phím / trình đọc màn hình: ẩn, nhưng hiện ra khi đang được Tab tới. */
.catch-list:has(:focus-visible) {
  position: static;
  width: auto;
  height: auto;
  margin: 0;
  clip: auto;
  overflow: visible;
  white-space: normal;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  list-style: none;
  padding: 0;
}
.catch-list button {
  font: inherit;
  min-height: 48px;
  padding: 0 16px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  border-radius: 999px;
  cursor: pointer;
}
.sky {
  flex: 1;
  min-height: 260px;
  border-radius: 24px;
  background: linear-gradient(#1f3b63, #3d5f8f 70%, #6b8fbf);
  overflow: hidden;
  /* Kéo giỏ trên điện thoại không cuộn trang. */
  touch-action: none;
}
</style>
