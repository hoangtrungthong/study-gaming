<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import {
  phrases,
  romajiPreview,
  termSegment,
  translationSegment,
  viSegment,
  type Deck,
  type SpeechSegment,
} from '@study/content';
import ResultPanel from '../../components/ResultPanel.vue';
import { speaker } from '../../audio';
import { settings } from '../../settings';
import { RAIN_CONFIG } from '../ageConfig';
import { RainGame, type Drop, type RainEvent } from './RainGame';
import { promptLabel, type PromptMode } from './labels';

const props = defineProps<{ deck: Deck }>();
defineEmits<{ exit: [] }>();

type Phase = 'setup' | 'playing' | 'over';
const phase = ref<Phase>('setup');
const mode = ref<PromptMode>(settings.ageGroup === 'mam' ? 'meaning' : 'term');
const typed = ref('');
const flash = ref<'ok' | 'bad' | null>(null);
const composing = ref(false);
const playArea = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);

const game = shallowRef<RainGame | null>(null);
// Bản sao phản ứng để vẽ HUD và danh sách đọc màn hình.
const hud = ref({ score: 0, lives: 0, timeLeft: 0, drops: [] as Drop[] });

let stopScene: (() => void) | null = null;
let sceneApi: { burst(id: number, kind: 'hit' | 'miss'): void } | null = null;
let hudTimer: number | undefined;
let unmounted = false;

/** Từ bị lỡ, mỗi từ một lần (một từ có thể rơi nhiều lần trong một trận). */
const missedOnce = computed(() => [...new Map((game.value?.missed ?? []).map((i) => [i.id, i])).values()]);
const placeholder = computed(() =>
  phase.value === 'playing'
    ? 'Gõ từ trên hạt mưa…'
    : phase.value === 'setup'
      ? 'Gõ ở đây khi mưa bắt đầu'
      : 'Bấm Chơi lại để chơi tiếp',
);
const preview = computed(() => (props.deck.subject === 'ja' ? romajiPreview(typed.value) : ''));
const fontScale = computed(() => (settings.ageGroup === 'mam' ? 1.3 : 1));
const result = computed(() => {
  const g = game.value;
  if (!g) return { stars: 0, message: '' };
  const total = g.hits.length + g.missed.length;
  const ratio = total === 0 ? 0 : g.hits.length / total;
  return {
    stars: ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1,
    message: `Bạn phá được ${g.hits.length} hạt mưa, lỡ ${g.missed.length} hạt.`,
  };
});

function refreshHud() {
  const g = game.value;
  if (!g) return;
  hud.value = { score: g.score, lives: g.lives, timeLeft: Math.ceil(g.timeLeft), drops: [...g.drops] };
}

/**
 * Chế độ "Chỉ nghe": hạt mưa nào cũng là 🔊, nên mỗi lần đọc gì (khen, nhắc) đều đọc nối lại
 * các từ đang rơi (hạt thấp nhất trước). Không thì câu mới cắt mất câu đọc từ và người chơi không biết gõ gì.
 */
function withPrompts(segments: SpeechSegment[]): SpeechSegment[] {
  if (mode.value !== 'audio' || !game.value) return segments;
  const falling = [...game.value.drops].sort((a, b) => b.y - a.y);
  return [...segments, ...falling.map((d) => termSegment(props.deck, d.item))];
}

/** Lời khen chờ đọc ở khung hình kế tiếp, để gộp với hạt mưa mới sinh ra ngay sau đó. */
let pendingFeedback: SpeechSegment[] = [];

/**
 * Gọi mỗi khung hình. Mọi câu cần đọc trong một khung (khen, nhắc hạt rơi, hạt mới ở chế độ nghe) gộp thành
 * một lượt đọc, dựng từ các hạt đang rơi SAU khi xử lý hết sự kiện. Đọc riêng từng câu thì câu sau cắt câu trước.
 */
function handleEvents(events: RainEvent[]) {
  const feedback = pendingFeedback;
  pendingFeedback = [];
  let speak = feedback.length > 0;
  for (const e of events) {
    if (e.type === 'over') {
      void finish();
      return;
    }
    if (e.type === 'miss') {
      feedback.push(viSegment(phrases.missed));
      speak = true;
    }
    if (e.type === 'spawn' && mode.value === 'audio') speak = true;
  }
  if (speak) void speaker.say(withPrompts(feedback));
  if (events.length > 0) refreshHud();
}

async function start() {
  // Gọi focus ngay trong lần chạm (trước mọi await): iOS chỉ bật bàn phím khi focus nằm trong cử chỉ người dùng.
  input.value?.focus();
  speaker.stop();
  phase.value = 'playing';
  typed.value = '';
  game.value = new RainGame(props.deck.subject, props.deck.items, RAIN_CONFIG[settings.ageGroup]);
  refreshHud();
  await nextTick();
  const { startRainScene } = await import('./RainScene');
  const g = game.value;
  // Người chơi có thể đã thoát trong lúc cảnh Phaser đang tải.
  if (unmounted || phase.value !== 'playing' || !playArea.value) return;
  const handle = startRainScene(playArea.value, {
    game: g,
    paused: () => false,
    fontScale: fontScale.value,
    label: (drop) => promptLabel(drop.item, mode.value),
    onEvents: handleEvents,
    onDropTap: (drop) => void speaker.say([termSegment(props.deck, drop.item)]),
  });
  sceneApi = handle.scene;
  stopScene = handle.destroy;
  hudTimer = window.setInterval(refreshHud, 250);
  input.value?.focus();
}

async function finish() {
  phase.value = 'over';
  stopScene?.();
  stopScene = null;
  window.clearInterval(hudTimer);
  const recap = missedOnce.value.flatMap((item) => [termSegment(props.deck, item), translationSegment(item.meaningVi)]);
  await speaker.say([viSegment(phrases.rainOver), ...recap]);
}

function check() {
  const g = game.value;
  if (!g || composing.value || typed.value.trim() === '') return;
  const hit = g.submit(typed.value);
  if (!hit) return;
  sceneApi?.burst(hit.id, 'hit');
  typed.value = '';
  flash.value = 'ok';
  setTimeout(() => (flash.value = null), 300);
  // Đọc ở khung hình kế tiếp (handleEvents), cùng lượt với hạt mới sinh ra vào chỗ trống vừa có.
  pendingFeedback = [termSegment(props.deck, hit.item), translationSegment(hit.item.meaningVi)];
  refreshHud();
}

function onEnter() {
  check();
  if (typed.value !== '') {
    flash.value = 'bad';
    setTimeout(() => (flash.value = null), 400);
  }
}

function onCompositionEnd() {
  composing.value = false;
  check();
}

onMounted(() => void speaker.say([viSegment(phrases.rainIntro)]));
onBeforeUnmount(() => {
  unmounted = true;
  stopScene?.();
  window.clearInterval(hudTimer);
  speaker.stop();
});
</script>

<template>
  <div class="rain">
    <header class="bar">
      <button class="back" type="button" @click="$emit('exit')">← Đảo</button>
      <h2 tabindex="-1">Mưa Chữ</h2>
      <span v-if="phase === 'playing'" class="hud" data-testid="rain-hud">
        <span aria-label="Điểm"
          >⭐ <b data-testid="rain-score">{{ hud.score }}</b></span
        >
        <span aria-label="Chậu hoa còn lại">🌼 {{ hud.lives }}</span>
        <span v-if="settings.ageGroup !== 'mam'" aria-label="Thời gian còn lại">⏱ {{ hud.timeLeft }}s</span>
      </span>
    </header>

    <section v-if="phase === 'setup'" class="setup">
      <p>Hạt mưa sẽ hiện:</p>
      <div class="modes" role="radiogroup" aria-label="Chế độ">
        <label :class="{ on: mode === 'term' }"
          ><input v-model="mode" type="radio" name="rain-mode" value="term" /> Từ gốc</label
        >
        <label :class="{ on: mode === 'meaning' }"
          ><input v-model="mode" type="radio" name="rain-mode" value="meaning" /> Nghĩa tiếng Việt</label
        >
        <label :class="{ on: mode === 'audio' }"
          ><input v-model="mode" type="radio" name="rain-mode" value="audio" /> Chỉ nghe 🔊</label
        >
      </div>
      <p v-if="deck.subject === 'ja'" class="hint">
        Gõ bằng bàn phím tiếng Nhật hoặc gõ romaji (ví dụ <code>neko</code> → ねこ).
      </p>
      <button type="button" class="primary big" data-testid="rain-start" @click="start">Bắt đầu</button>
    </section>

    <template v-else-if="phase === 'playing'">
      <div ref="playArea" class="sky" data-testid="rain-sky"></div>
      <ul class="sr-only" aria-live="polite" data-testid="rain-drops">
        <li v-for="d in hud.drops" :key="d.id" :data-item-id="d.item.id">{{ promptLabel(d.item, mode).main }}</li>
      </ul>
    </template>

    <ResultPanel v-else :stars="result.stars" :message="result.message" @again="start" @exit="$emit('exit')">
      <ul v-if="missedOnce.length" class="missed">
        <li v-for="item in missedOnce" :key="item.id">
          <button type="button" @click="speaker.say([termSegment(deck, item), translationSegment(item.meaningVi)])">
            🔊 <b :lang="deck.termLang">{{ item.term }}</b> — {{ item.meaningVi }}
          </button>
        </li>
      </ul>
    </ResultPanel>

    <!-- Ô gõ luôn có sẵn ở mọi bước, để nút Bắt đầu / Chơi lại focus được ngay (iOS). -->
    <form class="typing" :class="flash" @submit.prevent="onEnter">
      <label class="sr-only" for="rain-input">Gõ từ</label>
      <input
        id="rain-input"
        ref="input"
        v-model="typed"
        data-testid="rain-input"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="done"
        :lang="deck.termLang"
        :placeholder="placeholder"
        @input="check"
        @compositionstart="composing = true"
        @compositionend="onCompositionEnd"
      />
      <span v-if="preview && preview !== typed" class="preview" lang="ja" aria-hidden="true">{{ preview }}</span>
      <button type="submit" class="primary">OK</button>
    </form>
  </div>
</template>

<style scoped>
.rain {
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
  gap: 14px;
  font-size: 1.1rem;
}
.setup {
  display: grid;
  gap: 14px;
  justify-items: center;
  text-align: center;
  padding: 24px 0;
}
.modes {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.modes label {
  border: 2px solid var(--sea-200);
  border-radius: 999px;
  padding: 10px 16px;
  cursor: pointer;
  background: var(--paper);
}
.modes label.on {
  border-color: var(--sea);
  background: var(--sea-50);
}
.modes input {
  accent-color: var(--sea);
}
.hint {
  color: var(--ink-soft);
}
.sky {
  flex: 1;
  min-height: 220px;
  border-radius: 24px;
  /* Dải cỏ ở đáy vẽ bằng gradient để ăn theo góc bo. */
  background: linear-gradient(#cfe7f3, #eef7fb 70%, #e6f2df calc(100% - 12px), var(--leaf) calc(100% - 12px));
  overflow: hidden;
}
.typing {
  display: flex;
  gap: 10px;
  align-items: center;
  position: relative;
}
.typing input {
  flex: 1;
  font: inherit;
  font-size: 1.3rem;
  padding: 12px 16px;
  border-radius: 16px;
  border: 3px solid var(--sea-200);
  min-width: 0;
}
.typing input:focus {
  outline: none;
  border-color: var(--sea);
}
.typing.ok input {
  border-color: var(--leaf);
}
.typing.bad input {
  border-color: var(--coral);
  animation: shake 0.35s;
}
.preview {
  position: absolute;
  right: 88px;
  color: var(--ink-soft);
  font-size: 1.2rem;
  pointer-events: none;
}
.missed {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}
.missed button {
  font: inherit;
  width: 100%;
  text-align: left;
  border: 1px solid var(--sea-200);
  background: white;
  border-radius: 12px;
  padding: 8px 12px;
  cursor: pointer;
}
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  30% {
    transform: translateX(-5px);
  }
  70% {
    transform: translateX(5px);
  }
}
</style>
