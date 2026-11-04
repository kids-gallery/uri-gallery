<script setup lang="ts">
// 개인정보·이용 안내(3D미술관_재설계 §2-19 기준 3·9, §2-22 6). 실제 동작만 적는다. 바꾸면 이 문구도 같이 고친다.
import type { StorageMode } from './deviceStorage';
import WorldStorageState from './WorldStorageState.vue';
import { SERVER_WORLD } from './server/upload';

/** persisted: 브라우저가 이 미술관 자료를 지우지 않기로 했는가(null = 이 브라우저는 알려 주지 않음) */
defineProps<{ persisted: boolean | null; lastBackup: number | null; mode: StorageMode }>();
const emit = defineEmits<{ close: []; backup: [] }>();
/** 기본 빌드의 기능은 자체 모델로 배우지 않았다. 켠 빌드에서만 출처를 안내한다(마스터플랜 3-6) */
const modelData = import.meta.env.VITE_RELIEF_DEPTH === '1';
</script>

<template>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="개인정보·이용 안내">
    <div class="g-panel sheet-card w-privacy">
      <h2>개인정보·이용 안내</h2>
      <h3>어디에 저장되나요</h3>
      <p v-if="SERVER_WORLD">사진과 아이 별칭, 작품 이야기는 인터넷을 통해 우리 미술관에 저장돼요. 화면 설정 중 일부는 이 기기에 저장될 수 있어요.</p>
      <p v-else>올린 사진, 아이 이름, 작품 이야기, 캐릭터와 모드 설정은 지금 쓰는 이 기기의 브라우저에만 저장돼요. 화면에서 고른 가족처럼 잠깐 쓰는 값은 탭을 닫으면 사라지는 브라우저 저장소에 둬요.</p>
      <h3 v-if="!SERVER_WORLD">지금 저장 상태</h3>
      <WorldStorageState v-if="!SERVER_WORLD" :persisted="persisted" :last-backup="lastBackup" :mode="mode" />
      <h3>밖으로 보내는 것</h3>
      <p v-if="SERVER_WORLD">사진은 고른 부분만 인터넷을 통해 우리 미술관으로 보내 처리해요. 잘라 낸 부분은 보내지 않아요. 아이 사진을 외부 인공지능 서비스로 보내지 않아요.</p>
      <p v-else>사진과 이야기를 이 기기 밖으로 보내지 않아요. 방문 기록을 모으는 분석 도구와 광고를 쓰지 않아요. 배경 지우기와 입체 만들기도 이 기기 안에서 해요. 자랑하기 그림은 보호자가 고른 곳으로만 보내져요. 인터넷 주소로 이 앱을 열면, 앱 파일을 보내 주는 호스팅 업체가 접속 기록(접속한 주소와 시각)을 남길 수 있어요. 사진과 이야기는 그 기록에 들어가지 않아요.</p>
      <h3>지우는 방법</h3>
      <p v-if="SERVER_WORLD">미술관에 저장된 작품은 보관함에서 지울 수 있어요. 이 기기의 브라우저 데이터를 지워도 미술관의 작품은 지워지지 않아요.</p>
      <p v-else>설정의 [이 기기의 자료 모두 지우기]를 누르거나, 브라우저 설정에서 이 사이트의 데이터를 지우면 모두 사라져요. 지운 자료는 되살릴 수 없어요.</p>
      <h3 v-if="!SERVER_WORLD">백업 파일</h3>
      <p v-if="!SERVER_WORLD">기기를 바꾸거나 브라우저 자료를 지우면 작품이 사라져요. 설정의 [백업 내보내기]로 받은 파일에는 사진과 이야기가 그대로 들어 있으니, 보호자가 안전한 곳에 보관해 주세요.</p>
      <h3>공개 소프트웨어</h3>
      <p>이 앱이 쓰는 공개 소프트웨어의 라이선스 원문: <a href="/licenses/THIRD_PARTY.txt" target="_blank" rel="noopener">THIRD_PARTY.txt</a></p>
      <p v-if="modelData">그림을 입체로 만드는 기능을 배울 때 쓴 공개 자료의 출처: <a href="/licenses/MODEL_DATA.txt" target="_blank" rel="noopener">MODEL_DATA.txt</a></p>
      <div class="row">
        <button v-if="!SERVER_WORLD" class="g-btn g-btn--primary" type="button" @click="emit('backup')">백업하러 가기</button>
        <button class="g-btn" type="button" @click="emit('close')">닫기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.w-privacy h3{margin:12px 0 4px;font:600 15px var(--g-serif)}
.w-privacy p{margin:0;font-size:14px;line-height:1.6;word-break:keep-all}
.w-privacy .row{margin-top:14px}
</style>
