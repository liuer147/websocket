const redis = require('redis')

const client = redis.createClient() // 默认是本地的6379端口

client.on('error', (err) => {
    console.log('Redis Client Error', err)
})

client.connect()

function setValue(key, value) {
    if (value == null || typeof value === 'string') {
        client.set(key, value)
    } else if (Object.prototype.toString.call(value) === '[object Object]') {
        Object.keys(value).forEach(field => {
            client.hSet(key, field, value[field], client.print)
        })
    }
}

function getValue(key) {
    return client.get(key)
}

function getHValue(key) {
    return client.hGetAll(key)
}

function existsValue(key) {
    return client.exists(key)
}

module.exports = {
    setValue, getValue, getHValue, existsValue
}
