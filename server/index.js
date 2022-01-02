const WebSocket = require('ws')
const { setValue, getValue, getHValue, existsValue, deleteValue } = require('./src/config/redisConfig')

const wss = new WebSocket.Server({ port: 3000 })

const roomGroup = {} // 存放着各个房间的人数

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ msg: '我是服务端，欢迎连接' }))
    ws.isAlive = true // 加入连接时，isAlive为true -> 初始心跳连接状态
    ws.on('message',  async (data) => { // 规定data一律为json数据
        const dataObj = JSON.parse(data.toString())
        switch (dataObj.type) {
            case 'enter':
                ws.name = dataObj.msg // 在进入连接时，传入的msg就是name
                ws.room = dataObj.room // 在进入房间时，保存room到ws
                ws.uid = dataObj.uid
                // 在进入房间时，应该初始化redis中该房间的消息记录
                const isExist = await existsValue(ws.room)
                if (isExist) { // redis中存在该房间
                    const usersStr = await getValue(ws.room)
                    const users = usersStr.split(',')
                    if (users.indexOf(ws.uid) === -1) { // 如果该房间的user没有包含当前uid，则存入进去
                       await setValue(ws.room, usersStr + ',' + ws.uid)
                    }
                } else { // 如果redis中不存在该房间
                    await setValue(ws.room, ws.uid)
                }
                if (roomGroup[ws.room]) {
                    roomGroup[ws.room]++
                } else {
                    roomGroup[ws.room] = 1
                }
                broadcast(`欢迎${dataObj.msg}进入房间`, ws)
                await handleSendOfflineMessage(ws, dataObj)
                break
            case 'message': // -》 ！！！！！！！！！！断线重连时ws貌似并没有保存数据 -> 此时这个数据是否应该要保存到其他地方，关联起来-或者为什么开始保存了，但是现在却失效了，是不是重连时启动了另外一个ws
                // 当是发送消息时，ws里面已经保存了连接用户的name
                broadcast(`${ws.name}: ${dataObj.msg}`, ws)
                await handleOfflineUserMessage(ws, dataObj)
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
        // debugger
        if (ws.room) {
            roomGroup[ws.room]--
            // delete ws.room //  此处不能删除ws的room属性, 因为要给同一房间内的其他人广播消息
        }
        broadcast(`系统提示:${ws.name}已经退出房间`, ws)
    })
})

setInterval(() => {
    wss.clients.forEach(client => {
        if (!client.isAlive && client.room) { // 如果下一次心跳之前，仍然没有接收pong消息(设置isAlive为true) // 在线且存在room
            roomGroup[client.room]-- // 别忘记房间人数减1
            // delete client.room // 为什么此处得删除client.room ???
            client.terminate() // 则终止本次连接
            return // 终止本次连接就直接返回了
        }
        /**
         * 主动发送请求，当客户端返回了消息之后，主动设置flag为在线
        * */
        client.isAlive = false // 每次广播心跳时，都会先将其isAlive=false。等其可以返回pong消息时，就设置isAlive为true表示活的
        client.send(JSON.stringify({
            type: 'heartbeat',
            msg: 'ping',
        }))
        // num: roomGroup[client.room],
        // room: client.room
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

/**
 * 对于存储逻辑是，key为room时，其值，应该为uid以 ','拼接的字符串
 * key 为 uid 时，其值应该为 消息对象字符串以 ',' 拼接的字符串
* */

async function handleMessage(client, dataObj) {
    // 逻辑是什么，在广播的时候
    debugger
    const currRoomUserStr = await getValue(client.room) // 获取当前房间所有存入redis里面的user
    // 若是房间不存在呢 ？ 可能存在不存在的情况吗
    const currRoomUsers = currRoomUserStr.split(',') // 将str转换为arr
    // 将消息发送给当前房间的所有在线的用户 -> 两种情况：一种是开始离线，现在在线了；另外一种是一直在线
    for (const clientItem of wss.clients) {
        console.log('who: ', clientItem.name, 'state: ', clientItem.readyState, 'open?: ', WebSocket.OPEN)
        if (clientItem.readyState === WebSocket.OPEN && clientItem.room === client.room) {
            dataObj.num = roomGroup[client.room]
            dataObj.room = client.room

            client.send(JSON.stringify(dataObj)) // 发送消息

            // 以下是将当前用户当前房间的存在于redis的房间中的消息取出来，且广播

            // !注意：实际开发下面的name应该换成uid
            if (currRoomUsers.includes(client.uid)) { // 如果redis中当前房间的users存在当前发消息的用户 -> 此时为广播消息之后 -> 则需要从redis中将当前用户删除
                currRoomUsers.splice(currRoomUsers.indexOf(client.uid), 1)
            }
            const isExists = await existsValue(client.uid) // 判断uid是否存在离线消息
            if(isExists) { // 如果存在 -> 开始是离线且有离线数据，现在上线了，应该将离线消息也发送。 不存在 -> 则开始已经是在线，那么只需要发送上面的此时客户发送过来的消息就行了
                const msgStr = await getValue(client.uid) // 获取用户的离线消息
                const msgArr = JSON.parse(msgStr) // 将消息字符串集转换为数组/对象
                // 接下来遍历该用户的离线缓存数据 -> 注意消息的房间号得与当前房间号一致
/*                msgArr.forEach(msgItem => {
                    if (msgItem.room === client.room && msgItem.uid === client.uid) { // 是当前用户的消息，且属于当前房间的消息
                        const [msg]
                    }
                })*/
                const remainMsg = msgArr.filter(msgItem => {
                    if (msgItem.room === client.room && clientItem.uid === client.uid) { // 是当前用户的消息，且属于当前房间的消息 -> 判断clientItem的uid
                        client.send(JSON.stringify(msgItem))
                        return false
                    }
                    return true
                })
                console.log('remainMsg: ', remainMsg)
                setValue(client.uid, JSON.stringify(remainMsg)) // 将剩余的消息存入uid的redis以修改
            }
        }
    }

    // 此时是处理 -> 当前房间且是离线的用户 -> 则需要把当前消息(当前房间的其他用户所发的消息)依次存入当前房间的离线用户的redis中
    if (currRoomUsers.length > 0 && dataObj.type === 'message') {
        for (const uid of currRoomUsers) {
            const isExist = await existsValue(uid) // 判断redis中是否存在该uid
            if(isExist) { // 如果redis中已经存在该uid的离线消息
                const userData = await getValue(uid)
                const msgArr = JSON.parse(userData)
                msgArr.push({
                    room: client.room,
                    msg: dataObj.msg
                })
                await setValue(uid, JSON.stringify(msgArr)) // 将消息存入redis以更新数据
            } else { // redis中<不>存在该uid的离线消息
                await setValue(uid, JSON.stringify([{
                    room: client.room,
                    msg: dataObj.msg
                }]))
            }

        }
    }
}

// 对当前房间离线的用户的消息处理
async function handleOfflineUserMessage(client, dataObj) {
    // 第一步：获取在当前房间，且离线的用户，怎么获取?
    const usersStr = await getValue(client.room) // 获取本次客户端所发消息的房间的所有用户
    if(!usersStr) return // 如果当前房间在redis中不存在用户则直接返回 -> 貌似不可能
    const users = usersStr.split(',') // string -> array => uid所组成的Array
    const offlineUsers = users.filter(uid => { // users为当前所以用户
        // 过滤掉->redis里面的users中在线且房间号为当前房间号的uid
        // return ! Array.prototype.find.call(wss.clients, item => item.room === client.room && item.uid === uid) // 注意前面的取反符号
        // 需要满足一下条件(uid)
        // (1)、必须在当前房间
        // (2)、必须离线
        // (3)、该用户不能是自己
        // $这里逻辑貌似可以优化一下
        if(uid === client.uid) return false
        let isOffline = true
        for(const inlineClient of wss.clients) {
            if(inlineClient.uid === uid && inlineClient.room === client.room) isOffline = false
        }
        return isOffline
        // => 不在当前在线用户内，或者在当前在线用户内且不在当前房间，不是发消息的人
        // return Array.prototype.every.call(wss.clients, inlineClient => inlineClient.uid !== uid) || Array.prototype.some.call(wss.clients, inlineClient => inlineClient.uid === uid && inlineClient.room === client.room)
    })
    // 此时offlineUsers已经是当前房间，且离线的人的uidArray了
    
    // 接下来-> 将当前消息存入到offlineUser每项的离线消息记录中
    // 有两种情况判断: (1)、用户已经存在离线消息。(2)、用户存在离线消息
    for(const uid of offlineUsers) {
        // const msgArrStr = getValue(uid) // 此处使用是否存在来判断->在发送离线消息的时候则需要在发送之后删除记录
        const isExist = await existsValue(uid)
        if(isExist) { // 存在离线消息
            const msgArrStr = await getValue(uid)
            const msgArr = JSON.parse(msgArrStr) // msgArrStr.split(',') // 消息数组
            msgArr.push({
                room: client.room,
                msg: dataObj.msg, // msg存在dataObj里面
                name: client.name, // 谁发送的消息也保存一下
            })
            await setValue(uid, JSON.stringify(msgArr))
        } else { // 不存在离线消息
            await setValue(uid, JSON.stringify([ // msg存在于dataObj里面
                { room: client.room, msg: dataObj.msg, name: client.name, }
            ]))
        }
    }
}

// 对上线的用户的离线消息的处理
async function handleSendOfflineMessage(client, dataObj) {
    // 对当前用户发送离线消息->有离线消息的话->且需要是当前房间
    const { uid, room } = client
    const isExist = await existsValue(uid)
    if(!isExist) return // 如果没有消息，直接返回
    const msgArrStr = await getValue(uid)
    const msgArr =  JSON.parse(msgArrStr) // msgArrStr.split(',')
    const offlineMsgArr = msgArr.filter(msg => msg.room === room)

    // 现在msgArr已经是uid所在room的离线消息了
    offlineMsgArr.forEach(msgObj => {
        client.send(JSON.stringify({
            msg: `${msgObj.name}:${msgObj.msg}`, // 发送的是msgObj的msg
            room,
            num: roomGroup[room]
        }))
    })
    // 现在已经发送完离线消息了，但是不要忘了，对redis里面的消息进行更新，
    // 后序还可能将消息存入到mongoDB里面
    const otherRoomOfflineMsg = msgArr.filter(msg => msg.room !== room)
    if(otherRoomOfflineMsg.length > 0) {
        await setValue(uid, JSON.stringify(otherRoomOfflineMsg))
    } else {
        // 删除该记录
        await deleteValue(uid)
    }
}
