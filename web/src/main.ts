// 웹 진입점(T004·T011·T040).
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './styles/index.css';
import App from './App.vue';
import { makeRouter } from './router';

const app = createApp(App).use(createPinia());
app.use(makeRouter()).mount('#app');
