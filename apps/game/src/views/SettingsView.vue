<script setup lang="ts">
import { computed } from 'vue';
import { phrases, speechLangs, viSegment, type AgeGroup, type SpeechLang } from '@study/content';
import { manifest, speaker } from '../audio';
import { DEFAULT_RATE, settings } from '../settings';

defineEmits<{ back: [] }>();

const ages: { id: AgeGroup; label: string; hint: string }[] = [
  { id: 'mam', label: '🌱 Mầm', hint: 'khoảng 5–8 tuổi' },
  { id: 'choi', label: '🌿 Chồi', hint: 'khoảng 9–14 tuổi' },
  { id: 'cay', label: '🌳 Cây', hint: '15 tuổi trở lên' },
];
const langName: Record<SpeechLang, string> = { vi: 'Tiếng Việt', en: 'Tiếng Anh', ja: 'Tiếng Nhật' };
const sample: Record<SpeechLang, string> = { vi: phrases.correct, en: 'Hello, how are you?', ja: 'こんにちは' };

const voicesFor = (lang: SpeechLang) => manifest.value.voices.filter((v) => v.lang === lang);
const credits = computed(() => [...new Set(manifest.value.voices.map((v) => v.credit).filter(Boolean))]);

function pickAge(age: AgeGroup) {
  settings.ageGroup = age;
  settings.rate = DEFAULT_RATE[age];
}

function setVoice(lang: SpeechLang, id: string) {
  settings.voices = { ...settings.voices, [lang]: id || undefined };
}

function preview(lang: SpeechLang) {
  void speaker.say([lang === 'vi' ? viSegment(sample.vi) : { lang, text: sample[lang] }]);
}
</script>

<template>
  <main class="settings">
    <header class="bar">
      <button class="back" type="button" @click="$emit('back')">← Xong</button>
      <h2 tabindex="-1">Cài đặt</h2>
      <span></span>
    </header>

    <fieldset>
      <legend>Nhóm tuổi</legend>
      <div class="ages">
        <button
          v-for="a in ages"
          :key="a.id"
          type="button"
          :class="{ on: settings.ageGroup === a.id }"
          :aria-pressed="settings.ageGroup === a.id"
          :data-testid="`age-${a.id}`"
          @click="pickAge(a.id)"
        >
          <b>{{ a.label }}</b>
          <small>{{ a.hint }}</small>
        </button>
      </div>
    </fieldset>

    <fieldset>
      <legend>Giọng đọc</legend>
      <label class="row"><input v-model="settings.autoRead" type="checkbox" /> Tự đọc giải thích</label>
      <label class="row"><input v-model="settings.showVietnamese" type="checkbox" /> Hiện và đọc tiếng Việt</label>
      <label class="row">
        Tốc độ đọc: {{ settings.rate.toFixed(2) }}×
        <input v-model.number="settings.rate" type="range" min="0.75" max="1.5" step="0.05" />
      </label>
      <div v-for="lang in speechLangs" :key="lang" class="row voice">
        <label :for="`voice-${lang}`">{{ langName[lang] }}</label>
        <select
          :id="`voice-${lang}`"
          :value="settings.voices[lang] ?? ''"
          @change="setVoice(lang, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ voicesFor(lang).length ? 'Mặc định' : 'Giọng của máy' }}</option>
          <option v-for="v in voicesFor(lang)" :key="v.id" :value="v.id">{{ v.label }}</option>
        </select>
        <button type="button" @click="preview(lang)">🔊 Nghe thử</button>
      </div>
    </fieldset>

    <fieldset v-if="credits.length">
      <legend>Ghi công giọng đọc</legend>
      <p v-for="c in credits" :key="c">{{ c }}</p>
    </fieldset>

    <fieldset>
      <legend>Nguồn dữ liệu</legend>
      <!-- Giấy phép CC BY-SA 3.0 của KanjiVG bắt buộc ghi công kèm link (packages/content/vendor/kanjivg/README.md). -->
      <p data-testid="credit-kanjivg">
        Nguồn nét chữ:
        <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>
        của Ulrich Apel, giấy phép
        <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>
      </p>
    </fieldset>
  </main>
</template>

<style scoped>
.settings {
  max-width: 720px;
  margin: 0 auto;
  padding: 12px 16px 32px;
  display: grid;
  gap: 16px;
}
fieldset {
  border: 2px solid var(--sea-200);
  border-radius: 20px;
  padding: 14px 16px;
  background: var(--paper);
  display: grid;
  gap: 12px;
}
legend {
  font-weight: 700;
  padding: 0 6px;
}
.ages {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.ages button {
  font: inherit;
  border: 2px solid var(--sea-200);
  border-radius: 16px;
  background: white;
  padding: 12px 6px;
  display: grid;
  gap: 2px;
  cursor: pointer;
}
.ages button.on {
  border-color: var(--sea);
  background: var(--sea-50);
}
.ages small {
  color: var(--ink-soft);
}
.row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.voice label {
  min-width: 96px;
}
select,
.voice button {
  font: inherit;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--sea-200);
  background: white;
}
input[type='checkbox'] {
  width: 22px;
  height: 22px;
  accent-color: var(--sea);
}
</style>
