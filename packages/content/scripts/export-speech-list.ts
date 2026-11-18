// Xuất danh sách mọi đoạn cần đọc cho công cụ tạo âm thanh (tools/tts).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectSpeech, decks, subjects } from '../src/index';

const out = fileURLToPath(new URL('../../../tools/tts/speech-list.json', import.meta.url));
const segments = collectSpeech(subjects.map((s) => decks[s]));
writeFileSync(out, `${JSON.stringify({ segments }, null, 2)}\n`, 'utf8');
console.log(`Đã ghi ${segments.length} đoạn vào ${out}`);
