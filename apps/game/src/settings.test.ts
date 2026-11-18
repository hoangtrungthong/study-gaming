import { describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, saveSettings } from './settings';

const store = (value: string | null) => ({ getItem: () => value });

describe('settings', () => {
  it('chưa lưu gì thì dùng mặc định', () => {
    expect(loadSettings(store(null))).toEqual(defaultSettings());
  });

  it('đọc lại cài đặt đã lưu', () => {
    const saved: Record<string, string> = {};
    const s = { ...defaultSettings(), ageGroup: 'mam' as const, rate: 0.85, voices: { ja: 'voicevox-3' } };
    saveSettings(s, { setItem: (k, v) => (saved[k] = v) });
    const raw = Object.values(saved)[0]!;
    expect(loadSettings(store(raw))).toEqual(s);
  });

  it('giới hạn tốc độ đọc và sửa nhóm tuổi lạ', () => {
    const loaded = loadSettings(store(JSON.stringify({ rate: 9, ageGroup: 'xyz' })));
    expect(loaded.rate).toBe(1.5);
    expect(loaded.ageGroup).toBe('choi');
    expect(loadSettings(store(JSON.stringify({ rate: 0.1 }))).rate).toBe(0.75);
    expect(loadSettings(store(JSON.stringify({ rate: 'abc' }))).rate).toBe(1);
  });

  it('dữ liệu hỏng thì về mặc định', () => {
    expect(loadSettings(store('{hỏng'))).toEqual(defaultSettings());
  });
});
