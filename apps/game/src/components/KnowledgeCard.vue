<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { cardSegments, type Deck, type LearnItem, type SpeechSegment } from '@study/content';
import { toRomaji } from 'wanakana';
import { speaker } from '../audio';
import { settings } from '../settings';

/** `tail`: câu đọc thêm sau thẻ, ví dụ lời khen khi xong màn. */
const props = defineProps<{ deck: Deck; item: LearnItem; tail?: SpeechSegment[] }>();

/** Chỉ số đoạn đang đọc trong cardSegments, để tô sáng phụ đề. */
const speaking = ref(-1);
const segments = computed(() => cardSegments(props.deck, props.item));

const romaji = computed(() => (props.deck.subject === 'ja' ? toRomaji(props.item.reading ?? props.item.term) : ''));

function indexOf(text: string | undefined): number {
  return text ? segments.value.findIndex((s) => s.text === text || s.text.endsWith(text.toLocaleLowerCase('vi'))) : -1;
}

let playId = 0;
function play() {
  // Bỏ qua báo hiệu của lượt đọc cũ (bị lượt mới huỷ), để không xoá tô sáng của lượt mới.
  const id = ++playId;
  void speaker.say([...segments.value, ...(props.tail ?? [])], (i) => {
    if (id === playId) speaking.value = i;
  });
}

onMounted(() => {
  if (settings.autoRead) play();
});
watch(
  () => props.item.id,
  () => settings.autoRead && play(),
);
onBeforeUnmount(() => speaker.stop());

const lit = (text: string | undefined) => speaking.value >= 0 && speaking.value === indexOf(text);
</script>

<template>
  <section class="card" data-testid="knowledge-card" aria-live="polite">
    <div class="term-row">
      <span class="emoji" aria-hidden="true">{{ item.emoji }}</span>
      <div>
        <p class="term" :class="{ lit: speaking === 0 }" :lang="deck.termLang">{{ item.term }}</p>
        <p v-if="item.reading || romaji" class="reading">
          <span v-if="item.reading" lang="ja">{{ item.reading }}</span>
          <span v-if="romaji"> · {{ romaji }}</span>
        </p>
      </div>
      <button class="replay" type="button" aria-label="Nghe lại" @click="play">🔁</button>
    </div>

    <template v-if="settings.showVietnamese">
      <p class="meaning" :class="{ lit: speaking === 1 }">{{ item.meaningVi }}</p>
      <p v-if="item.hanViet" class="hanviet" :class="{ lit: lit(item.hanViet) }">Hán Việt: {{ item.hanViet }}</p>
    </template>

    <div v-if="item.example" class="example">
      <p :class="{ lit: lit(item.example) }" :lang="deck.termLang">{{ item.example }}</p>
      <p v-if="settings.showVietnamese" class="vi" :class="{ lit: lit(item.exampleVi) }">{{ item.exampleVi }}</p>
    </div>

    <p v-if="item.explainVi && settings.showVietnamese" class="explain" :class="{ lit: lit(item.explainVi) }">
      💡 {{ item.explainVi }}
    </p>
  </section>
</template>

<style scoped>
.card {
  background: var(--paper);
  border: 2px solid var(--sea-200);
  border-radius: 20px;
  padding: 16px 18px;
  display: grid;
  gap: 8px;
  box-shadow: 0 6px 0 var(--sea-200);
}
.term-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
}
.emoji {
  font-size: 2.6rem;
}
.term {
  font-size: 1.9rem;
  font-weight: 700;
  margin: 0;
}
.reading {
  margin: 0;
  color: var(--ink-soft);
}
.meaning {
  font-size: 1.25rem;
  margin: 0;
  font-weight: 600;
}
.hanviet,
.vi {
  margin: 0;
  color: var(--ink-soft);
}
.example p {
  margin: 0;
}
.example {
  background: var(--sea-50);
  border-radius: 12px;
  padding: 8px 10px;
}
.explain {
  margin: 0;
  background: var(--sand);
  border-radius: 12px;
  padding: 8px 10px;
}
.lit {
  background: var(--sun-soft);
  border-radius: 6px;
}
.replay {
  font-size: 1.5rem;
  min-width: 48px;
  min-height: 48px;
  border-radius: 50%;
  border: 2px solid var(--sea-200);
  background: white;
  cursor: pointer;
}
</style>
