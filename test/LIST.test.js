import { test, beforeEach, afterEach, mock } from 'node:test'
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

test('test LIST message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users, minDataPort: dataPort}})
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

    await promiseSocket.write('MKD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder created successfully')

    const passiveModeData = formatPort('127.0.0.1', dataPort)
    await promiseSocket.write('PASV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `227 Entering passive mode (${passiveModeData})`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('LIST')

    dataContent = await promiseDataSocket.read()
    assert.match(dataContent.toString().trim(), /dr--r--r--/)
    assert.match(dataContent.toString().trim(), /john john/)
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "\/"/)

    await promiseSocket.end()
})

test('test MLSD message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true
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

    await promiseSocket.write('MKD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder created successfully')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    let promiseDataSocket = new PromiseSocket(new net.Socket())
    let dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('MLSD')

    dataContent = await promiseDataSocket.read()
    assert.match(dataContent.toString().trim(), /type=dir/)
    assert.match(dataContent.toString().trim(), /john/)
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "\/"/)

    await promiseSocket.end()
})

test('test MLSD message over secure connection', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
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

    await promiseSocket.write('AUTH NONE')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '504 Unsupported auth type NONE')

    await promiseSocket.write('AUTH TLS')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '234 Using authentication type TLS')

    promiseSocket = new PromiseSocket(new tls.connect({socket: socket, rejectUnauthorized: false}))
    await promiseSocket.stream.once('secureConnect', function(){})

    await promiseSocket.write('USER john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '232 User logged in')

    await promiseSocket.write('PBSZ 0')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 PBSZ=0')

    await promiseSocket.write('PROT P')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Protection level is P')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    let promiseDataSocket = new PromiseSocket(new tls.connect(dataPort, 'localhost', {rejectUnauthorized: false}))
    let dataSocket = promiseDataSocket.stream
    await dataSocket.once('secureConnect', function(){})

    await promiseSocket.write('STOR mytestfile')
    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)

    await promiseDataSocket.write('SOMETESTCONTENT')
    dataSocket.end()
    await promiseDataSocket.end()

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /226 Successfully transferred "mytestfile"/)

    await promiseSocket.end()
})


test('test MLSD message with handler', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true
        }
    ]
    const ls = mock.fn(() => Promise.resolve(Buffer.from('')))
    server = new ftpd({cnf: {port: cmdPortTCP, user: users, minDataPort: dataPort}, hdl: {list: ls}})
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

    await promiseSocket.write('MLSD')

    dataContent = await promiseDataSocket.read()
    assert.strictEqual(dataContent.toString().trim(), '')
    await promiseDataSocket.end()

    await sleep(100)

    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "\/"/)

    await promiseSocket.end()
})
