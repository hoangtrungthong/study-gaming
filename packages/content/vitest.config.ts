import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      // Báo cả file chưa có test nạp (và file chỉ có khai báo kiểu), để scripts/coverage-changed.mjs đo đủ.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
