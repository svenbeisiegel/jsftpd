import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { ftpd } from '../index.js'
import net from 'node:net'
import tls from 'node:tls'
import { PromiseSocket } from 'promise-socket'
import { sleep, getCmdPortTCP, getCmdPortTLS, getDataPort, formatPort } from './utils.js'

const timeout = 5000
let server, content, dataContent = null
const cmdPortTCP = getCmdPortTCP()
const cmdPortTLS = getCmdPortTLS()
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

test('create ftpd instance without options created with default values', { timeout }, () => {
    server = new ftpd()
    assert.ok(server instanceof ftpd)
    assert.ok(!server._opt.cnf.allowAnonymousFileDelete)
    assert.ok(!server._opt.cnf.allowAnonymousFolderCreate)
    assert.ok(!server._opt.cnf.allowAnonymousFolderDelete)
    assert.ok(!server._opt.cnf.allowAnonymousLogin)
    assert.ok(!server._opt.cnf.allowLoginWithoutPassword)
    assert.ok(server._opt.cnf.allowUserFileDelete)
    assert.ok(server._opt.cnf.allowUserFileOverwrite)
    assert.ok(server._opt.cnf.allowUserFolderCreate)
    assert.ok(server._opt.cnf.allowUserFolderDelete)
    assert.ok(server._opt.cnf.allowUserFolderDelete)
    assert.ok(server._opt.cnf.allowUserFolderDelete)
    assert.strictEqual(server._opt.cnf.port, 21)
    assert.strictEqual(server._opt.cnf.securePort, 990)
})

test('ftp server can be started on non default ports', { timeout }, async () => {
    server = new ftpd({tls: {rejectUnauthorized: false}, cnf: {port: cmdPortTCP, securePort: cmdPortTLS}})
    assert.ok(server instanceof ftpd)
    assert.strictEqual(server._opt.cnf.port, cmdPortTCP)
    assert.strictEqual(server._opt.cnf.securePort, cmdPortTLS)
    server.start()
    assert.strictEqual(server._tcp.address().port, cmdPortTCP)
    assert.strictEqual(server._tls.address().port, cmdPortTLS)
    const handler = mock.fn()
    server.on('listen', handler)

    const promiseSocket = new PromiseSocket(new net.Socket())
    const socket = promiseSocket.stream

    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    assert.strictEqual(handler.mock.callCount(), 2)

    await promiseSocket.end()
})

test('ftp server fails when basefolder does not exist', { timeout }, () => {
    try {
        server = new ftpd({cnf: {basefolder: '/NOTEXISTING'}})
    } catch(err) {
        assert.match(err.message, /Basefolder must exist/)
    }
})

test('test unknown message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('SOMETHING')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '500 Command not implemented')

    await promiseSocket.end()
})

test('test CLNT message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('CLNT tests')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Don\'t care')

    await promiseSocket.end()
})

test('test SYST message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('SYST')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '215 UNIX')

    await promiseSocket.end()
})

test('test FEAT message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('FEAT')
    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /211-Features/)

    await promiseSocket.end()
})

test('test PWD message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('PWD')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '257 "/" is current directory')

    await promiseSocket.end()
})

test('test QUIT message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('QUIT')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '221 Goodbye')

    await promiseSocket.end()
})

test('test PBSZ message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('PBSZ 0')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 PBSZ=0')

    await promiseSocket.end()
})

test('test TYPE message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('TYPE A')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Type set to ASCII')

    await promiseSocket.write('TYPE')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Type set to BINARY')

    await promiseSocket.end()
})

test('test OPTS message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('OPTS UTF8 ON')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 UTF8 ON')

    await promiseSocket.write('OPTS UTF8 OFF')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 UTF8 OFF')

    await promiseSocket.write('OPTS SOMETHING')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '451 Not supported')

    await promiseSocket.end()
})

test('test PROT message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('PROT C')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '503 PBSZ missing')

    await promiseSocket.write('PBSZ 0')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 PBSZ=0')

    await promiseSocket.write('PROT C')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Protection level is C')

    await promiseSocket.write('PROT P')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Protection level is P')

    await promiseSocket.write('PROT Z')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '534 Protection level must be C or P')

    await promiseSocket.end()
})

test('test REST message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
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

    await promiseSocket.write('REST 0')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '350 Restarting at 0')

    await promiseSocket.write('REST -1')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Wrong restart offset')

    await promiseSocket.end()
})

test('test MKD message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true
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

    await promiseSocket.write('MKD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder created successfully')

    await promiseSocket.write('MKD /john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Folder exists')

    await promiseSocket.end()
})

test('test MKD message cannot create folder without permission', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: false,
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

    await promiseSocket.write('MKD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Permission denied')

    await promiseSocket.end()
})

test('test RMD message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true,
            allowUserFolderDelete: true
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

    await promiseSocket.write('MKD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder created successfully')

    await promiseSocket.write('RMD /pete')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Folder not found')

    await promiseSocket.write('RMD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder deleted successfully')

    await promiseSocket.end()
})

test('test RMD message cannot delete folder without permission', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true,
            allowUserFolderDelete: false,
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

    await promiseSocket.write('MKD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder created successfully')

    await promiseSocket.write('RMD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Permission denied')

    await promiseSocket.end()
})

test('test CWD message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true
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

    await promiseSocket.write('MKD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder created successfully')

    await promiseSocket.write('CWD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 CWD successful. "/john/" is current directory')

    await promiseSocket.write('CWD /john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 CWD successful. "/john/" is current directory')

    await promiseSocket.write('CWD ..')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 CWD successful. "/" is current directory')

    await promiseSocket.write('CWD ..')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 CWD successful. "/" is current directory')

    await promiseSocket.write('CWD false')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '530 CWD not successful')

    await promiseSocket.end()
})

test('test MFMT message', { timeout }, async () => {
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

    await promiseSocket.write('MFMT 20150215120000 mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '253 Date/time changed okay')

    await promiseSocket.write('EPSV')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), `229 Entering extended passive mode (|||${dataPort}|)`)

    promiseDataSocket = new PromiseSocket(new net.Socket())
    dataSocket = promiseDataSocket.stream
    await dataSocket.connect(dataPort, 'localhost')

    await promiseSocket.write('MLSD')
    content = await promiseSocket.read()

    dataContent = await promiseDataSocket.read()
    assert.match(dataContent.toString().trim(), /type=file/)
    assert.match(dataContent.toString().trim(), /modify=20150215/)
    assert.match(dataContent.toString().trim(), /size=15/)
    assert.match(dataContent.toString().trim(), /mytestfile/)
    await promiseDataSocket.end()

    await sleep(100)

    content += await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)
    assert.match(content.toString().trim(), /226 Successfully transferred "\/"/)

    await promiseSocket.end()
})

test('test MFMT message with handler', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}, hdl: {}})
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

    await promiseSocket.write('MFMT 20150215120000 mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '253 Date/time changed okay')

    await promiseSocket.end()
})

test('test MFMT message file does not exist', { timeout }, async () => {
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

    await promiseSocket.write('MFMT 20150215120000 /someotherfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 File does not exist')

    await promiseSocket.end()
})

test('test DELE message without permission', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileDelete: false,
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

    await promiseSocket.write('DELE mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 Permission denied')

    await promiseSocket.end()
})

test('test DELE message relative path', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileDelete: true
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

    await promiseSocket.write('DELE someotherfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 File not found')

    await promiseSocket.write('DELE mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 File deleted successfully')

    await promiseSocket.end()
})

test('test DELE message absolute path', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFileDelete: true
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

    await promiseSocket.write('DELE /mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 File deleted successfully')

    await promiseSocket.end()
})

test('test SIZE message', { timeout }, async () => {
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

    await promiseSocket.write('SIZE /myfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 File not found')

    await promiseSocket.write('SIZE /mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '213 15')

    await promiseSocket.write('SIZE mytestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '213 15')

    await promiseSocket.end()
})

test('test AUTH message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
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

    await promiseSocket.end()
})

test('test PORT message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true
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

    await promiseSocket.write('MKD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder created successfully')

    const dataServer = net.createServer()
    let promiseDataSocket = new PromiseSocket(dataServer)
    await promiseDataSocket.stream.listen(dataPort, '127.0.0.1')

    await promiseSocket.write('PORT something')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '501 Port command failed')

    const portData = formatPort('127.0.0.1', dataPort)
    await promiseSocket.write(`PORT ${portData}`)
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Port command successful')

    await promiseSocket.write('MLSD')
    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)

    await promiseDataSocket.stream.close()
    await promiseSocket.end()
})

test('test EPRT message', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true
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

    await promiseSocket.write('MKD john')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder created successfully')

    const dataServer = net.createServer()
    let promiseDataSocket = new PromiseSocket(dataServer)
    await promiseDataSocket.stream.listen(dataPort, '127.0.0.1')

    await promiseSocket.write('EPRT something')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '501 Extended port command failed')

    await promiseSocket.write(`EPRT ||127.0.0.1|${dataPort}|`)
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Extended Port command successful')

    await promiseSocket.write('MLSD')
    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /150 Opening data channel/)

    await promiseDataSocket.stream.close()
    await promiseSocket.end()
})

test('test NOOP before authentication', { timeout }, async () => {
    server = new ftpd({cnf: {port: cmdPortTCP, username: 'john', password: 'test'}})
    assert.ok(server instanceof ftpd)
    server.start()

    const promiseSocket = new PromiseSocket(new net.Socket())
    const socket = promiseSocket.stream
    await socket.connect(cmdPortTCP, 'localhost')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '220 Welcome')

    await promiseSocket.write('NOOP')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 NOOP ok')

    await promiseSocket.end()
})

test('test NOOP after authentication', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('NOOP')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 NOOP ok')

    await promiseSocket.end()
})

test('test MODE S accepted', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('MODE S')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Mode set to Stream')

    await promiseSocket.end()
})

test('test MODE B rejected', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('MODE B')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '504 Only stream mode is supported')

    await promiseSocket.end()
})

test('test STRU F accepted', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('STRU F')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '200 Structure set to File')

    await promiseSocket.end()
})

test('test STRU R rejected', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('STRU R')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '504 Only file structure is supported')

    await promiseSocket.end()
})

test('test ABOR with no active transfer', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('ABOR')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '226 Abort successful')

    await promiseSocket.end()
})

test('test CDUP from subfolder', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('MKD testfolder')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder created successfully')

    await promiseSocket.write('CWD testfolder')
    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /250/)
    assert.match(content.toString().trim(), /testfolder/)

    await promiseSocket.write('CDUP')
    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /250/)
    assert.match(content.toString().trim(), /"\/"/)

    await promiseSocket.end()
})

test('test CDUP from root stays at root', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('CDUP')
    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /250/)
    assert.match(content.toString().trim(), /"\/"/)

    await promiseSocket.end()
})

test('test STAT without argument returns server status', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('STAT')
    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /211/)
    assert.match(content.toString().trim(), /john/)

    await promiseSocket.end()
})

test('test STAT with file argument returns file info', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
            allowUserFolderCreate: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users, minDataPort: dataPort}})
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

    await promiseSocket.write('MKD statfolder')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '250 Folder created successfully')

    await promiseSocket.write('STAT statfolder')
    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /213/)
    assert.match(content.toString().trim(), /statfolder/)

    await promiseSocket.end()
})

test('test STAT with nonexistent path returns 450', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('STAT nonexistent')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '450 File not found')

    await promiseSocket.end()
})

test('test MDTM returns modification time', { timeout }, async () => {
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

    await promiseSocket.write('STOR mdtmtestfile')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '150 Opening data channel')

    await promiseDataSocket.write('TESTDATA')
    dataSocket.end()
    await promiseDataSocket.end()

    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '226 Successfully transferred "mdtmtestfile"')

    await promiseSocket.write('MDTM mdtmtestfile')
    content = await promiseSocket.read()
    assert.match(content.toString().trim(), /^213 \d{14}$/)

    await promiseSocket.end()
})

test('test MDTM with nonexistent file returns 550', { timeout }, async () => {
    const users = [
        {
            username: 'john',
            allowLoginWithoutPassword: true,
        }
    ]
    server = new ftpd({cnf: {port: cmdPortTCP, user: users}})
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

    await promiseSocket.write('MDTM nonexistent')
    content = await promiseSocket.read()
    assert.strictEqual(content.toString().trim(), '550 File not found')

    await promiseSocket.end()
})
