import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ftpd } from '../index.js'
import net from 'node:net'
import tls from 'node:tls'
import { PromiseSocket } from 'promise-socket'
import { getCmdPortTCP, getDataPort } from './utils.js'

const timeout = 5000
let server, content, dataContent = null
const cmdPortTCP = getCmdPortTCP()
const dataPort = getDataPort()

const cleanup = function() {
    if (server) {
        server.stop()
        server.cleanup()
        server = null
    }
    content = ''
    dataContent = ''
}
beforeEach(() => cleanup())
afterEach(() => cleanup())

test('error message when not logged in', { timeout }, async () => {
    server = new ftpd({cnf: {port: cmdPortTCP}})
    assert.ok(server instanceof ftpd)
    server.start()

    const promiseSocket = new PromiseSocket(new net.Socket())
    const socket = promiseSocket.stream

    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')
    await promiseSocket.write('REST 0')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '530 Not logged in')

    await promiseSocket.end()
})

test('login as anonymous not allowed by default', { timeout }, async () => {
    server = new ftpd({cnf: {port: cmdPortTCP}})
    assert.ok(server instanceof ftpd)
    server.start()

    const promiseSocket = new PromiseSocket(new net.Socket())
    const socket = promiseSocket.stream

    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')
    await promiseSocket.write('USER anonymous')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '530 Not logged in')

    await promiseSocket.end()
})

test('login as anonymous when enabled', { timeout }, async () => {
    server = new ftpd({cnf: {port: cmdPortTCP, allowAnonymousLogin: true}})
    assert.ok(server instanceof ftpd)
    server.start()

    const promiseSocket = new PromiseSocket(new net.Socket())
    const socket = promiseSocket.stream

    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER anonymous')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '331 Password required for anonymous')

    await promiseSocket.write('PASS anonymous@anonymous')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '230 Logged on')

    await promiseSocket.end()
})

test('login with default user settings', { timeout }, async () => {
    server = new ftpd({cnf: {port: cmdPortTCP, username: 'john', password: 'doe'}})
    assert.ok(server instanceof ftpd)
    server.start()

    const promiseSocket = new PromiseSocket(new net.Socket())
    const socket = promiseSocket.stream

    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '331 Password required for john')

    await promiseSocket.write('PASS doe')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '230 Logged on')

    await promiseSocket.end()
})

test('login with default user settings without password allowed', { timeout }, async () => {
    server = new ftpd({cnf: {port: cmdPortTCP, username: 'john', allowLoginWithoutPassword: true}})
    assert.ok(server instanceof ftpd)
    server.start()

    const promiseSocket = new PromiseSocket(new net.Socket())
    const socket = promiseSocket.stream

    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.end()
})

test('login with user settings', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            password: 'doe'
        },
        {
            username: 'michael',
            password: 'myers'
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '331 Password required for john')

    await promiseSocket.write('PASS doe')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '230 Logged on')

    await promiseSocket.end()

    promiseSocket = new PromiseSocket(new net.Socket())
    socket = promiseSocket.stream
    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER michael')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '331 Password required for michael')

    await promiseSocket.write('PASS myers')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '230 Logged on')

    await promiseSocket.end()
})

test('login with user settings without password allowed', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true
        },
        {
            username: 'michael',
            allowLoginWithoutPassword: true
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.end()

    promiseSocket = new PromiseSocket(new net.Socket())
    socket = promiseSocket.stream
    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER michael')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.end()
})

test('login with user settings and wrong user rejected', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            password: 'doe'
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER michael')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '530 Not logged in')

    await promiseSocket.end()
})

test('login with user settings and wrong password rejected', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            password: 'doe'
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '331 Password required for john')

    await promiseSocket.write('PASS pass')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '530 Username or password incorrect')

    await promiseSocket.end()
})
