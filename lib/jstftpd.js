/*
 * @package jsftpd
 * @author Sven <mailsvb@gmail.com>
 * @license https://github.com/mailsvb/jsftpd/blob/main/LICENSE MIT License
 */

import dgram from 'node:dgram'
import fs from 'node:fs'
import { inspect } from 'node:util'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { EventEmitter } from 'node:events'

const defaultBaseFolder = path.join(import.meta.dirname, 'tftp_tmp')

const TFTPdefaults = {
    port: 69,
    basefolder: defaultBaseFolder,
    maxConnections: 10,
    allowWrite: false,
    allowOverwrite: false
}

const HandlerDefaults = {
    upload: async function () {},
    download: async function () {}
}

const TFTP_TIMEOUT = 5000
const TFTP_MAX_RETRIES = 3
const TFTP_MAX_FILENAME_LENGTH = 255
const TFTP_DEFAULT_BLKSIZE = 512
const TFTP_MAX_WINDOWSIZE = 16

const Opcode = Object.freeze({
    RRQ:   1,
    WRQ:   2,
    DATA:  3,
    ACK:   4,
    ERROR: 5,
    OACK:  6
})

const BLKSIZE_MIN = 8
const BLKSIZE_MAX = 65464

const ErrorCode = Object.freeze({
    NOT_DEFINED:       0,
    FILE_NOT_FOUND:    1,
    ACCESS_VIOLATION:  2,
    DISK_FULL:         3,
    ILLEGAL_OPERATION: 4,
    UNKNOWN_TID:       5,
    FILE_EXISTS:       6,
    NO_SUCH_USER:      7
})

const _getDate = (date) => {
    const now = date || (new Date())
    const MM = (now.getMonth() + 1).toString().padStart(2, '0')
    const DD = now.getDate().toString().padStart(2, '0')
    const H = now.getHours().toString().padStart(2, '0')
    const M = now.getMinutes().toString().padStart(2, '0')
    const S = now.getSeconds().toString().padStart(2, '0')
    return `${DD}.${MM}.${now.getFullYear()} - ${H}:${M}:${S}`
}

class tftpd extends EventEmitter {
    constructor (options) {
        super()

        // options
        this._opt = {}
        this._opt.cnf = { ...TFTPdefaults, ...options?.cnf }
        this._opt.hdl = { ...HandlerDefaults, ...options?.hdl }
        this._useHdl = options && Object.keys(options).includes('hdl')

        // checks
        if (!this._useHdl && !this._pathExists(this._opt.cnf.basefolder)) {
            if (this._opt.cnf.basefolder === defaultBaseFolder) {
                this._createDirectory(defaultBaseFolder)
            } else {
                throw new Error('Basefolder must exist')
            }
        }

        this._socket = null
        this.openTransfers = new Map()
        this._lastTransferKey = 0
    }

    start () {
        this._socket = dgram.createSocket('udp4')
        this._socket.on('message', (msg, rinfo) => this._handleMessage(msg, rinfo))
        this._socket.on('error', (err) => this.ErrorHandler(err))
        this._socket.on('listening', () => {
            const addr = this._socket.address()
            this.DebugHandler(`TFTP server listening on ${inspect(addr, { showHidden: false, depth: null, breakLength: 'Infinity' })}`)
            this.emit('listen', { protocol: 'udp', address: addr.address, port: addr.port })
        })
        this._socket.bind(this._opt.cnf.port)
    }

    stop () {
        for (const transfer of this.openTransfers.values()) {
            try { transfer.cleanup() } catch { /* ignore */ }
        }
        this.openTransfers.clear()
        if (this._socket !== null) {
            this._socket.close()
            this._socket = null
        }
    }

    cleanup () {
        if (this._isDirectory(defaultBaseFolder)) {
            this._removePath(defaultBaseFolder, { force: true, recursive: true })
        }
    }

    LogHandler (msg) {
        this.emit('log', `${_getDate()} ${msg}`)
    }

    DebugHandler (msg) {
        this.emit('debug', `${_getDate()} ${msg}`)
    }

    ErrorHandler (err) {
        const expectedErrorCodes = [
            'ERR_SOCKET_DGRAM_NOT_RUNNING'
        ]
        if (!expectedErrorCodes.includes(err.code)) {
            console.error('error', `${_getDate()} ${inspect(err, { showHidden: false, depth: null, breakLength: 'Infinity' })}`)
        }
    }

    _handleMessage (msg, rinfo) {
        if (msg.length < 2) {
            return
        }

        const opcode = msg.readUInt16BE(0)
        const connectionInfo = `[${rinfo.address}] [${rinfo.port}]`

        switch (opcode) {
        case Opcode.RRQ: {
            const req = this._parseRequest(msg)
            if (req === null) {
                this._sendError(this._socket, ErrorCode.ILLEGAL_OPERATION, 'Malformed request', rinfo.port, rinfo.address)
                return
            }
            this.LogHandler(`${connectionInfo} < RRQ file="${tftpd._sanitize(req.filename)}" mode="${tftpd._sanitize(req.mode)}"`)
            this._handleRRQ(req, rinfo)
            break
        }
        case Opcode.WRQ: {
            const req = this._parseRequest(msg)
            if (req === null) {
                this._sendError(this._socket, ErrorCode.ILLEGAL_OPERATION, 'Malformed request', rinfo.port, rinfo.address)
                return
            }
            this.LogHandler(`${connectionInfo} < WRQ file="${tftpd._sanitize(req.filename)}"`)
            this._handleWRQ(req, rinfo)
            break
        }
        default: {
            this.LogHandler(`${connectionInfo} < unknown opcode ${opcode}`)
            this._sendError(this._socket, ErrorCode.ILLEGAL_OPERATION, 'Illegal TFTP operation', rinfo.port, rinfo.address)
            break
        }
        }
    }

    async _handleRRQ (req, rinfo) {
        const connectionInfo = `[${rinfo.address}] [${rinfo.port}]`
        const filename = req.filename

        if (filename.length > TFTP_MAX_FILENAME_LENGTH) {
            this._sendError(this._socket, ErrorCode.ILLEGAL_OPERATION, 'Filename too long', rinfo.port, rinfo.address)
            return
        }

        if (this.openTransfers.size >= this._opt.cnf.maxConnections) {
            this.DebugHandler(`${connectionInfo} RRQ rejected, max concurrent transfers (${this._opt.cnf.maxConnections}) reached`)
            this._sendError(this._socket, ErrorCode.NOT_DEFINED, 'Server busy', rinfo.port, rinfo.address)
            return
        }

        if (this._useHdl) {
            let data
            try {
                data = await this._opt.hdl.download(filename)
            } catch (err) {
                this.DebugHandler(`${connectionInfo} handler download error: ${err.message}`)
                this._sendError(this._socket, ErrorCode.NOT_DEFINED, 'Internal error', rinfo.port, rinfo.address)
                return
            }
            if (!Buffer.isBuffer(data)) {
                this._sendError(this._socket, ErrorCode.FILE_NOT_FOUND, 'File not found', rinfo.port, rinfo.address)
                return
            }
            const stream = new PassThrough()
            stream.end(data)
            this.LogHandler(`${connectionInfo} > serving file="${tftpd._sanitize(filename)}" (${data.length} bytes) via handler`)
            this._startReadTransfer(stream, data.length, rinfo, req.options)
            return
        }

        const file = path.join(this._opt.cnf.basefolder, filename)

        if (!this._beginsWith(this._opt.cnf.basefolder, file)) {
            this._sendError(this._socket, ErrorCode.ACCESS_VIOLATION, 'Access violation', rinfo.port, rinfo.address)
            return
        }

        const stat = this._getPathStat(file)
        if (!stat?.isFile()) {
            this._sendError(this._socket, ErrorCode.FILE_NOT_FOUND, 'File not found', rinfo.port, rinfo.address)
            return
        }

        const stream = this._createReadStream(file)
        this.LogHandler(`${connectionInfo} > serving file="${tftpd._sanitize(filename)}" (${stat.size} bytes)`)
        this._startReadTransfer(stream, stat.size, rinfo, req.options)
    }

    async _handleWRQ (req, rinfo) {
        const connectionInfo = `[${rinfo.address}] [${rinfo.port}]`
        const filename = req.filename

        if (!this._opt.cnf.allowWrite) {
            this._sendError(this._socket, ErrorCode.ACCESS_VIOLATION, 'Access violation', rinfo.port, rinfo.address)
            return
        }

        if (filename.length > TFTP_MAX_FILENAME_LENGTH) {
            this._sendError(this._socket, ErrorCode.ILLEGAL_OPERATION, 'Filename too long', rinfo.port, rinfo.address)
            return
        }

        if (this.openTransfers.size >= this._opt.cnf.maxConnections) {
            this.DebugHandler(`${connectionInfo} WRQ rejected, max concurrent transfers (${this._opt.cnf.maxConnections}) reached`)
            this._sendError(this._socket, ErrorCode.NOT_DEFINED, 'Server busy', rinfo.port, rinfo.address)
            return
        }

        if (this._useHdl) {
            this.LogHandler(`${connectionInfo} > accepting write file="${tftpd._sanitize(filename)}" via handler`)
            this._startWriteTransfer(null, rinfo, req.options, filename)
            return
        }

        const file = path.join(this._opt.cnf.basefolder, filename)

        if (!this._beginsWith(this._opt.cnf.basefolder, file)) {
            this._sendError(this._socket, ErrorCode.ACCESS_VIOLATION, 'Access violation', rinfo.port, rinfo.address)
            return
        }

        if (this._pathExists(file) && !this._opt.cnf.allowOverwrite) {
            this._sendError(this._socket, ErrorCode.FILE_EXISTS, 'File already exists', rinfo.port, rinfo.address)
            return
        }

        // Ensure parent directory exists
        const dir = path.dirname(file)
        if (!this._isDirectory(dir)) {
            this._createDirectory(dir, { recursive: true })
        }

        const stream = this._createWriteStream(file)
        this.LogHandler(`${connectionInfo} > accepting write file="${tftpd._sanitize(filename)}"`)
        this._startWriteTransfer(stream, rinfo, req.options, filename)
    }

    _startReadTransfer (stream, fileSize, rinfo, options) {
        const socket = dgram.createSocket('udp4')
        const transferKey = ++this._lastTransferKey
        let retries = 0
        let timeout = null
        let streamEnded = false

        // Window state (RFC 7440)
        let windowBase = 0
        const windowChunks = []
        let lastChunkLength = 0

        stream.on('end', () => { streamEnded = true })

        // Negotiate options (RFC 2347/2348/2349/7440)
        const ackOptions = new Map()
        let retransmitTimeout = TFTP_TIMEOUT

        let blksize = TFTP_DEFAULT_BLKSIZE
        if (options.has('blksize')) {
            const requested = parseInt(options.get('blksize'), 10)
            if (requested >= BLKSIZE_MIN && requested <= BLKSIZE_MAX) {
                blksize = requested
                ackOptions.set('blksize', blksize.toString())
            }
        }
        let windowSize = 1
        const wndRaw = options.get('windowsize') ?? options.get('wndsize')
        const wndKey = options.has('windowsize') ? 'windowsize' : options.has('wndsize') ? 'wndsize' : undefined
        if (wndRaw !== undefined) {
            const requested = parseInt(wndRaw, 10)
            if (requested >= 1 && requested <= TFTP_MAX_WINDOWSIZE) {
                windowSize = requested
                ackOptions.set(wndKey, windowSize.toString())
            }
        }
        if (options.has('timeout')) {
            const requested = parseInt(options.get('timeout'), 10)
            if (requested >= 1 && requested <= 255) {
                retransmitTimeout = requested * 1000
                ackOptions.set('timeout', requested.toString())
            }
        }
        if (options.has('tsize')) {
            ackOptions.set('tsize', fileSize.toString())
        }
        const hasOptions = ackOptions.size > 0

        const cleanup = () => {
            if (timeout !== null) {
                clearTimeout(timeout)
                timeout = null
            }
            stream.destroy()
            this.openTransfers.delete(transferKey)
            try { socket.close() } catch { /* ignore */ }
        }

        const sendOACK = () => {
            const parts = []
            for (const [key, value] of ackOptions) {
                parts.push(Buffer.from(key, 'ascii'), Buffer.from([0x00]), Buffer.from(value, 'ascii'), Buffer.from([0x00]))
            }
            const payload = Buffer.concat(parts)
            const buf = Buffer.alloc(2 + payload.length)
            buf.writeUInt16BE(Opcode.OACK, 0)
            payload.copy(buf, 2)
            socket.send(buf, 0, buf.length, rinfo.port, rinfo.address)

            timeout = setTimeout(() => {
                retries++
                if (retries > TFTP_MAX_RETRIES) {
                    this.DebugHandler(`[${rinfo.address}] [${rinfo.port}] OACK timed out after ${TFTP_MAX_RETRIES} retries`)
                    cleanup()
                } else {
                    sendOACK()
                }
            }, retransmitTimeout)
        }

        const sendWindow = () => {
            for (let i = 0; i < windowChunks.length; i++) {
                const blk = (windowBase + 1 + i) & 0xFFFF
                const chunk = windowChunks.at(i)
                const buf = Buffer.alloc(4 + chunk.length)
                buf.writeUInt16BE(Opcode.DATA, 0)
                buf.writeUInt16BE(blk, 2)
                chunk.copy(buf, 4)
                socket.send(buf, 0, buf.length, rinfo.port, rinfo.address)
            }
            lastChunkLength = windowChunks.at(-1).length

            timeout = setTimeout(() => {
                retries++
                if (retries > TFTP_MAX_RETRIES) {
                    this.DebugHandler(`[${rinfo.address}] [${rinfo.port}] transfer timed out after ${TFTP_MAX_RETRIES} retries`)
                    cleanup()
                } else {
                    sendWindow()
                }
            }, retransmitTimeout)
        }

        const fillAndSendWindow = () => {
            while (windowChunks.length < windowSize) {
                const chunk = stream.read(blksize)
                if (chunk === null) {
                    break
                }
                windowChunks.push(chunk)
            }

            if (windowChunks.length > 0) {
                sendWindow()
                return
            }

            if (streamEnded === true) {
                if (lastChunkLength === blksize) {
                    windowChunks.push(Buffer.alloc(0))
                    sendWindow()
                } else {
                    this.LogHandler(`[${rinfo.address}] [${rinfo.port}] transfer complete (${fileSize} bytes, blksize=${blksize}, wndsize=${windowSize})`)
                    cleanup()
                }
            } else {
                stream.once('readable', fillAndSendWindow)
            }
        }

        socket.on('message', (msg, senderInfo) => {
            if (senderInfo.address !== rinfo.address || senderInfo.port !== rinfo.port) {
                this._sendError(socket, ErrorCode.UNKNOWN_TID, 'Unknown transfer ID', senderInfo.port, senderInfo.address)
                return
            }

            if (msg.length < 4) {
                return
            }

            const opcode = msg.readUInt16BE(0)

            if (opcode === Opcode.ERROR) {
                this.DebugHandler(`[${rinfo.address}] [${rinfo.port}] client sent error, aborting transfer`)
                cleanup()
                return
            }

            if (opcode !== Opcode.ACK) {
                this._sendError(socket, ErrorCode.ILLEGAL_OPERATION, 'Illegal TFTP operation', rinfo.port, rinfo.address)
                cleanup()
                return
            }

            const ackBlock = msg.readUInt16BE(2)

            // ACK for block 0 = OACK acknowledged, start sending data
            if (windowBase === 0 && windowChunks.length === 0 && ackBlock === 0) {
                clearTimeout(timeout)
                timeout = null
                retries = 0
                fillAndSendWindow()
                return
            }

            // Determine how many blocks this ACK covers
            const ackedCount = ((ackBlock - (windowBase & 0xFFFF)) + 0x10000) & 0xFFFF
            if (ackedCount === 0 || ackedCount > windowChunks.length) {
                return // stale or invalid ACK
            }

            clearTimeout(timeout)
            timeout = null
            retries = 0

            // Check if transfer is complete (last ACK'd chunk was shorter than blksize)
            if (windowChunks.at(ackedCount - 1).length < blksize) {
                this.LogHandler(`[${rinfo.address}] [${rinfo.port}] transfer complete (${fileSize} bytes, blksize=${blksize}, wndsize=${windowSize})`)
                cleanup()
                return
            }

            // Advance window past acknowledged blocks
            windowBase += ackedCount
            windowChunks.splice(0, ackedCount)
            fillAndSendWindow()
        })

        socket.on('error', (err) => {
            this.DebugHandler(`[${rinfo.address}] [${rinfo.port}] transfer socket error: ${err.message}`)
            cleanup()
        })

        this.openTransfers.set(transferKey, { cleanup })

        socket.bind(0, () => {
            if (hasOptions === true) {
                sendOACK()
            } else {
                fillAndSendWindow()
            }
        })
    }

    _startWriteTransfer (stream, rinfo, options, filename) {
        const socket = dgram.createSocket('udp4')
        const transferKey = ++this._lastTransferKey
        let retries = 0
        let timeout = null
        let expectedBlock = 1
        const dataChunks = this._useHdl ? [] : null

        // Negotiate options (RFC 2347/2348/2349)
        const ackOptions = new Map()
        let retransmitTimeout = TFTP_TIMEOUT

        let blksize = TFTP_DEFAULT_BLKSIZE
        if (options.has('blksize')) {
            const requested = parseInt(options.get('blksize'), 10)
            if (requested >= BLKSIZE_MIN && requested <= BLKSIZE_MAX) {
                blksize = requested
                ackOptions.set('blksize', blksize.toString())
            }
        }
        if (options.has('timeout')) {
            const requested = parseInt(options.get('timeout'), 10)
            if (requested >= 1 && requested <= 255) {
                retransmitTimeout = requested * 1000
                ackOptions.set('timeout', requested.toString())
            }
        }
        if (options.has('tsize')) {
            ackOptions.set('tsize', options.get('tsize'))
        }
        const hasOptions = ackOptions.size > 0

        const cleanup = () => {
            if (timeout !== null) {
                clearTimeout(timeout)
                timeout = null
            }
            if (stream) {
                stream.destroy()
            }
            this.openTransfers.delete(transferKey)
            try { socket.close() } catch { /* ignore */ }
        }

        const sendACK = (blockNum) => {
            const buf = Buffer.alloc(4)
            buf.writeUInt16BE(Opcode.ACK, 0)
            buf.writeUInt16BE(blockNum & 0xFFFF, 2)
            socket.send(buf, 0, buf.length, rinfo.port, rinfo.address)
        }

        const sendOACK = () => {
            const parts = []
            for (const [key, value] of ackOptions) {
                parts.push(Buffer.from(key, 'ascii'), Buffer.from([0x00]), Buffer.from(value, 'ascii'), Buffer.from([0x00]))
            }
            const payload = Buffer.concat(parts)
            const buf = Buffer.alloc(2 + payload.length)
            buf.writeUInt16BE(Opcode.OACK, 0)
            payload.copy(buf, 2)
            socket.send(buf, 0, buf.length, rinfo.port, rinfo.address)
        }

        const startTimeout = () => {
            timeout = setTimeout(() => {
                retries++
                if (retries > TFTP_MAX_RETRIES) {
                    this.DebugHandler(`[${rinfo.address}] [${rinfo.port}] write transfer timed out after ${TFTP_MAX_RETRIES} retries`)
                    cleanup()
                } else {
                    // Retransmit last ACK or OACK
                    if (expectedBlock === 1 && hasOptions) {
                        sendOACK()
                    } else {
                        sendACK(expectedBlock - 1)
                    }
                    startTimeout()
                }
            }, retransmitTimeout)
        }

        socket.on('message', async (msg, senderInfo) => {
            if (senderInfo.address !== rinfo.address || senderInfo.port !== rinfo.port) {
                this._sendError(socket, ErrorCode.UNKNOWN_TID, 'Unknown transfer ID', senderInfo.port, senderInfo.address)
                return
            }

            if (msg.length < 4) {
                return
            }

            const opcode = msg.readUInt16BE(0)

            if (opcode === Opcode.ERROR) {
                this.DebugHandler(`[${rinfo.address}] [${rinfo.port}] client sent error, aborting write transfer`)
                cleanup()
                return
            }

            if (opcode !== Opcode.DATA) {
                this._sendError(socket, ErrorCode.ILLEGAL_OPERATION, 'Illegal TFTP operation', rinfo.port, rinfo.address)
                cleanup()
                return
            }

            const blockNum = msg.readUInt16BE(2)
            const data = msg.subarray(4)

            if (blockNum !== (expectedBlock & 0xFFFF)) {
                // Duplicate or out-of-order — re-ACK last accepted block
                sendACK(expectedBlock - 1)
                return
            }

            clearTimeout(timeout)
            timeout = null
            retries = 0

            if (this._useHdl) {
                dataChunks.push(Buffer.from(data))
            } else {
                stream.write(data)
            }

            sendACK(blockNum)
            expectedBlock++

            // Final block: data length < blksize
            if (data.length < blksize) {
                if (this._useHdl) {
                    try {
                        const success = await this._opt.hdl.upload(filename, Buffer.concat(dataChunks))
                        if (success) {
                            this.LogHandler(`[${rinfo.address}] [${rinfo.port}] write transfer complete via handler`)
                        } else {
                            this.DebugHandler(`[${rinfo.address}] [${rinfo.port}] handler upload returned failure`)
                        }
                    } catch (err) {
                        this.DebugHandler(`[${rinfo.address}] [${rinfo.port}] handler upload error: ${err.message}`)
                    }
                    cleanup()
                } else {
                    stream.end(() => {
                        this.LogHandler(`[${rinfo.address}] [${rinfo.port}] write transfer complete (blksize=${blksize})`)
                        cleanup()
                    })
                }
                return
            }

            startTimeout()
        })

        socket.on('error', (err) => {
            this.DebugHandler(`[${rinfo.address}] [${rinfo.port}] write transfer socket error: ${err.message}`)
            cleanup()
        })

        this.openTransfers.set(transferKey, { cleanup })

        socket.bind(0, () => {
            if (hasOptions === true) {
                sendOACK()
            } else {
                sendACK(0)
            }
            startTimeout()
        })
    }

    _parseRequest (msg) {
        const filenameEnd = msg.indexOf(0x00, 2)
        if (filenameEnd < 0) {
            return null
        }
        const filename = msg.toString('ascii', 2, filenameEnd)

        const modeEnd = msg.indexOf(0x00, filenameEnd + 1)
        if (modeEnd < 0) {
            return null
        }
        const mode = msg.toString('ascii', filenameEnd + 1, modeEnd).toLowerCase()

        // Parse RFC 2347 options (key\0value\0 pairs after mode)
        const options = new Map()
        let pos = modeEnd + 1
        while (pos < msg.length) {
            const keyEnd = msg.indexOf(0x00, pos)
            if (keyEnd < 0) break
            const key = msg.toString('ascii', pos, keyEnd).toLowerCase()
            pos = keyEnd + 1
            const valEnd = msg.indexOf(0x00, pos)
            if (valEnd < 0) break
            options.set(key, msg.toString('ascii', pos, valEnd))
            pos = valEnd + 1
        }

        return { filename, mode, options }
    }

    _sendError (socket, errorCode, errorMessage, port, address) {
        const msgBuf = Buffer.from(errorMessage, 'ascii')
        const buf = Buffer.alloc(2 + 2 + msgBuf.length + 1)
        buf.writeUInt16BE(Opcode.ERROR, 0)
        buf.writeUInt16BE(errorCode, 2)
        msgBuf.copy(buf, 4)
        buf[4 + msgBuf.length] = 0x00
        socket.send(buf, 0, buf.length, port, address)
    }

    static _sanitize (str) {
        // eslint-disable-next-line no-control-regex
        return typeof str === 'string' ? str.replace(/[\x00-\x1F\x7F-\x9F]/g, '') : ''
    }

    _beginsWith (needle, haystack) {
        const basePath = path.resolve(needle)
        const targetPath = path.resolve(haystack)
        return targetPath === basePath || targetPath.startsWith(`${basePath}${path.sep}`)
    }

    _getPathStat (target) {
        if (!this._pathExists(target)) {
            return null
        }
        return this._statPath(target)
    }

    _isDirectory (target) {
        return Boolean(this._getPathStat(target)?.isDirectory())
    }

    /* eslint-disable security/detect-non-literal-fs-filename */
    _pathExists (target) {
        return fs.existsSync(target)
    }

    _statPath (target) {
        return fs.statSync(target)
    }

    _createDirectory (target, options) {
        return fs.mkdirSync(target, options)
    }

    _removePath (target, options) {
        return fs.rmSync(target, options)
    }

    _createReadStream (target, options) {
        return fs.createReadStream(target, options)
    }

    _createWriteStream (target, options) {
        return fs.createWriteStream(target, options)
    }
    /* eslint-enable security/detect-non-literal-fs-filename */
}

export { tftpd }
