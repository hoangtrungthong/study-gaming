/** Câu tiếng Việt cố định Tomo nói trong game. Mọi câu đều được tạo sẵn âm thanh. */
export const phrases = {
  welcome: 'Chào bạn, mình là Tomo. Chọn một hòn đảo để bắt đầu nhé!',
  matchIntro: 'Chạm vào một từ, rồi chạm vào nghĩa của nó.',
  rainIntro: 'Gõ đúng từ trên hạt mưa trước khi nó rơi xuống đất.',
  correct: 'Đúng rồi!',
  wrong: 'Chưa đúng, thử lại nhé!',
  missed: 'Ôi, hạt mưa rơi mất rồi.',
  roundWin: 'Giỏi quá! Bạn đã hoàn thành màn chơi.',
  rainOver: 'Hết mưa rồi. Cùng nghe lại những từ bị lỡ nhé.',
  hanVietPrefix: 'Âm Hán Việt là',
} as const;

export type PhraseKey = keyof typeof phrases;
