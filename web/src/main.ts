// 웹 진입점(T004·T011·T040).
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './styles/index.css';
import './styles/room.css'; // D38 방 안의 내용
import App from './App.vue';
import { makeRouter } from '@/router'; // 단독 배포본은 vite.config가 미술관 전용 라우터(router/world.ts)로 바꾼다
import { installDirectives } from './directives';

const app = createApp(App).use(createPinia());
installDirectives(app); // D38 v-reveal · v-tilt
app.use(makeRouter()).mount('#app');

// 오프라인 열기(3D미술관_재설계 §2-19 기준 6): 단독 배포본에서만 서비스 워커를 쓴다. 등록 뒤 이미 받은 파일 주소를 넘겨 저장하게 한다
if (import.meta.env.MODE === 'world' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
      const urls = [location.pathname, ...performance.getEntriesByType('resource').map((e) => e.name)];
      reg.active?.postMessage({ type: 'cache-urls', urls });
    }).catch(() => { /* 오프라인 열기만 안 될 뿐 앱은 그대로 동작한다 */ });
  });
}
