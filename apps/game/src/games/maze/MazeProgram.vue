<script setup lang="ts">
import type { Block } from '@study/content';
import { MAX_TIMES, MIN_TIMES } from './MazeGame';
import { BLOCK_INFO, pathKey, type ProgramContext } from './blocks';

// Danh sách khối của chương trình hoặc của thân một khối lặp; tự lồng chính nó cho khối lặp.
const props = defineProps<{ blocks: Block[]; prefix: number[]; ctx: ProgramContext }>();

const pathOf = (i: number) => [...props.prefix, i];
const keyOf = (i: number) => pathKey(pathOf(i));
</script>

<template>
  <ol
    class="list"
    :class="{
      root: prefix.length === 0,
      hinted: ctx.hintedList === pathKey(prefix),
      target: prefix.length > 0 && ctx.target === pathKey(prefix),
    }"
    :data-drop="prefix.length === 0 ? 'program' : `into-${pathKey(prefix)}`"
    :data-testid="prefix.length === 0 ? 'maze-program' : undefined"
    :aria-label="prefix.length === 0 ? 'Chương trình' : 'Các khối được lặp lại'"
  >
    <li
      v-for="(block, i) in blocks"
      :key="keyOf(i)"
      class="block"
      :class="[
        block.kind,
        { active: ctx.active === keyOf(i), failed: ctx.failed === keyOf(i), hinted: ctx.hinted === keyOf(i) },
      ]"
      :data-drop="`before-${keyOf(i)}`"
      :data-testid="`maze-block-${keyOf(i)}`"
    >
      <div class="row">
        <button
          type="button"
          class="grip"
          :disabled="ctx.busy"
          @pointerdown="ctx.grab($event, pathOf(i))"
          @click="ctx.keyTap($event, pathOf(i))"
        >
          <span aria-hidden="true">{{ BLOCK_INFO[block.kind].icon }}</span>
          {{ BLOCK_INFO[block.kind].name }}
        </button>
        <template v-if="block.kind === 'repeat'">
          <button
            type="button"
            class="into"
            aria-label="Thêm khối mới vào trong khối lặp lại này"
            :aria-pressed="ctx.target === keyOf(i)"
            :disabled="ctx.busy"
            :data-testid="`maze-into-${keyOf(i)}`"
            @click="ctx.aim(pathOf(i))"
          >
            ＋ Vào trong
          </button>
          <button
            type="button"
            class="step"
            aria-label="Bớt một lần"
            :disabled="ctx.busy || block.times <= MIN_TIMES"
            :data-testid="`maze-times-${keyOf(i)}-minus`"
            @click="ctx.times(pathOf(i), -1)"
          >
            −
          </button>
          <span class="times">{{ block.times }} lần</span>
          <button
            type="button"
            class="step"
            aria-label="Thêm một lần"
            :disabled="ctx.busy || block.times >= MAX_TIMES"
            :data-testid="`maze-times-${keyOf(i)}-plus`"
            @click="ctx.times(pathOf(i), 1)"
          >
            +
          </button>
        </template>
        <span class="moves">
          <button
            type="button"
            class="move"
            :aria-label="`Đưa khối ${BLOCK_INFO[block.kind].name} lên`"
            :disabled="ctx.busy || i === 0"
            :data-testid="`maze-up-${keyOf(i)}`"
            @click="ctx.nudge(pathOf(i), -1)"
          >
            ▲
          </button>
          <button
            type="button"
            class="move"
            :aria-label="`Đưa khối ${BLOCK_INFO[block.kind].name} xuống`"
            :disabled="ctx.busy || i === blocks.length - 1"
            :data-testid="`maze-down-${keyOf(i)}`"
            @click="ctx.nudge(pathOf(i), 1)"
          >
            ▼
          </button>
        </span>
        <button
          type="button"
          class="remove"
          :aria-label="`Bỏ khối ${BLOCK_INFO[block.kind].name}`"
          :disabled="ctx.busy"
          :data-testid="`maze-remove-${keyOf(i)}`"
          @click="ctx.remove(pathOf(i))"
        >
          ✕
        </button>
      </div>
      <MazeProgram v-if="block.kind === 'repeat'" :blocks="block.body" :prefix="pathOf(i)" :ctx="ctx" />
    </li>
    <li v-if="blocks.length === 0" class="drop-here">
      {{
        prefix.length === 0
          ? 'Chạm hoặc kéo khối lệnh vào đây'
          : ctx.target === pathKey(prefix)
            ? 'Chạm khối lệnh để thêm vào đây'
            : 'Kéo khối vào đây để lặp lại'
      }}
    </li>
  </ol>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 8px;
  display: grid;
  gap: 8px;
  border-radius: 14px;
  min-height: 56px;
}
.list.root {
  background: var(--sea-50);
  border: 2px dashed var(--sea-200);
  padding: 12px;
}
.list:not(.root) {
  margin-top: 8px;
  margin-left: 18px;
  border: 2px dashed var(--sun);
  background: var(--sun-soft);
}
.list.target {
  border-style: solid;
  border-color: var(--sea);
  box-shadow: 0 0 0 3px var(--sea-200);
}
.list.hinted {
  outline: 3px solid var(--sun);
  outline-offset: 2px;
}
.block {
  border-radius: 14px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  padding: 6px;
}
.block.repeat {
  border-color: var(--sun);
}
.block.active {
  border-color: var(--sea);
  background: var(--sea-50);
  box-shadow: 0 0 0 3px var(--sea-200);
}
.block.failed {
  border-color: var(--coral);
  background: #fde3df;
  animation: flash 0.5s 3;
}
.block.hinted {
  border-color: var(--coral);
  box-shadow: 0 0 0 3px var(--sun);
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.grip {
  flex: 1;
  min-height: 48px;
  min-width: 48px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  text-align: left;
  cursor: grab;
  touch-action: none;
}
.step,
.into,
.move,
.remove {
  min-width: 48px;
  min-height: 48px;
  border-radius: 12px;
  border: 2px solid var(--sea-200);
  background: var(--paper);
  font: inherit;
  font-size: 1.2rem;
  cursor: pointer;
}
.remove {
  color: var(--coral);
}
.into {
  padding: 0 10px;
  font-size: 1rem;
  font-weight: 700;
}
.into[aria-pressed='true'] {
  background: var(--sea);
  border-color: var(--sea);
  color: #fff;
}
/*
 * Nút đổi chỗ cho bàn phím / trình đọc màn hình: ẩn khỏi mắt cho gọn, chỉ hiện khi hàng của khối có tiêu điểm
 * bàn phím (:focus-visible). Chạm / bấm chuột không làm hiện, để hàng không xô lệch ngay dưới ngón tay.
 */
.moves {
  display: flex;
  gap: 6px;
}
.block:not(:has(> .row :focus-visible)) > .row > .moves {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.times {
  min-width: 3.5em;
  text-align: center;
  font-weight: 700;
}
.drop-here {
  color: var(--ink-soft);
  text-align: center;
  padding: 10px;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
@keyframes flash {
  50% {
    background: var(--paper);
  }
}
</style>
