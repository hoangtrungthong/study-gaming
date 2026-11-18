/* v8 ignore file -- điểm khởi động của app, được kiểm bằng E2E (apps/game/e2e). */
import { createApp } from 'vue';
import '@fontsource/noto-sans/vietnamese-400.css';
import '@fontsource/noto-sans/vietnamese-700.css';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-700.css';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import { setupPwa } from './pwa';

createApp(App).mount('#app');
setupPwa(registerSW);
