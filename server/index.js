const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 3000 })

const roomGroup = {} // 存放着各个房间的人数

wss.on('connection', (ws) => {
    ws.send('我是服务端，欢迎连接')
    ws.isAlive = true // 加入连接时，isAlive为true
    ws.on('message', (data) => { // 规定data一律为json数据
        const dataObj = JSON.parse(data.toString())
        switch (dataObj.type) {
            case 'enter':
                ws.name = dataObj.data // 在进入连接时，传入的data就是name
                ws.room = dataObj.room // 在进入房间时，保存room到ws
                if (roomGroup[ws.room]) {
                    roomGroup[ws.room]++
                } else {
                    roomGroup[ws.room] = 1
                }
                broadcast(`欢迎${dataObj.data}进入房间`, ws)
                break
            case 'message':
                // 当是发送消息时，ws里面已经保存了连接用户的name
                broadcast(`${ws.name}: ${dataObj.data}`, ws)
                break
            case 'heartbeat':
                if (dataObj.msg === 'pong') {
                    ws.isAlive = true
                }
                break
        }
    })
    /**
     * @params code 状态码 number
     * @params reason 原因 buffer
    * */
    ws.on('close', () => {
        if (ws.room) {
            roomGroup[ws.room]--
            delete ws.room // 删除ws的room属性
        }
        broadcast(`系统提示:${ws.name}已经退出房间`, ws)
    })
})

setInterval(() => {
    wss.clients.forEach(client => {
        if (!client.isAlive) { // 如果下一次心跳之前，仍然没有接收pong消息(设置isAlive为true)
            roomGroup[client.room]-- // 别忘记房间人数减1
            delete client.room
            client.terminate() // 则终止本次连接
        }
        /**
         * 主动发送请求，当客户端返回了消息之后，主动设置flag为在线
        * */
        client.isAlive = false // 每次广播心跳时，都会先将其isAlive=false。等其可以返回pong消息时，就设置isAlive为true表示活的
        client.send(JSON.stringify({
            type: 'heartbeat',
            msg: 'ping',
            num: roomGroup[client.room],
            room: client.room
        }))
    })
}, 1000)

function broadcast(data, ws) {
    const dataObj = { msg: data }
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.room === ws.room) {
            dataObj.num = roomGroup[client.room]
            dataObj.room = ws.room
            client.send(JSON.stringify(dataObj)) // 注意得toString
        }
    })
}
