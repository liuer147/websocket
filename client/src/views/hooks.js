import { reactive, ref } from "vue";

export default function useInitEvents(ws, name) {
  const isEnter = ref(false);
  const msgList = reactive([]);
  const numRef = ref(0);
  const roomRef = ref("");
  const timer = ref(null);
  const isOnline = ref(true);
  function onClose() {
    // 当服务段主动断开连接时，我们客户端也需要断开连接
    console.log("断开连接", ws.value.readyState);
    ws.value.close(); //
  }
  function onOpen() {
    ws.value.send(
      JSON.stringify({
        type: "enter",
        data: name.value,
        room: roomRef.value,
        uid: Date.now()
      })
    );
    isOnline.value = true;
  }
  function onMessage({ data }) {
    if (!isEnter.value) return;
    // console.log('data: ', data)
    const { msg, num, room, type } = JSON.parse(data);
    if (type === "heartbeat" && msg === "ping") {
      checkServer(); // 每当收到ping消息时，进行服务检查
      this.send(
        JSON.stringify({
          type: "heartbeat",
          msg: "pong",
        })
      );
      isOnline.value = true;
      return;
    } else {
      numRef.value = num;
      roomRef.value = room;
      msgList.push(msg);
    }
  }
  function onError() {
    // 发生错误时，，也可以进行重连
    console.log("断开连接，发生错误");
    setTimeout(() => {
      // 连接失败后1秒进行断线重连
      initWs();
    }, 3000);
  }
  function initWs() {
    //
    ws.value = new WebSocket("ws://127.0.0.1:3000");
    ws.value.onopen = onOpen;
    ws.value.onclose = onClose;
    ws.value.onmessage = onMessage;
    ws.value.onerror = onError;
  }
  function checkServer() {
    // 心跳检查时，我们客户端需要进行服务检测
    clearTimeout(timer.value);
    timer.value = setTimeout(() => {
      onClose(); // 此处貌似不能是close()，，断线重连，貌似不需要进行close
      isOnline.value = false;
      initWs();
    }, 1000 + 500);
  }
  return {
    isEnter,
    msgList,
    numRef,
    roomRef,
    initWs,
    isOnline,
  };
}
