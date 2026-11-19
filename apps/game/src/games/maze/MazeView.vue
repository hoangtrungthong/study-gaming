<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import {
  countBlocks,
  levelMaze,
  phrases,
  viSegment,
  type Block,
  type BlockKind,
  type Deck,
  type Dir,
  type Level,
  type MazeRun,
} from '@study/content';
import HintButton from '../../components/HintButton.vue';
import ResultPanel from '../../components/ResultPanel.vue';
import { speaker } from '../../audio';
import { settings } from '../../settings';
import { MAZE_CONFIG } from '../ageConfig';
import { useDrag } from '../drag';
import { useHint } from '../hints';
import { levelIdOf, type LevelResult } from '../result';
import { MazeGame, type EditResult, type MazeHint } from './MazeGame';
import MazeProgram from './MazeProgram.vue';
import { BLOCK_INFO, parsePath, pathKey, type ProgramContext } from './blocks';

const props = defineProps<{ deck: Deck; level: Level }>();
const emit = defineEmits<{ exit: []; finish: [result: LevelResult] }>();

const maze = levelMaze(props.level);
const game = shallowRef(maze ? newGame() : null);
const program = ref<Block[]>([]);
const bit = reactive({ x: 0, y: 0, dir: 0 as Dir });
const running = ref(false);
const finished = ref(false);
const hintedKind = ref<BlockKind | null>(null);
/** Câu báo cho trình đọc màn hình (vùng aria-live): chỗ thêm khối, khối vừa đổi chỗ. */
const status = ref('');
/** Khối lặp đang là chỗ thêm khối mới; giữ chính đối tượng khối để đổi chỗ / xoá vẫn theo đúng khối. */
let targetBlock: Block | null = null;
const root = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
/** Lần chạy đang phát hoạt ảnh; Về chỗ cũ giữa chừng thì vẫn ghi lại (game.abort). */
let playing: MazeRun | null = null;

function newGame() {
  return new MazeGame(maze!, MAZE_CONFIG[settings.ageGroup].nestedRepeat);
}

const rows = computed(() => maze?.grid.map((row) => [...row]) ?? []);
const blockCount = computed(() => countBlocks(program.value));
// Đọc `program` để tính lại mỗi khi chương trình đổi (game không phản ứng).
const canHint = computed(() => program.value !== null && game.value?.nextHint() !== null);

function cellLabel(cell: string, x: number, y: number) {
  const what = cell === '#' ? 'tường' : cell === 'H' ? 'nhà của Bit' : 'đường đi';
  return `Hàng ${y + 1}, cột ${x + 1}: ${what}`;
}

const ctx: ProgramContext = reactive({
  active: null,
  failed: null,
  hinted: null,
  hintedList: null,
  target: '',
  busy: false,
  aim,
  nudge,
  grab,
  keyTap,
  remove,
  times,
});

function clearMarks() {
  Object.assign(ctx, { active: null, failed: null, hinted: null, hintedList: null });
  hintedKind.value = null;
}

/** Chép chương trình ra bản phản ứng để giao diện vẽ lại; khối lặp làm chỗ thêm đã bị bỏ thì về chương trình gốc. */
function sync() {
  program.value = structuredClone(game.value!.program);
  const path = targetBlock && game.value!.pathOf(targetBlock);
  if (!path) targetBlock = null;
  ctx.target = path ? pathKey(path) : '';
}

/** Nút "Thêm vào cuối chương trình" tự ẩn khi bấm: đưa tiêu điểm về nút Vào trong của khối lặp vừa bỏ chọn. */
async function aimProgram() {
  const key = ctx.target;
  aim(targetPath());
  await nextTick();
  const into = root.value!.querySelector<HTMLButtonElement>(`[data-testid="maze-into-${key}"]`);
  (into ?? root.value!.querySelector<HTMLButtonElement>('.palette .tile'))?.focus();
}

/** Chọn khối lặp làm chỗ thêm khối mới; chọn lại chính nó thì về cuối chương trình. */
function aim(path: number[]) {
  const block = game.value!.blockAt(path);
  if (ctx.busy || block?.kind !== 'repeat') return;
  targetBlock = ctx.target === pathKey(path) ? null : block;
  sync();
  const text = targetBlock ? phrases.mazeTargetRepeat : phrases.mazeTargetProgram;
  status.value = text;
  say(text);
}

/** Đổi chỗ bằng nút ▲ / ▼, rồi đưa tiêu điểm theo khối tới chỗ mới. */
async function nudge(path: number[], delta: -1 | 1) {
  if (ctx.busy || !game.value!.shift(path, delta)) return;
  clearMarks();
  sync();
  const to = [...path.slice(0, -1), path.at(-1)! + delta];
  const name = BLOCK_INFO[game.value!.blockAt(to)!.kind].name;
  status.value = `Khối ${name} ở vị trí ${to.at(-1)! + 1}`;
  say(name);
  await nextTick();
  const key = pathKey(to);
  const button = root.value!.querySelector<HTMLButtonElement>(
    `[data-testid="maze-${delta < 0 ? 'up' : 'down'}-${key}"]`,
  )!;
  // Tới đầu / cuối danh sách thì nút cùng chiều tắt: đưa tiêu điểm sang nút còn lại.
  const other = root.value!.querySelector<HTMLButtonElement>(
    `[data-testid="maze-${delta < 0 ? 'down' : 'up'}-${key}"]`,
  )!;
  (button.disabled ? other : button).focus();
}

function placeBit() {
  Object.assign(bit, { x: game.value!.map.start.x, y: game.value!.map.start.y, dir: game.value!.map.start.dir });
}

const say = (text: string) => void speaker.say([viSegment(text)]);

function afterEdit(result: EditResult, kind: BlockKind) {
  if (result === 'tooMany') return say(phrases.mazeTooMany);
  if (result === 'nested') return say(phrases.mazeNoNested);
  if (result !== 'ok') return;
  clearMarks();
  sync();
  say(BLOCK_INFO[kind].name);
}

/** Chỗ thêm khối khi chạm / bấm phím vào khay: khối lặp đang chọn hoặc cuối chương trình. */
const targetPath = () => parsePath(ctx.target);

function addBlock(kind: BlockKind, into: number[] = [], index?: number) {
  if (ctx.busy) return;
  afterEdit(game.value!.add(kind, into, index), kind);
}

type DragPayload = { kind: BlockKind } | { from: number[] };

/** Chỗ thả: `program` cuối chương trình, `into-<đường dẫn>` cuối thân khối lặp, `before-<đường dẫn>` trước một khối. */
function dropTarget(target: string): { into: number[]; index?: number } {
  if (target.startsWith('into-')) return { into: parsePath(target.slice('into-'.length)) };
  if (target.startsWith('before-')) {
    const path = parsePath(target.slice('before-'.length));
    return { into: path.slice(0, -1), index: path.at(-1) };
  }
  return { into: [] };
}

const { dragging, start } = useDrag<DragPayload>({
  onDrop(payload, target) {
    const { into, index } = dropTarget(target);
    if ('kind' in payload) return addBlock(payload.kind, into, index);
    if (ctx.busy) return;
    const kind = game.value!.blockAt(payload.from)!.kind;
    afterEdit(game.value!.move(payload.from, into, index), kind);
  },
  onTap(payload) {
    if ('kind' in payload) addBlock(payload.kind, targetPath());
    else say(BLOCK_INFO[game.value!.blockAt(payload.from)!.kind].name);
  },
});

function dragLabel(payload: DragPayload) {
  const kind = 'kind' in payload ? payload.kind : game.value!.blockAt(payload.from)!.kind;
  return `${BLOCK_INFO[kind].icon} ${BLOCK_INFO[kind].name}`;
}

function grab(event: PointerEvent, path: number[]) {
  if (!ctx.busy) start(event, { from: path });
}

// Chạm bằng ngón tay / chuột đã do useDrag (onTap) xử lý; `click` chỉ còn cho bàn phím (detail = 0).
function keyTap(event: MouseEvent, path: number[]) {
  if (event.detail === 0) say(BLOCK_INFO[game.value!.blockAt(path)!.kind].name);
}

function onPaletteDown(event: PointerEvent, kind: BlockKind) {
  if (!ctx.busy) start(event, { kind });
}

function onPaletteClick(event: MouseEvent, kind: BlockKind) {
  if (event.detail === 0) addBlock(kind, targetPath());
}

function remove(path: number[]) {
  if (ctx.busy || !game.value!.remove(path)) return;
  clearMarks();
  sync();
}

function times(path: number[], delta: number) {
  const block = game.value!.blockAt(path);
  if (ctx.busy || block?.kind !== 'repeat') return;
  game.value!.setTimes(path, block.times + delta);
  sync();
}

function stopAnimation() {
  clearTimeout(timer);
  timer = undefined;
  running.value = false;
  ctx.busy = false;
}

function run() {
  if (ctx.busy || program.value.length === 0) return;
  clearMarks();
  placeBit();
  // Chỉ lấy các bước; lần chạy được ghi (và thắng được chốt) khi hoạt ảnh tới cuối. Về chỗ cũ giữa chừng thì ghi
  // bằng game.abort: vẫn tính lần chạy (và lần sai) nhưng không thắng.
  const result = game.value!.trace();
  playing = result;
  running.value = true;
  ctx.busy = true;
  play(result, 0);
}

/** Phát lại từng bước theo nhịp của nhóm tuổi, đọc tên khối đang chạy. */
function play(result: MazeRun, i: number) {
  timer = setTimeout(() => {
    const step = result.steps[i];
    if (!step) return void end(result);
    Object.assign(bit, { x: step.x, y: step.y, dir: step.dir });
    ctx.active = pathKey(step.path);
    say(BLOCK_INFO[game.value!.blockAt(step.path)!.kind].name);
    play(result, i + 1);
  }, MAZE_CONFIG[settings.ageGroup].stepMs);
}

async function end(result: MazeRun) {
  stopAnimation();
  playing = null;
  ctx.active = null;
  game.value!.record(result);
  if (result.outcome === 'wall') {
    ctx.failed = pathKey(result.failedAt!);
    return say(phrases.mazeWall);
  }
  if (result.outcome !== 'home') return say(phrases.mazeNotHome);
  finished.value = true;
  const g = game.value!;
  const id = props.level.maze!;
  emit('finish', {
    ...levelIdOf(props.level),
    game: 'maze',
    stars: g.stars,
    firstTry: g.mistakes === 0 ? [id] : [],
    wrong: g.mistakes > 0 ? [id] : [],
    usedHint: g.usedHint,
  });
  // Chờ khung kết quả gắn xong rồi mới khen.
  await nextTick();
  say(phrases.mazeHome);
}

/** Về chỗ cũ: Bit về ô xuất phát, chương trình giữ nguyên. Đang chạy thì lần chạy dở vẫn được tính. */
function reset() {
  if (playing) game.value!.abort(playing);
  playing = null;
  stopAnimation();
  clearMarks();
  placeBit();
}

function hint() {
  if (ctx.busy || !canHint.value || !useHint()) return;
  const h = game.value!.hint()!;
  clearMarks();
  const key = pathKey(h.path);
  // Khối sai / thừa ở chỗ đó thì tô khối; còn thiếu thì tô danh sách cần thêm khối.
  if (game.value!.blockAt(h.path)) ctx.hinted = key;
  else ctx.hintedList = pathKey(h.path.slice(0, -1));
  hintedKind.value = h.block?.kind ?? null;
  // Báo cả bằng lời và vùng aria-live, không chỉ tô màu.
  const { text, speech } = hintMessage(h);
  status.value = text;
  // Đọc lại câu Đèn Pin trong cùng lượt để không cắt mất câu của useHint.
  void speaker.say([viSegment(phrases.hint), ...speech.map(viSegment)]);
}

/** Câu gợi ý cho vùng aria-live (có vị trí, số lần) và các câu cố định để đọc. */
function hintMessage(h: MazeHint): { text: string; speech: string[] } {
  const current = game.value!.blockAt(h.path);
  const nested = h.path.length > 1 ? ' trong khối lặp lại' : '';
  const at = `ở vị trí ${h.path.at(-1)! + 1}${nested}`;
  if (!h.block) {
    const name = BLOCK_INFO[current!.kind].name;
    return { text: `Gợi ý: bỏ khối ${name} ${at}.`, speech: [phrases.mazeHintRemove] };
  }
  const name = BLOCK_INFO[h.block.kind].name;
  const label = h.block.kind === 'repeat' ? `${name} ${h.block.times} lần` : name;
  if (current) {
    return { text: `Gợi ý: đổi khối ${at} thành ${label}.`, speech: [phrases.mazeHintChange, name] };
  }
  const where = nested ? 'vào trong khối lặp lại' : 'vào cuối chương trình';
  return { text: `Gợi ý: khối tiếp theo là ${label}, thêm ${where}.`, speech: [phrases.mazeHintNext, name] };
}

async function restart() {
  game.value = newGame();
  status.value = '';
  finished.value = false;
  clearMarks();
  sync();
  placeBit();
  await nextTick();
  intro();
}

function intro() {
  void speaker.say([viSegment(phrases.mazeIntro), viSegment(maze!.hintVi)]);
}

if (game.value) placeBit();
onMounted(() => {
  if (maze) intro();
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  speaker.stop();
});
</script>

<template>
  <div ref="root" class="maze" :class="`age-${settings.ageGroup}`">
    <header class="bar">
      <button class="back" type="button" @click="$emit('exit')">← Đảo</button>
      <h2 tabindex="-1">Đưa Bit Về Nhà</h2>
      <span class="count">{{ blockCount }}/{{ maze?.maxBlocks ?? 0 }} khối</span>
    </header>

    <p v-if="!maze || !game" class="empty" data-testid="maze-empty">Màn này chưa có mê cung. Bạn quay lại đảo nhé!</p>

    <ResultPanel
      v-else-if="finished"
      :stars="game.stars"
      :message="`Bit về nhà sau ${game.attempts} lần chạy, dùng ${game.winBlocks} khối.`"
      @again="restart"
      @exit="$emit('exit')"
    />

    <div v-else class="board">
      <p class="hint-vi">{{ maze.hintVi }}</p>

      <div
        class="grid"
        role="group"
        aria-label="Mê cung"
        :style="{ gridTemplateColumns: `repeat(${game.map.width}, minmax(48px, 64px))` }"
      >
        <template v-for="(row, y) in rows" :key="y">
          <div
            v-for="(cell, x) in row"
            :key="`${x},${y}`"
            class="cell"
            :class="{ wall: cell === '#', home: cell === 'H' }"
            role="img"
            :aria-label="cellLabel(cell, x, y)"
            :style="{ gridColumn: x + 1, gridRow: y + 1 }"
          >
            <span v-if="cell === 'H'" aria-hidden="true">🏠</span>
          </div>
        </template>
        <div
          class="bit"
          role="img"
          :aria-label="`Bit ở hàng ${bit.y + 1}, cột ${bit.x + 1}`"
          data-testid="maze-bit"
          :data-x="bit.x"
          :data-y="bit.y"
          :data-dir="bit.dir"
          :style="{
            gridColumn: bit.x + 1,
            gridRow: bit.y + 1,
            transitionDuration: `${MAZE_CONFIG[settings.ageGroup].stepMs}ms`,
          }"
        >
          <span class="face" aria-hidden="true">🐱</span>
          <span class="arrow" aria-hidden="true" :style="{ transform: `rotate(${bit.dir * 90}deg)` }">▲</span>
        </div>
      </div>

      <div class="palette" aria-label="Khay khối lệnh">
        <button
          v-for="kind in maze.blocks"
          :key="kind"
          type="button"
          class="tile"
          :class="{ hinted: hintedKind === kind }"
          :disabled="ctx.busy"
          :data-testid="`maze-palette-${kind}`"
          @pointerdown="onPaletteDown($event, kind)"
          @click="onPaletteClick($event, kind)"
        >
          <span class="icon" aria-hidden="true">{{ BLOCK_INFO[kind].icon }}</span>
          {{ BLOCK_INFO[kind].name }}
        </button>
      </div>

      <p class="sr-only" role="status" aria-live="polite" data-testid="maze-status">{{ status }}</p>
      <button
        v-if="ctx.target !== ''"
        type="button"
        class="to-program"
        data-testid="maze-target-program"
        aria-label="Thêm khối mới vào cuối chương trình"
        :disabled="ctx.busy"
        @click="aimProgram"
      >
        ↩ Thêm vào cuối chương trình
      </button>

      <MazeProgram :blocks="program" :prefix="[]" :ctx="ctx" />

      <div class="actions">
        <HintButton data-testid="maze-hint" :disabled="ctx.busy || !canHint" @use="hint" />
        <button type="button" data-testid="maze-reset" @click="reset">↺ Về chỗ cũ</button>
        <button
          type="button"
          class="primary"
          data-testid="maze-run"
          :disabled="ctx.busy || program.length === 0"
          @click="run"
        >
          ▶ Chạy
        </button>
      </div>
    </div>

    <div
      v-if="dragging"
      class="tile floating"
      aria-hidden="true"
      :style="{ left: `${dragging.x}px`, top: `${dragging.y}px` }"
    >
      {{ dragLabel(dragging.payload) }}
    </div>
  </div>
</template>

<style scoped>
.maze {
  display: grid;
  gap: 14px;
  padding: 12px 16px 24px;
  max-width: 880px;
  margin: 0 auto;
}
.board {
  display: grid;
  gap: 16px;
}
.hint-vi,
.empty {
  margin: 0;
  text-align: center;
  color: var(--ink-soft);
  font-size: 1.1rem;
}
.grid {
  display: grid;
  justify-content: center;
  gap: 4px;
}
.cell {
  aspect-ratio: 1;
  border-radius: 10px;
  background: var(--sand);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
}
.cell.wall {
  background: var(--ink-soft);
}
.cell.home {
  background: var(--leaf-soft);
}
.bit {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  pointer-events: none;
}
.arrow {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  font-size: 0.8rem;
  color: var(--sea);
  transition: transform 0.2s ease;
}
.palette,
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
.tile {
  min-height: 56px;
  min-width: 48px;
  padding: 0 16px;
  border-radius: 16px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  font: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: grab;
  touch-action: none;
  box-shadow: 0 4px 0 var(--sea-200);
}
.tile.hinted {
  border-color: var(--sun);
  box-shadow: 0 0 0 4px var(--sun);
  animation: pulse 0.8s 3;
}
.icon {
  font-size: 1.5rem;
}
.floating {
  position: fixed;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 10;
}
.to-program {
  justify-self: center;
  min-height: 48px;
  padding: 0 16px;
  border-radius: 999px;
  border: 2px solid var(--sea);
  background: var(--paper);
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
}
.actions button {
  min-height: 52px;
  padding: 0 18px;
  border-radius: 999px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  font: inherit;
  font-size: 1.1rem;
  cursor: pointer;
}
.actions .primary {
  background: var(--sea);
  border-color: var(--sea);
  color: #fff;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.age-mam .tile {
  min-height: 64px;
  font-size: 1.3rem;
}
@keyframes pulse {
  50% {
    transform: scale(1.06);
  }
}
</style>
