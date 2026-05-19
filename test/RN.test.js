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

test('test RNFR message file does not exist', { timeout }, async () => {
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

    await promiseSocket.write('RNFR myothertestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 File does not exist')

    await promiseSocket.end()
})

test('test RNFR/RNTO message', { timeout }, async () => {
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

    await promiseSocket.write('RNFR /mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '350 File exists')

    await promiseSocket.write('RNTO /someotherfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 File renamed successfully')

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
    assert.match(dataContent.toString().trim(), /someotherfile/)
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "\/"/)

    await promiseSocket.end()
})

test('test RNFR/RNTO message using handlers', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    const rn = mock.fn(() => Promise.resolve(true))
    server = new ftpd({cnf: {port: 50021, user: users}, hdl: {rename: rn}})
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

    await promiseSocket.write('RNFR mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '350 File exists')

    await promiseSocket.write('RNTO someotherfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 File renamed successfully')

    assert.strictEqual(rn.mock.callCount(), 1)
    assert.deepStrictEqual(rn.mock.calls[0].arguments, ['john', '/', 'mytestfile', 'someotherfile'])

    await promiseSocket.end()
})

test('test RNFR/RNTO message using handlers failing', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    const rn = mock.fn(() => Promise.resolve(false))
    server = new ftpd({cnf: {port: 50021, user: users}, hdl: {rename: rn}})
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

    await promiseSocket.write('RNFR mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '350 File exists')

    await promiseSocket.write('RNTO someotherfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 File rename failed')

    assert.strictEqual(rn.mock.callCount(), 1)
    assert.deepStrictEqual(rn.mock.calls[0].arguments, ['john', '/', 'mytestfile', 'someotherfile'])

    await promiseSocket.end()
})

test('test RNFR/RNTO message file already exists', { timeout }, async () => {
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

    await promiseSocket.write('RNFR /mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '350 File exists')

    await promiseSocket.write('RNTO mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 File already exists')

    await promiseSocket.end()
})
