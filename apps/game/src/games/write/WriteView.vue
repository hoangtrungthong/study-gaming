<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import {
  levelItems,
  levelNewWords,
  phrases,
  romajiPreview,
  termSegment,
  translationSegment,
  viSegment,
  type Deck,
  type Level,
  type SpeechSegment,
} from '@study/content';
import HintButton from '../../components/HintButton.vue';
import ResultPanel from '../../components/ResultPanel.vue';
import VirtualKeyboard from '../../components/VirtualKeyboard.vue';
import { speaker } from '../../audio';
import { settings } from '../../settings';
import { WRITE_CONFIG } from '../ageConfig';
import { useHint } from '../hints';
import { levelIdOf, starsByMistakes, type LevelResult } from '../result';
import { WRITE_ROUNDS, WriteGame } from './WriteGame';

const props = defineProps<{ deck: Deck; level: Level }>();
const emit = defineEmits<{ exit: []; finish: [result: LevelResult] }>();

/** Tốc độ đọc lại từ khi gõ sai (Yêu cầu 6.3). */
const SLOW_RATE = 0.8;

const config = computed(() => WRITE_CONFIG[settings.ageGroup]);
const game = shallowRef(newGame());
// Bản phản ứng của trạng thái game để giao diện cập nhật.
const view = reactive({ index: 0, solved: false, revealCount: 0, canHint: true });
const typed = ref('');
const composing = ref(false);
const flash = ref<'ok' | 'bad' | null>(null);
const finished = ref(false);
const usedHint = ref(false);
const input = ref<HTMLInputElement | null>(null);

const item = computed(() => game.value.rounds[view.index]!);
const boxes = computed(() => {
  // Đọc các trường của `view` để ô chữ vẽ lại khi sang từ mới / có gợi ý.
  void [view.index, view.revealCount, view.solved];
  return game.value.boxes(typed.value);
});
const answer = computed(() => boxes.value.map((b) => b.char).join(''));
const stars = computed(() => starsByMistakes(game.value.mistakes, game.value.rounds.length, usedHint.value));
const preview = computed(() => (props.deck.subject === 'ja' ? romajiPreview(typed.value) : ''));
const isLast = computed(() => view.index === game.value.rounds.length - 1);

function newGame() {
  const subject = props.deck.subject;
  const words = levelNewWords(subject, props.level);
  const pool = words.length > 0 ? words : levelItems(subject, props.level);
  const age = settings.ageGroup;
  return new WriteGame(subject, pool, WRITE_ROUNDS[age], WRITE_CONFIG[age].defaultLevel);
}

function sync() {
  const g = game.value;
  Object.assign(view, { index: g.index, solved: g.solved, revealCount: g.revealCount, canHint: g.canHint });
}

/** Đề của từ hiện tại: nghĩa rồi từ (speaker tự bỏ dòng nghĩa khi tắt tiếng Việt). */
const prompt = (): SpeechSegment[] => [translationSegment(item.value.meaningVi), termSegment(props.deck, item.value)];

/** Gõ xong một từ: đọc lại từ và câu ví dụ (+ bản dịch) (Yêu cầu 6.6). */
function doneSegments(): SpeechSegment[] {
  const { example, exampleVi } = item.value;
  const out = [termSegment(props.deck, item.value)];
  if (example) out.push({ lang: props.deck.termLang, text: example });
  if (exampleVi) out.push(translationSegment(exampleVi));
  return out;
}

function replay() {
  void speaker.say(prompt());
}

function showFlash(kind: 'ok' | 'bad') {
  flash.value = kind;
  setTimeout(() => (flash.value = null), 400);
}

function check() {
  // Đang soạn chữ bằng bộ gõ tiếng Nhật thì chưa chấm.
  if (composing.value) return;
  const g = game.value;
  const revealedBefore = g.revealCount;
  const result = g.check(typed.value);
  sync();
  if (result === 'ignored') return;
  if (result === 'correct') {
    showFlash('ok');
    void speaker.say([viSegment(phrases.correct), ...doneSegments()]);
    return;
  }
  showFlash('bad');
  // Sai nhiều lần thì Tomo báo đã hiện chữ đầu / cả từ để chép.
  const reveal =
    g.revealCount === revealedBefore ? [] : [viSegment(g.canHint ? phrases.writeHintFirst : phrases.writeHintAll)];
  void speaker.say([viSegment(phrases.wrong), ...reveal, termSegment(props.deck, g.item)], undefined, SLOW_RATE);
}

function next() {
  const g = game.value;
  if (g.done) return finish();
  g.next();
  typed.value = '';
  sync();
  // Focus ngay trong lần chạm để iOS bật bàn phím.
  input.value?.focus();
  replay();
}

function hint() {
  if (!game.value.canHint || !useHint()) return;
  usedHint.value = true;
  const letter = game.value.hint(typed.value);
  sync();
  // Đọc lại câu Đèn Pin cùng chữ vừa hiện trong một lượt, để lượt sau không cắt mất câu của useHint.
  // Âm thanh tạo sẵn của từng chữ là chữ thường (`termLetters`): 'C' của 'CPU' đọc bằng file 'c'.
  const tail: SpeechSegment[] = letter ? [{ lang: props.deck.termLang, text: letter.toLowerCase() }] : [];
  void speaker.say([viSegment(phrases.hint), ...tail]);
}

function press(key: string) {
  // Bàn phím ảo không có phím cách: tự thêm khoảng trắng giữa hai từ (`thank you`).
  let text = typed.value;
  while ([...answer.value][[...text].length] === ' ') text += ' ';
  typed.value = text + key;
}

function backspace() {
  typed.value = [...typed.value].slice(0, -1).join('').trimEnd();
}

function onCompositionEnd() {
  composing.value = false;
}

async function finish() {
  finished.value = true;
  const g = game.value;
  emit('finish', {
    ...levelIdOf(props.level),
    game: 'write',
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
  typed.value = '';
  sync();
  await nextTick();
  input.value?.focus();
  void speaker.say([viSegment(phrases.writeIntro), ...prompt()]);
}

onMounted(() => {
  input.value?.focus();
  void speaker.say([viSegment(phrases.writeIntro), ...prompt()]);
});
onBeforeUnmount(() => speaker.stop());
</script>

<template>
  <div class="write" :class="`age-${settings.ageGroup}`">
    <header class="bar">
      <button class="back" type="button" @click="$emit('exit')">← Đảo</button>
      <h2 tabindex="-1">Viết Lại Từ</h2>
      <span class="count">{{ view.index + 1 }}/{{ game.rounds.length }}</span>
    </header>

    <ResultPanel
      v-if="finished"
      :stars="stars"
      :message="`Bạn viết đúng ${game.rounds.length} từ, sai ${game.mistakes} lần.`"
      @again="restart"
      @exit="$emit('exit')"
    />

    <template v-else>
      <section class="card" data-testid="write-card">
        <span v-if="game.mode !== 'dictation'" class="emoji" aria-hidden="true">{{ item.emoji }}</span>
        <p class="boxes" :lang="deck.termLang" aria-hidden="true" data-testid="write-boxes">
          <span
            v-for="(b, i) in boxes"
            :key="`${view.index}-${i}-${b.state}`"
            class="box"
            :class="[b.state, { ghost: b.ghost && b.state === 'empty' }]"
            data-testid="write-box"
            >{{ b.state === 'ok' ? b.char : b.state === 'bad' ? b.typed : b.ghost ? b.char : '' }}</span
          >
        </p>
      </section>

      <section v-if="view.solved" class="done" aria-live="polite" data-testid="write-done">
        <p class="word">
          <span :lang="deck.termLang">{{ item.term }}</span>
          <span v-if="item.reading && item.reading !== item.term" class="sub" lang="ja">{{ item.reading }}</span>
        </p>
        <p v-if="item.hanViet && settings.showVietnamese" class="hanviet">Hán Việt: {{ item.hanViet }}</p>
        <template v-if="item.example">
          <p class="example" :lang="deck.termLang">{{ item.example }}</p>
          <p v-if="settings.showVietnamese" class="example-vi">{{ item.exampleVi }}</p>
        </template>
        <button class="next primary" type="button" data-testid="write-next" @click="next">
          {{ isLast ? 'Xong' : 'Tiếp →' }}
        </button>
      </section>

      <div v-else class="tools">
        <button class="replay" type="button" aria-label="Nghe lại" data-testid="write-replay" @click="replay">
          🔁
        </button>
        <HintButton data-testid="write-hint" :disabled="!view.canHint" @use="hint" />
      </div>

      <form class="typing" :class="flash" @submit.prevent="check">
        <label class="sr-only" for="write-input">Gõ từ</label>
        <input
          id="write-input"
          ref="input"
          v-model="typed"
          data-testid="write-input"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          :lang="deck.termLang"
          :readonly="config.virtualKeyboard || view.solved"
          :inputmode="config.virtualKeyboard ? 'none' : undefined"
          placeholder="Gõ từ vừa nghe…"
          @compositionstart="composing = true"
          @compositionend="onCompositionEnd"
        />
        <span v-if="preview && preview !== typed" class="preview" lang="ja" aria-hidden="true">{{ preview }}</span>
        <button type="submit" class="primary" data-testid="write-check">Kiểm tra</button>
      </form>

      <VirtualKeyboard
        v-if="config.virtualKeyboard && !view.solved"
        :key="view.index"
        :answer="answer"
        :lang="deck.termLang"
        @press="press"
        @backspace="backspace"
      />
    </template>
  </div>
</template>

<style scoped>
.write {
  display: grid;
  gap: 14px;
  padding: 12px 16px 24px;
  max-width: 880px;
  margin: 0 auto;
}
.card,
.done {
  display: grid;
  justify-items: center;
  gap: 8px;
  text-align: center;
  background: var(--paper);
  border-radius: 24px;
  padding: 16px;
}
.emoji {
  font-size: 4rem;
}
.boxes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin: 0;
}
.box {
  display: inline-grid;
  place-items: center;
  min-width: 48px;
  min-height: 56px;
  font-size: 1.8rem;
  font-weight: 700;
  border-radius: 12px;
  border: 3px solid var(--sea-200);
  background: white;
}
.box.ghost {
  color: var(--ink-soft);
  opacity: 0.35;
}
.box.ok {
  border-color: var(--leaf);
  background: var(--leaf-soft);
}
.box.bad {
  border-color: var(--coral);
  color: var(--coral);
  animation: shake 0.35s;
}
.box.space {
  min-width: 20px;
  border: none;
  background: none;
}
.age-mam .box {
  min-width: 60px;
  min-height: 68px;
  font-size: 2.2rem;
}
.word {
  display: grid;
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}
.sub {
  color: var(--ink-soft);
  font-size: 1.1rem;
  font-weight: 400;
}
.hanviet,
.example,
.example-vi {
  margin: 0;
}
.hanviet {
  font-weight: 600;
}
.example {
  font-size: 1.2rem;
}
.example-vi {
  color: var(--ink-soft);
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
  font-size: 2rem;
  min-width: 88px;
  min-height: 72px;
  border-color: var(--sea);
  background: var(--sea-50);
}
.hint:disabled {
  opacity: 0.5;
  cursor: default;
}
.next {
  background: var(--sea);
  color: white;
  border-color: var(--sea);
  font-weight: 700;
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
  font-size: 1.4rem;
  padding: 12px 16px;
  min-height: 56px;
  border-radius: 16px;
  border: 3px solid var(--sea-200);
  min-width: 0;
}
.typing input:focus {
  outline: none;
  border-color: var(--sea);
}
.typing button {
  min-height: 56px;
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
  right: 130px;
  color: var(--ink-soft);
  font-size: 1.2rem;
  pointer-events: none;
}
.age-mam .typing input {
  font-size: 1.8rem;
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
