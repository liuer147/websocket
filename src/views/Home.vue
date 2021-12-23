<template>
  <div class="home">
    <ul>
      <li v-for="(item, index) of msgList" :key="index">
        {{ item }}
      </li>
    </ul>
    <input v-model="msg" />
    <button @click="handleSubmit">发送</button>
  </div>
</template>

<script>
import { reactive, ref } from "vue";

export default {
  name: "Home",
  setup() {
    const ws = new WebSocket("ws://127.0.0.1:3000");
    const msgList = reactive([]);
    const msg = ref("");
    ws.onopen = () => {
      ws.send("我是客户端");
    };
    ws.onclose = () => {
      window.alert(`连接已断开, 状态为: ${ws.readyState}`);
    };
    ws.onmessage = (res) => {
      msgList.push(res.data)
    };
    function handleSubmit() {
      ws.send(`已发送：${msg.value}`);
      debugger
      msg.value = "";
    }
    return {
      msgList,
      msg,
      handleSubmit,
    };
  },
};
</script>
