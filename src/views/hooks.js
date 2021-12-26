import { reactive, ref } from "vue";

export default function useInitEvents(ws) {
  const isEnter = ref(false);
  const msgList = reactive([]);
  const numRef = ref(0)
  const roomRef = ref('')
  const timer = ref(null)
  const isOnline = ref(true)
  function onClose() {
    console.log('断开连接')
  }
  function onMessage({ data }) {
    if (!isEnter.value) return;

    const { msg, num, room, type } = JSON.parse(data);
    numRef.value = num;
    roomRef.value = room;
    if (type === "heartbeat" && msg === "ping") {
      checkServer() // 每当收到ping消息时，进行服务检查
      this.send(
        JSON.stringify({
          type: "heartbeat",
          msg: "pong",
        })
      );
      isOnline.value = true
      return
    }
    msgList.push(msg)
  }
  function onError() {
    console.log('断开连接，发生错误')
    setTimeout(() => { // 连接失败后1秒进行断线重连
      initWs()
    }, 1000)
  }
  function initWs() {
    ws.value = new WebSocket("ws://127.0.0.1:3000");
    ws.value.onclose = onClose
    ws.value.onmessage = onMessage
    ws.value.onerror = onError
  }
  function checkServer() {
    clearTimeout(timer.value)
    timer.value = setTimeout(() => {
      ws.value.close()
      isOnline.value = false
      initWs()
    }, 1000 + 500)
  }
  return {
    isEnter,
    msgList,
    numRef,
    roomRef,
    initWs,
    isOnline
  };
}
