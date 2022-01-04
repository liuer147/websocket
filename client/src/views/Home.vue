<template>
  <div class="home">
    <div v-if="isEnter">
      <ul>
        <li>当前在线人数：{{ numRef }}</li>
        <li>当前房间号：{{ roomRef }}</li>
        <li v-for="(item, index) of msgList" :key="index">
          {{ item }}
        </li>
      </ul>
      <input v-model="msg" />
      <button @click="handleSubmit">发送</button>
    </div>
    <div v-else>
      <label for="room">
        房间号 <input id="room" v-model.trim="roomRef" type="text" />
      </label>
      <label for="name">
        名字 <input id="name" v-model.trim="name" type="text" />
      </label>
      <button @click="handleEnter">进入房间</button>
    </div>
    <h2 v-if="!isOnline">连接超时</h2>
  </div>
</template>

<script>
import { ref } from "vue";
import useWebsocket from "./useWebsocket";
export default {
  name: "Home",
  setup() {
    const ws = ref(null); //
    const msg = ref("");
    const { numRef, roomRef, msgList, isEnter, initWs, isOnline, name } =
      useWebsocket(ws);
    function handleSubmit() {
      ws.value.send(
        JSON.stringify({
          type: "message",
          msg: msg.value,
        })
      );
      msg.value = "";
      roomRef.value = "";
    }
    async function handleEnter() {
      if (!name.value || !roomRef.value) {
        alert("数据不能为空");
        return;
      }
      initWs();
      isEnter.value = true;
    }
    return {
      msgList,
      msg,
      handleSubmit,
      isEnter,
      handleEnter,
      name,
      roomRef,
      numRef,
      isOnline,
    };
  },
};
</script>
