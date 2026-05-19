import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { ftpd } from '../index.js'
import net from 'node:net'
import tls from 'node:tls'
import { PromiseSocket } from 'promise-socket'
import { sleep, getCmdPortTCP, getDataPort } from './utils.js'

const timeout = 7500
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

test('test STOR message without permission', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileCreate: false,
        }
    ]
    server = new ftpd({cnf: {port: 50021, user: users, minDataPort: dataPort}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(50021, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('STOR mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Transfer failed "mytestfile"')

    await dataSocket.end()
    await promiseSocket.end()
})

test('test STOR message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: 50021, user: users, minDataPort: dataPort}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(50021, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.write('STOR ../../mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Transfer failed "../../mytestfile"')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('STOR mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '150 Opening data channel')

    await promiseDataSocket.write('SOMETESTCONTENT')
    dataSocket.end()
    await promiseDataSocket.end()

    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '226 Successfully transferred "mytestfile"')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    promiseDataSocket = new PromiseSocket(new net.Socket())
    dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('MLSD')

    dataContent = await promiseDataSocket.read()
    assert.match(dataContent.toString().trim(), /type=file/)
    assert.match(dataContent.toString().trim(), /size=15/)
    assert.match(dataContent.toString().trim(), /mytestfile/)
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "\/"/)

    await promiseSocket.end()
})

test('test STOR message failes due to socket timeout', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: 50021, user: users, minDataPort: dataPort}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(50021, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.write('STOR ../../mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Transfer failed "../../mytestfile"')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await sleep(5500)
    assert.strictEqual(dataSocket.destroyed, true)

    await promiseSocket.end()
})

test('test STOR message with ASCII', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: 50021, user: users, minDataPort: dataPort}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(50021, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.write('TYPE A')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Type set to ASCII')

    await promiseSocket.write('STOR ../../mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Transfer failed "../../mytestfile"')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    dataSocket.setEncoding('ascii')
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('STOR mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '150 Opening data channel')

    await promiseDataSocket.write('SOMETESTCONTENT')
    dataSocket.end()
    await promiseDataSocket.end()

    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '226 Successfully transferred "mytestfile"')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    promiseDataSocket = new PromiseSocket(new net.Socket())
    dataSocket = promiseDataSocket.stream
    dataSocket.setEncoding('ascii')
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('MLSD')

    dataContent = await promiseDataSocket.read()
    assert.match(dataContent.toString().trim(), /type=file/)
    assert.match(dataContent.toString().trim(), /size=15/)
    assert.match(dataContent.toString().trim(), /mytestfile/)
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "\/"/)

    await promiseSocket.end()
})


test('test STOR message overwrite not allowed', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileOverwrite: false
        }
    ]
    server = new ftpd({cnf: {port: 50021, user: users, minDataPort: dataPort}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(50021, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.write('STOR ../../mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Transfer failed "../../mytestfile"')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('STOR mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '150 Opening data channel')

    await promiseDataSocket.write('SOMETESTCONTENT')
    dataSocket.end()
    await promiseDataSocket.end()

    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '226 Successfully transferred "mytestfile"')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    promiseDataSocket = new PromiseSocket(new net.Socket())
    dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('MLSD')

    dataContent = await promiseDataSocket.read()
    assert.match(dataContent.toString().trim(), /type=file/)
    assert.match(dataContent.toString().trim(), /size=15/)
    assert.match(dataContent.toString().trim(), /mytestfile/)
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "\/"/)

    await promiseSocket.write('STOR /mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 File already exists')

    await promiseSocket.end()
})

test('test STOR message with handler', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    const up = mock.fn(() => Promise.resolve(true))
    server = new ftpd({cnf: {port: 50021, user: users, minDataPort: dataPort}, hdl:{upload: up}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(50021, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('STOR mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '150 Opening data channel')

    await promiseDataSocket.write('SOMETESTCONTENT')
    dataSocket.end()
    await promiseDataSocket.end()

    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '226 Successfully transferred "mytestfile"')

    assert.strictEqual(up.mock.callCount(), 1)
    assert.deepStrictEqual(up.mock.calls[0].arguments, ['john', '/', 'mytestfile', Buffer.from('SOMETESTCONTENT'), 0])

    await promiseSocket.end()
})

test('test STOR message with handler fails', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    const up = mock.fn(() => Promise.resolve(false))
    server = new ftpd({cnf: {port: 50021, user: users, minDataPort: dataPort}, hdl:{upload: up}})
    assert.ok(server instanceof ftpd)
    server.start()

    let promiseSocket = new PromiseSocket(new net.Socket())
    let socket = promiseSocket.stream
    await socket.connect(50021, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('STOR mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '150 Opening data channel')

    await promiseDataSocket.write('SOMETESTCONTENT')
    dataSocket.end()
    await promiseDataSocket.end()

    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Transfer failed "mytestfile"')

    assert.strictEqual(up.mock.callCount(), 1)
    assert.deepStrictEqual(up.mock.calls[0].arguments, ['john', '/', 'mytestfile', Buffer.from('SOMETESTCONTENT'), 0])

    await promiseSocket.end()
})
