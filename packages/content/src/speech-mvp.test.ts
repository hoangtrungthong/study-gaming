import { describe, expect, it } from 'vitest';
import { decks } from './decks';
import { phrases } from './phrases';
import { mazes, sentenceDecks } from './regions';
import { chunkSegment, collectSpeech, kanaSegment, sentenceSegments, speechKey } from './speech';

const ja = sentenceDecks.ja!.sentences;
const en = sentenceDecks.en!.sentences;

describe('câu đọc của các trò mới', () => {
  it('câu tiếng Anh: nối khối bằng dấu cách, kèm dòng dịch', () => {
    expect(sentenceSegments(decks.en, en[1]!)).toEqual([
      { lang: 'en', text: 'I like apples' },
      { lang: 'vi', text: 'Tôi thích táo.', translation: true },
    ]);
  });

  it('câu tiếng Nhật: khối có kanji đọc theo かな, không có dấu cách', () => {
    const mizu = ja.find((s) => s.id === 'ja-s-mizu-nomimasu')!;
    expect(sentenceSegments(decks.ja, mizu)[0]).toEqual({ lang: 'ja', text: 'みずをのみます' });
    expect(chunkSegment(decks.ja, mizu, 0)).toEqual({ lang: 'ja', text: 'みずを' });
    expect(chunkSegment(decks.ja, mizu, 1)).toEqual({ lang: 'ja', text: 'のみます' });
    expect(chunkSegment(decks.ja, mizu, 9)).toEqual({ lang: 'ja', text: '' });
  });

  it('tên kana đọc bằng giọng Nhật', () => {
    expect(kanaSegment('あ')).toEqual({ lang: 'ja', text: 'あ' });
  });

  it('danh sách cần tạo âm thanh có câu, khối, khối nhiễu, gợi ý mê cung, kana, câu cố định mới', () => {
    const keys = collectSpeech([decks.en, decks.ja], {
      sentenceDecks: [
        { deck: decks.en, sentences: sentenceDecks.en! },
        { deck: decks.ja, sentences: sentenceDecks.ja! },
      ],
      mazes,
      kana: [{ char: 'あ', romaji: 'a', strokes: [] }],
    }).map(speechKey);
    expect(keys).toContain('en|I like apples');
    expect(keys).toContain('vi|Tôi thích táo.');
    expect(keys).toContain('ja|みずを');
    expect(keys).toContain('en|eats');
    expect(keys).toContain(`vi|${mazes[0]!.hintVi}`);
    expect(keys).toContain('ja|あ');
    expect(keys).toContain(`vi|${phrases.mazeWall}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('không có nội dung thêm thì chỉ gom bộ từ và câu cố định', () => {
    expect(collectSpeech([decks.en]).map(speechKey)).not.toContain('en|I like apples');
  });
});
