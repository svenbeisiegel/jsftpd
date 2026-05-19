import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { ftpd } from '../index.js'
import net from 'node:net'
import tls from 'node:tls'
import { PromiseSocket } from 'promise-socket'
import { sleep, getCmdPortTCP, getDataPort } from './utils.js'

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

test('test RETR message not allowed', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileRetrieve: false
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users, minDataPort: dataPort}})
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

    await promiseSocket.write('RETR mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Transfer failed "mytestfile"')

    await promiseSocket.end()
})

test('test RETR message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileRetrieve: true
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users, minDataPort: dataPort}})
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

    await promiseSocket.write('RETR /someotherfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 File not found')

    await promiseSocket.write('RETR mytestfile')

    dataContent = await promiseDataSocket.read()
    assert.match(dataContent.toString().trim(), /SOMETESTCONTENT/)
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "mytestfile"/)

    await promiseSocket.end()
})

test('test RETR message with ASCII', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileRetrieve: true
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users, minDataPort: dataPort}})
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

    await promiseSocket.write('TYPE A')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Type set to ASCII')

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

    await promiseSocket.write('RETR /someotherfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 File not found')

    await promiseSocket.write('RETR mytestfile')

    dataContent = await promiseDataSocket.read()
    assert.match(dataContent.toString().trim(), /SOMETESTCONTENT/)
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "mytestfile"/)

    await promiseSocket.end()
})

test('test RETR message with handler', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileRetrieve: true
        }
    ]
    const dl = mock.fn(() => Promise.resolve(Buffer.from('SOMETESTCONTENT')))
    const ul = mock.fn(() => Promise.resolve(true))
    server = new ftpd({cnf: {port: cmdPortTCP, user: users, minDataPort: dataPort}, hdl: {download: dl, upload: ul}})
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

    await promiseSocket.write('RETR mytestfile')

    dataContent = await promiseDataSocket.read()
    assert.match(dataContent.toString().trim(), /SOMETESTCONTENT/)
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "mytestfile"/)

    assert.strictEqual(ul.mock.callCount(), 1)
    assert.strictEqual(dl.mock.callCount(), 1)

    await promiseSocket.end()
})

test('test RETR message with handler fails', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileRetrieve: true
        }
    ]
    const dl = mock.fn(() => Promise.resolve('SOMETESTCONTENT'))
    const ul = mock.fn(() => Promise.resolve(true))
    server = new ftpd({cnf: {port: cmdPortTCP, user: users, minDataPort: dataPort}, hdl: {download: dl, upload: ul}})
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

    await promiseSocket.write('RETR mytestfile')

    dataContent = await promiseDataSocket.read()
    assert.strictEqual(dataContent, undefined)
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /550 Transfer failed "mytestfile"/)

    assert.strictEqual(ul.mock.callCount(), 1)
    assert.strictEqual(dl.mock.callCount(), 1)

    await promiseSocket.end()
})

test('test RETR message no active or passive mode', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileRetrieve: true
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

    await promiseSocket.write('PORT WRONG')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '501 Port command failed')

    server._useHdl = true

    await promiseSocket.write('RETR mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '501 Command failed')

    await promiseSocket.end()
})
