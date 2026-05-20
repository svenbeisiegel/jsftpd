import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { tftpd } from '../index.js'
import { Readable, PassThrough } from 'node:stream'
import dgram from 'node:dgram'
import fs from 'node:fs'
import path from 'node:path'
import { getTftpPort } from './utils.js'

const timeout = 5000
let server
const tftpPort = getTftpPort()

const cleanup = function () {
    if (server) {
        server.stop()
        server.cleanup()
        server = null
    }
}
beforeEach(() => cleanup())
afterEach(() => cleanup())

function buildRRQ (filename, mode, options) {
    const parts = [
        Buffer.from([0x00, 0x01]),
        Buffer.from(filename, 'ascii'),
        Buffer.from([0x00]),
        Buffer.from(mode || 'octet', 'ascii'),
        Buffer.from([0x00])
    ]
    if (options) {
        for (const [key, value] of Object.entries(options)) {
            parts.push(
                Buffer.from(key, 'ascii'),
                Buffer.from([0x00]),
                Buffer.from(String(value), 'ascii'),
                Buffer.from([0x00])
            )
        }
    }
    return Buffer.concat(parts)
}

function buildWRQ (filename, mode, options) {
    const parts = [
        Buffer.from([0x00, 0x02]),
        Buffer.from(filename, 'ascii'),
        Buffer.from([0x00]),
        Buffer.from(mode || 'octet', 'ascii'),
        Buffer.from([0x00])
    ]
    if (options) {
        for (const [key, value] of Object.entries(options)) {
            parts.push(
                Buffer.from(key, 'ascii'),
                Buffer.from([0x00]),
                Buffer.from(String(value), 'ascii'),
                Buffer.from([0x00])
            )
        }
    }
    return Buffer.concat(parts)
}

function buildACK (blockNum) {
    const buf = Buffer.alloc(4)
    buf.writeUInt16BE(0x0004, 0)
    buf.writeUInt16BE(blockNum, 2)
    return buf
}

function buildDATA (blockNum, data) {
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(data)
    const buf = Buffer.alloc(4 + payload.length)
    buf.writeUInt16BE(0x0003, 0)
    buf.writeUInt16BE(blockNum, 2)
    payload.copy(buf, 4)
    return buf
}

function sendAndReceive (client, msg, port, address) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('UDP response timeout')), 3000)
        client.once('message', (resp) => {
            clearTimeout(timer)
            resolve(resp)
        })
        client.send(msg, 0, msg.length, port, address || 'localhost')
    })
}

function receiveMessage (client) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('UDP response timeout')), 3000)
        client.once('message', (resp, rinfo) => {
            clearTimeout(timer)
            resolve({ data: resp, rinfo })
        })
    })
}

test('create tftpd instance with default options', { timeout }, () => {
    server = new tftpd()
    assert.ok(server instanceof tftpd)
    assert.strictEqual(server._opt.cnf.port, 69)
    assert.strictEqual(server._opt.cnf.allowWrite, false)
    assert.strictEqual(server._opt.cnf.allowOverwrite, false)
    assert.strictEqual(server._opt.cnf.maxConnections, 10)
})

test('tftpd server fails when basefolder does not exist', { timeout }, () => {
    try {
        server = new tftpd({ cnf: { basefolder: '/NOTEXISTING' } })
        assert.fail('should have thrown')
    } catch (err) {
        assert.match(err.message, /Basefolder must exist/)
    }
})

test('tftpd server can be started on non default port', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort } })
    assert.ok(server instanceof tftpd)
    server.start()
    // Give it a moment to bind
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.strictEqual(server._socket.address().port, tftpPort)
})

test('tftpd start and stop lifecycle', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.ok(server._socket !== null)
    server.stop()
    assert.strictEqual(server._socket, null)
})

test('RRQ for existing file returns DATA', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Create a test file in the basefolder
    const testContent = 'Hello TFTP World!'
    const basefolder = server._opt.cnf.basefolder
    fs.writeFileSync(path.join(basefolder, 'testfile.txt'), testContent)

    const client = dgram.createSocket('udp4')
    try {
        const rrq = buildRRQ('testfile.txt', 'octet')
        const resp = await sendAndReceive(client, rrq, tftpPort)

        // Should be a DATA packet (opcode 3, block 1)
        assert.strictEqual(resp.readUInt16BE(0), 0x0003)
        assert.strictEqual(resp.readUInt16BE(2), 1)
        assert.strictEqual(resp.subarray(4).toString(), testContent)
    } finally {
        client.close()
    }
})

test('RRQ for nonexistent file returns ERROR', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const client = dgram.createSocket('udp4')
    try {
        const rrq = buildRRQ('nonexistent.txt', 'octet')
        const resp = await sendAndReceive(client, rrq, tftpPort)

        // Should be an ERROR packet (opcode 5, error code 1 = FILE_NOT_FOUND)
        assert.strictEqual(resp.readUInt16BE(0), 0x0005)
        assert.strictEqual(resp.readUInt16BE(2), 1)
    } finally {
        client.close()
    }
})

test('RRQ with path traversal returns ERROR', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const client = dgram.createSocket('udp4')
    try {
        const rrq = buildRRQ('../../../etc/passwd', 'octet')
        const resp = await sendAndReceive(client, rrq, tftpPort)

        // Should be an ERROR packet (opcode 5, error code 2 = ACCESS_VIOLATION)
        assert.strictEqual(resp.readUInt16BE(0), 0x0005)
        assert.strictEqual(resp.readUInt16BE(2), 2)
    } finally {
        client.close()
    }
})

test('RRQ with malformed request returns ERROR', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const client = dgram.createSocket('udp4')
    try {
        // RRQ without null terminator
        const malformed = Buffer.from([0x00, 0x01, 0x41, 0x42])
        const resp = await sendAndReceive(client, malformed, tftpPort)

        assert.strictEqual(resp.readUInt16BE(0), 0x0005)
        assert.strictEqual(resp.readUInt16BE(2), 4) // ILLEGAL_OPERATION
    } finally {
        client.close()
    }
})

test('WRQ when allowWrite is false returns ACCESS_VIOLATION', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort, allowWrite: false } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const client = dgram.createSocket('udp4')
    try {
        const wrq = buildWRQ('upload.txt', 'octet')
        const resp = await sendAndReceive(client, wrq, tftpPort)

        assert.strictEqual(resp.readUInt16BE(0), 0x0005)
        assert.strictEqual(resp.readUInt16BE(2), 2) // ACCESS_VIOLATION
    } finally {
        client.close()
    }
})

test('WRQ when allowWrite is true creates file', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort, allowWrite: true } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const basefolder = server._opt.cnf.basefolder
    const client = dgram.createSocket('udp4')
    try {
        const wrq = buildWRQ('upload.txt', 'octet')
        // Send WRQ and get ACK for block 0
        const { data: resp, rinfo } = await receiveMessage(client, client.send(wrq, 0, wrq.length, tftpPort, 'localhost'))

        // Should be an ACK for block 0
        assert.strictEqual(resp.readUInt16BE(0), 0x0004)
        assert.strictEqual(resp.readUInt16BE(2), 0)

        // Send DATA block 1 (final, < 512 bytes)
        const fileContent = 'Uploaded via TFTP!'
        const dataPacket = buildDATA(1, fileContent)
        const ack1 = await sendAndReceive(client, dataPacket, rinfo.port)

        assert.strictEqual(ack1.readUInt16BE(0), 0x0004)
        assert.strictEqual(ack1.readUInt16BE(2), 1)

        // Verify file was written
        await new Promise((resolve) => setTimeout(resolve, 100))
        const written = fs.readFileSync(path.join(basefolder, 'upload.txt'), 'utf-8')
        assert.strictEqual(written, fileContent)
    } finally {
        client.close()
    }
})

test('WRQ overwrite existing file when allowOverwrite is false returns FILE_EXISTS', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort, allowWrite: true, allowOverwrite: false } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const basefolder = server._opt.cnf.basefolder
    fs.writeFileSync(path.join(basefolder, 'existing.txt'), 'original')

    const client = dgram.createSocket('udp4')
    try {
        const wrq = buildWRQ('existing.txt', 'octet')
        const resp = await sendAndReceive(client, wrq, tftpPort)

        assert.strictEqual(resp.readUInt16BE(0), 0x0005)
        assert.strictEqual(resp.readUInt16BE(2), 6) // FILE_EXISTS
    } finally {
        client.close()
    }
})

test('WRQ overwrite existing file when allowOverwrite is true succeeds', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort, allowWrite: true, allowOverwrite: true } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const basefolder = server._opt.cnf.basefolder
    fs.writeFileSync(path.join(basefolder, 'existing.txt'), 'original')

    const client = dgram.createSocket('udp4')
    try {
        const wrq = buildWRQ('existing.txt', 'octet')
        const { data: resp, rinfo } = await receiveMessage(client, client.send(wrq, 0, wrq.length, tftpPort, 'localhost'))

        assert.strictEqual(resp.readUInt16BE(0), 0x0004)
        assert.strictEqual(resp.readUInt16BE(2), 0)

        const newContent = 'overwritten!'
        const dataPacket = buildDATA(1, newContent)
        const ack1 = await sendAndReceive(client, dataPacket, rinfo.port)

        assert.strictEqual(ack1.readUInt16BE(0), 0x0004)
        assert.strictEqual(ack1.readUInt16BE(2), 1)

        await new Promise((resolve) => setTimeout(resolve, 100))
        const written = fs.readFileSync(path.join(basefolder, 'existing.txt'), 'utf-8')
        assert.strictEqual(written, newContent)
    } finally {
        client.close()
    }
})

test('RRQ with tsize option returns OACK with file size', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const testContent = 'Size test content'
    const basefolder = server._opt.cnf.basefolder
    fs.writeFileSync(path.join(basefolder, 'sizefile.txt'), testContent)

    const client = dgram.createSocket('udp4')
    try {
        const rrq = buildRRQ('sizefile.txt', 'octet', { tsize: '0' })
        const { data: resp, rinfo } = await receiveMessage(client, client.send(rrq, 0, rrq.length, tftpPort, 'localhost'))

        // Should be OACK (opcode 6)
        assert.strictEqual(resp.readUInt16BE(0), 0x0006)

        // Parse OACK options
        const oackStr = resp.subarray(2).toString('ascii')
        assert.ok(oackStr.includes('tsize'))
        assert.ok(oackStr.includes(testContent.length.toString()))

        // Send ACK for block 0 to acknowledge OACK
        const ack0 = buildACK(0)
        const dataResp = await sendAndReceive(client, ack0, rinfo.port)

        // Should be DATA block 1
        assert.strictEqual(dataResp.readUInt16BE(0), 0x0003)
        assert.strictEqual(dataResp.readUInt16BE(2), 1)
        assert.strictEqual(dataResp.subarray(4).toString(), testContent)
    } finally {
        client.close()
    }
})

test('RRQ with blksize option returns OACK and uses negotiated blksize', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const testContent = 'A'.repeat(100)
    const basefolder = server._opt.cnf.basefolder
    fs.writeFileSync(path.join(basefolder, 'blkfile.txt'), testContent)

    const client = dgram.createSocket('udp4')
    try {
        const rrq = buildRRQ('blkfile.txt', 'octet', { blksize: '64' })
        const { data: resp, rinfo } = await receiveMessage(client, client.send(rrq, 0, rrq.length, tftpPort, 'localhost'))

        // Should be OACK
        assert.strictEqual(resp.readUInt16BE(0), 0x0006)

        const oackStr = resp.subarray(2).toString('ascii')
        assert.ok(oackStr.includes('blksize'))
        assert.ok(oackStr.includes('64'))

        // ACK the OACK
        const ack0 = buildACK(0)
        const data1 = await sendAndReceive(client, ack0, rinfo.port)

        // Block 1 should have 64 bytes of data
        assert.strictEqual(data1.readUInt16BE(0), 0x0003)
        assert.strictEqual(data1.readUInt16BE(2), 1)
        assert.strictEqual(data1.subarray(4).length, 64)

        // ACK block 1 to get block 2
        const ack1 = buildACK(1)
        const data2 = await sendAndReceive(client, ack1, rinfo.port)

        assert.strictEqual(data2.readUInt16BE(0), 0x0003)
        assert.strictEqual(data2.readUInt16BE(2), 2)
        assert.strictEqual(data2.subarray(4).length, 36) // remaining bytes
    } finally {
        client.close()
    }
})

test('RRQ with handler support returns Buffer', { timeout }, async () => {
    const fileData = Buffer.from('Handler served file!')
    const hdl = {
        download: async (filename) => {
            if (filename === 'virtual.txt') return fileData
            return undefined
        },
        upload: async () => new PassThrough()
    }
    server = new tftpd({ cnf: { port: tftpPort }, hdl })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const client = dgram.createSocket('udp4')
    try {
        const rrq = buildRRQ('virtual.txt', 'octet')
        const resp = await sendAndReceive(client, rrq, tftpPort)

        assert.strictEqual(resp.readUInt16BE(0), 0x0003)
        assert.strictEqual(resp.readUInt16BE(2), 1)
        assert.strictEqual(resp.subarray(4).toString(), 'Handler served file!')
    } finally {
        client.close()
    }
})

test('RRQ with handler support returns Stream', { timeout }, async () => {
    const hdl = {
        download: async (filename) => {
            if (filename === 'stream.txt') {
                const stream = new PassThrough()
                stream.end(Buffer.from('Streamed content!'))
                return stream
            }
            return undefined
        },
        upload: async () => new PassThrough()
    }
    server = new tftpd({ cnf: { port: tftpPort }, hdl })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const client = dgram.createSocket('udp4')
    try {
        const rrq = buildRRQ('stream.txt', 'octet')
        const resp = await sendAndReceive(client, rrq, tftpPort)

        assert.strictEqual(resp.readUInt16BE(0), 0x0003)
        assert.strictEqual(resp.readUInt16BE(2), 1)
        assert.strictEqual(resp.subarray(4).toString(), 'Streamed content!')
    } finally {
        client.close()
    }
})

test('RRQ with handler returns file not found', { timeout }, async () => {
    const hdl = {
        download: async () => undefined,
        upload: async () => new PassThrough()
    }
    server = new tftpd({ cnf: { port: tftpPort }, hdl })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const client = dgram.createSocket('udp4')
    try {
        const rrq = buildRRQ('missing.txt', 'octet')
        const resp = await sendAndReceive(client, rrq, tftpPort)

        assert.strictEqual(resp.readUInt16BE(0), 0x0005)
        assert.strictEqual(resp.readUInt16BE(2), 1) // FILE_NOT_FOUND
    } finally {
        client.close()
    }
})

test('WRQ with handler support', { timeout }, async () => {
    let uploadedFilename
    const chunks = []
    const hdl = {
        download: async () => undefined,
        upload: async (filename) => {
            uploadedFilename = filename
            const stream = new PassThrough()
            stream.on('data', (chunk) => chunks.push(chunk))
            return stream
        }
    }
    server = new tftpd({ cnf: { port: tftpPort, allowWrite: true }, hdl })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const client = dgram.createSocket('udp4')
    try {
        const wrq = buildWRQ('handler_upload.txt', 'octet')
        const { data: resp, rinfo } = await receiveMessage(client, client.send(wrq, 0, wrq.length, tftpPort, 'localhost'))

        assert.strictEqual(resp.readUInt16BE(0), 0x0004)
        assert.strictEqual(resp.readUInt16BE(2), 0)

        const content = 'Handler upload data'
        const dataPacket = buildDATA(1, content)
        const ack1 = await sendAndReceive(client, dataPacket, rinfo.port)

        assert.strictEqual(ack1.readUInt16BE(0), 0x0004)
        assert.strictEqual(ack1.readUInt16BE(2), 1)

        await new Promise((resolve) => setTimeout(resolve, 200))
        assert.strictEqual(uploadedFilename, 'handler_upload.txt')
        assert.strictEqual(Buffer.concat(chunks).toString(), content)
    } finally {
        client.close()
    }
})

test('WRQ with path traversal returns ACCESS_VIOLATION', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort, allowWrite: true } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const client = dgram.createSocket('udp4')
    try {
        const wrq = buildWRQ('../../../tmp/evil.txt', 'octet')
        const resp = await sendAndReceive(client, wrq, tftpPort)

        assert.strictEqual(resp.readUInt16BE(0), 0x0005)
        assert.strictEqual(resp.readUInt16BE(2), 2) // ACCESS_VIOLATION
    } finally {
        client.close()
    }
})

test('unknown opcode returns ILLEGAL_OPERATION', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const client = dgram.createSocket('udp4')
    try {
        // Send a packet with opcode 99
        const buf = Buffer.alloc(4)
        buf.writeUInt16BE(99, 0)
        buf.writeUInt16BE(0, 2)
        const resp = await sendAndReceive(client, buf, tftpPort)

        assert.strictEqual(resp.readUInt16BE(0), 0x0005)
        assert.strictEqual(resp.readUInt16BE(2), 4) // ILLEGAL_OPERATION
    } finally {
        client.close()
    }
})

test('RRQ with subdirectory path resolves correctly', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const basefolder = server._opt.cnf.basefolder
    const subdir = path.join(basefolder, 'subdir')
    fs.mkdirSync(subdir, { recursive: true })
    fs.writeFileSync(path.join(subdir, 'nested.txt'), 'nested content')

    const client = dgram.createSocket('udp4')
    try {
        const rrq = buildRRQ('subdir/nested.txt', 'octet')
        const resp = await sendAndReceive(client, rrq, tftpPort)

        assert.strictEqual(resp.readUInt16BE(0), 0x0003)
        assert.strictEqual(resp.readUInt16BE(2), 1)
        assert.strictEqual(resp.subarray(4).toString(), 'nested content')
    } finally {
        client.close()
    }
})

test('WRQ multi-block transfer', { timeout }, async () => {
    server = new tftpd({ cnf: { port: tftpPort, allowWrite: true } })
    server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const basefolder = server._opt.cnf.basefolder
    const client = dgram.createSocket('udp4')
    try {
        const wrq = buildWRQ('multiblock.bin', 'octet')
        const { data: resp, rinfo } = await receiveMessage(client, client.send(wrq, 0, wrq.length, tftpPort, 'localhost'))

        assert.strictEqual(resp.readUInt16BE(0), 0x0004)
        assert.strictEqual(resp.readUInt16BE(2), 0)

        // Send block 1: exactly 512 bytes (full block, transfer continues)
        const block1Data = Buffer.alloc(512, 0x41)
        const data1 = buildDATA(1, block1Data)
        const ack1 = await sendAndReceive(client, data1, rinfo.port)
        assert.strictEqual(ack1.readUInt16BE(0), 0x0004)
        assert.strictEqual(ack1.readUInt16BE(2), 1)

        // Send block 2: less than 512 bytes (final block)
        const block2Data = Buffer.from('final')
        const data2 = buildDATA(2, block2Data)
        const ack2 = await sendAndReceive(client, data2, rinfo.port)
        assert.strictEqual(ack2.readUInt16BE(0), 0x0004)
        assert.strictEqual(ack2.readUInt16BE(2), 2)

        await new Promise((resolve) => setTimeout(resolve, 100))
        const written = fs.readFileSync(path.join(basefolder, 'multiblock.bin'))
        assert.strictEqual(written.length, 517)
        assert.strictEqual(written.subarray(0, 512).toString(), block1Data.toString())
        assert.strictEqual(written.subarray(512).toString(), 'final')
    } finally {
        client.close()
    }
})
