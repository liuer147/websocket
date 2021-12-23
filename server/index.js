const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 3000 })

wss.on('connection', (ws) => {
    ws.send('我是服务端，欢迎连接')
    ws.on('message', (data) => {
        console.log('--我是服务端，接收客户端的消息为：--', data)
        wss.clients.forEach((client) => {
            if (client.readyState !== WebSocket.CLOSED) {
                client.send(data.toString()) // 注意得toString
            }
        })
    })
})

