// Xuất danh sách mọi đoạn cần đọc cho công cụ tạo âm thanh (tools/tts).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectSpeech, decks, mazes, sentenceDecks, subjects, type KanaStrokes } from '../src/index';

const out = fileURLToPath(new URL('../../../tools/tts/speech-list.json', import.meta.url));
const kanaFile = fileURLToPath(new URL('../data/kana-strokes.json', import.meta.url));
const kana: KanaStrokes[] = existsSync(kanaFile) ? JSON.parse(readFileSync(kanaFile, 'utf8')).kana : [];

const segments = collectSpeech(
  subjects.map((s) => decks[s]),
  {
    sentenceDecks: subjects.flatMap((s) => {
      const sentences = sentenceDecks[s];
      return sentences ? [{ deck: decks[s], sentences }] : [];
    }),
    mazes,
    kana,
  },
);
writeFileSync(out, `${JSON.stringify({ segments }, null, 2)}\n`, 'utf8');
console.log(`Đã ghi ${segments.length} đoạn vào ${out}`);
