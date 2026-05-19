import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { ftpd } from '../index.js'
import net from 'node:net'
import tls from 'node:tls'
import { PromiseSocket } from 'promise-socket'
import { sleep, getCmdPortTCP, getDataPort, formatPort } from './utils.js'

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

test('test PASV message takes next free port', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true
        }
    ]
    const config = {
        port: cmdPortTCP,
        user: users,
        minDataPort: cmdPortTCP,
        maxConnections: 1
    }
    server = new ftpd({cnf: config})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(cmdPortTCP, '127.0.0.1', 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    const passiveModeData = formatPort('127.0.0.1', (cmdPortTCP + 1))
    await promiseSocket.write('PASV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `227 Entering passive mode (${passiveModeData})`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    await dataSocket.connect((cmdPortTCP + 1), 'localhost')

    await promiseSocket.write('LIST')
    content = await promiseSocket.read()

    dataContent = await promiseDataSocket.read()
    assert.strictEqual(dataContent.toString().trim(), '')
    await promiseDataSocket.end()

    await sleep(100)

    content += await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "\/"/)

    await promiseSocket.end()
})

test('test PASV message fails port unavailable', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true
        }
    ]
    const config = {
        port: cmdPortTCP,
        user: users,
        minDataPort: cmdPortTCP,
        maxConnections: 0
    }
    server = new ftpd({cnf: config})
    server._tcp.maxConnections = 10
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

    await promiseSocket.write('PASV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '501 Passive command failed')

    await promiseSocket.end()
})

test('test PASV message fails port range fails', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true
        }
    ]
    const config = {
        port: cmdPortTCP,
        user: users,
        minDataPort: 70000,
        maxConnections: 0
    }
    server = new ftpd({cnf: config})
    server._tcp.maxConnections = 10
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

    await promiseSocket.write('PASV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '501 Passive command failed')

    await promiseSocket.end()
})


test('test EPSV message takes next free port', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true
        }
    ]
    const config = {
        port: cmdPortTCP,
        user: users,
        minDataPort: cmdPortTCP,
        maxConnections: 1
    }
    server = new ftpd({cnf: config})
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

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${(cmdPortTCP + 1)}|)`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    await dataSocket.connect((cmdPortTCP + 1), 'localhost')

    await promiseSocket.write('LIST')
    content = await promiseSocket.read()

    dataContent = await promiseDataSocket.read()
    assert.strictEqual(dataContent.toString().trim(), '')
    await promiseDataSocket.end()

    await sleep(100)

    content += await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "\/"/)

    await promiseSocket.end()
})

test('test EPSV message fails port unavailable', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true
        }
    ]
    const config = {
        port: cmdPortTCP,
        user: users,
        minDataPort: cmdPortTCP,
        maxConnections: 0
    }
    server = new ftpd({cnf: config})
    server._tcp.maxConnections = 10
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

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '501 Extended passive command failed')

    await promiseSocket.end()
})
