// 웹 진입점(T004). 글꼴·토큰(T011), API 클라이언트(T036), 라우터 가드(T040)는 각 작업에서 더한다.
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';

createApp(App).use(createPinia()).use(router).mount('#app');
