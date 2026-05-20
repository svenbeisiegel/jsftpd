/*
 * @package jsftpd
 * @author Sven <mailsvb@gmail.com>
 * @license https://github.com/mailsvb/jsftpd/blob/main/LICENSE MIT License
 */

import tls from 'node:tls'
import fs from 'node:fs'
import { inspect, format } from 'node:util'
import path from 'node:path'
import net from 'node:net'
import { EventEmitter } from 'node:events'

const defaultBaseFolder = path.join(import.meta.dirname, 'tmp')
const defaultCert = Buffer.from('LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFb3dJQkFBS0NBUUVBdHpOM1dKdHE5MjAzYWQ0eFRxb2hHM3hLUVdvUnJFejArd3JTUnNhZitMQTQzSWQ4CjRWUUU0elpsaEhSRVJzSGJjQkdGd0dNTEwxaGJXTWc3eDErSFhKYXlxNXJwcldTZ1g4TVRwZllkN2RUNkxRT3oKdmdBTUx3WUJwM3VkYm5IM2tyUERQazBibWRDcTZ4RmxqaUR4bHB6dWxIN1Vqb2crRE1XYmdpVHFYU2YrUThZTwpXS2xVRXhMVzZ5L3hFNUNIVVN3ZGI3MWREc2pDSG90YWliTTNXdlpGdEc3MnAvUXBaWldtZmQreEQwL3VoVnhNCnBualR0S21xWlMwcnJZM3Y1SFR5dVpBMUJRMFBVWmV0NzdLdWZKUis2aVlzQjQ4Z3NSM0szNmd6WHoyMzRXUXUKbEppcWk0dXo4Wjk1LzQyZmJOUlR3eWxRZXBQY1Ruc0Rib0Y0Q1FJREFRQUJBb0lCQVFDanR1UmlWSkVraDM5TApwbm9kdUQ5WjFwcHRGcUt3ZlIwMzhwV3pGZkVEUmtlcUc1SG5zek9pOEl1TDhITExZSlgrOGttNmdVZ1BpVUFvCmVOZWk5YVY3Z2xnc3JvVkFwSG9FMmNtSE9BZks3OWFadjRNeXVjd3BnWTZjNHdUdkcvMklKZ2pHZGhYQ1FRMWMKZi9Gbkw5MTFJTXk3K3hOc1JDaGZOWUFncjJpWTBZOUpRQndncTlJM1BWZ1RGQUtkTTBKZ1hySzhXVCtsN3NDRQpWc0kyUkVnYUxzeUxud2VmYnRwbVV0ankrbWtLemIzcnNyY1JVVmJOZjB3aEFlTG9HS01wZjVPNVUzMVNjd2xwClB2RnpHWkUyM01HbHpheGpZVVJTVmV3TFlzR2dwNTg5SDF6WmZaQVhSRWRiOEx2MGYra0I5MSthUi9Hdy9IT3gKS3ZlVXEvTVpBb0dCQU9BQkhxWWdXNmFwM3BjMjZJNVdNNURrMnJ1TnArRENQbzJUV3RRTklwTlREMEorRWt6SgpMZ1ZEK0xGVWZmNDFTQlZEbWZXR2x3cnVtajdWWGtTbjZyWmZXQUVKYTBySkljdHV3TDcxQ1Y0Q280cnFsUGlpCnhEazdhUFpYSXJBcjdaOG5UOG1kVStmcENMS1FNVUhYY0wydDI0cE85NytFVGVycVVYcGtEQXVEQW9HQkFORmUKVitZYThuVGxjVVhkbktqQVU4czJNSlhUUFZkeDlIM3BzQjNOVjJtR2lmM1h2d2F6ei9mYTg5NG5Ha3FxS2N6cwppV1BLdlR0MytVdUwxSlhWSlcwMllycHpUMlpMd2lqY3pCQlc1OGtIeU9UUGZ4UENjemh1dGlQUHJoMnQwbGJtCkR6WFpuTzJPUlpJWlp3MFllVFlNVzFUcnZ3WnRpT0VxMFp4cVVkeURBb0dBYld0K21pMmlOMll3NmZLVFpMdnMKMG5GSCsyZTF3bzkvMk01TEJ0d25zSWxaSWVUTmNaNndFVGhqcWRPWSsrencraG9jZ1pldC9sUVJHbkpGYXdvUApGK2k0NTBDL25UZGtmNmZwRlI1QzVoNHAzdmk1cmo1cjFYMFV4NGhHMUlHUXdEYUd2ZmhRL1M2UzVnNlRVUk00CjZoNmI2QktzNkd0cldEMy9jT2FnRDVzQ2dZQXpwNHdXS0dYVE0xeHIrVTRTVUVrY0pNVjk0WDBMMndDUUpCeWcKYmEzNFNnbzNoNGdJdGtwRUExQVJhaUpSYzRRV20vRVZuc3BySnFGcDR4alMwcUNHUGxuRFdIbXBhbDEveVdITApValdqWW5sTkFtaCt6b1d3MFplOFpCdTRGTStGUXdOVHJObkx2a01wMVh5WVBZYUNNREJFVmxsdDA0NW14ektwCjNZMU8wd0tCZ0FHaVkyNVZLOGJyMVFydXlzM3Vhb21LQ3BYUmhjZU15eHdBazdxeUlpNnpHeEx3bnFaVldaQmQKbkcxbkFaT2JET1JSTGRBRktPZ2tncGtVbGgrTEE3dTRuUytGWEdteGtLZlF1cTNTcTNaWHhiTjMxcXBCcERHTQoxbE9QSlVWY2UxV3ZyeXcrWVI4M1VFQ0ZTOEZjeDdibEVEM3oyNnVOQnN0dlBwVTUrV3ZxCi0tLS0tRU5EIFJTQSBQUklWQVRFIEtFWS0tLS0tCi0tLS0tQkVHSU4gQ0VSVElGSUNBVEUtLS0tLQpNSUlDNGpDQ0FjcWdBd0lCQWdJSWJqQ2hhajZDT2Iwd0RRWUpLb1pJaHZjTkFRRUxCUUF3RVRFUE1BMEdBMVVFCkF4TUdhbk5tZEhCa01DQVhEVEl3TURFd01UQXdNREF3TUZvWUR6azVPVGt4TWpNeE1qTTFPVFU1V2pBUk1ROHcKRFFZRFZRUURFd1pxYzJaMGNHUXdnZ0VpTUEwR0NTcUdTSWIzRFFFQkFRVUFBNElCRHdBd2dnRUtBb0lCQVFDMwpNM2RZbTJyM2JUZHAzakZPcWlFYmZFcEJhaEdzVFBUN0N0Skd4cC80c0RqY2gzemhWQVRqTm1XRWRFUkd3ZHR3CkVZWEFZd3N2V0Z0WXlEdkhYNGRjbHJLcm11bXRaS0Jmd3hPbDloM3QxUG90QTdPK0FBd3ZCZ0duZTUxdWNmZVMKczhNK1RSdVowS3JyRVdXT0lQR1duTzZVZnRTT2lENE14WnVDSk9wZEovNUR4ZzVZcVZRVEV0YnJML0VUa0lkUgpMQjF2dlYwT3lNSWVpMXFKc3pkYTlrVzBidmFuOUNsbGxhWjkzN0VQVCs2RlhFeW1lTk8wcWFwbExTdXRqZS9rCmRQSzVrRFVGRFE5Umw2M3ZzcTU4bEg3cUppd0hqeUN4SGNyZnFETmZQYmZoWkM2VW1LcUxpN1B4bjNuL2paOXMKMUZQREtWQjZrOXhPZXdOdWdYZ0pBZ01CQUFHalBEQTZNQXdHQTFVZEV3RUIvd1FDTUFBd0hRWURWUjBPQkJZRQpGQkRRdzE4NC91Qk5zMHlxczVqaU92dnd4TFBTTUFzR0ExVWREd1FFQXdJRjREQU5CZ2txaGtpRzl3MEJBUXNGCkFBT0NBUUVBaWdSa0draEMxeTVMendOQ0N1T0I5eUsyS2NkUGJhcm9lZGlSWVVxZmpVU2JsT3NweWFTNjEvQjgKVk9UdHZSRjBxZkJFZTVxZVhVUTRIV1JGSnRVZmQ1eisvZTRZNkJHVmR3eFJ5aktIYkVGQ3NpOFlFZDNHOTdaZwpWM1RFV08xVVlCTlJhN2tZajE2QXFDOWtXaG5WRVU3bUdRWE5nR1NJaDNNTmx5RG1RblBIdHdzS2d3cUs5VWcvCk9QVUhUNGlTa2h2OEVoTjYyUFlRaHBEaU1udWFQbUZ1bGVKbmllQnNFMTlvSVBtbWsxblRIZXRPZDg4VU1PeUEKWDFKY0ZBZXI2dmVPQkxVMUhRSEdtd1Iyalgzai83YzI3SjJFdjRQWW1rU2R2N0FYcm5LaENDeGRSblA2WDlGaApTYlEwRHBhbW5zaWFEWld4QzNuUks2LzVndXdlOHc9PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==', 'base64')

const TLSserverDefaults = {
    key: defaultCert,
    cert: defaultCert,
    honorCipherOrder: true,
    rejectUnauthorized: false
}

const FTPdefaults = {
    port: 21,
    securePort: 990,
    maxConnections: 10,
    basefolder: defaultBaseFolder,
    user: [],
    allowAnonymousFileCreate: false,
    allowAnonymousFileRetrieve: false,
    allowAnonymousFileOverwrite: false,
    allowAnonymousFileDelete: false,
    allowAnonymousFolderDelete: false,
    allowAnonymousFolderCreate: false,
    allowAnonymousLogin: false,
    minDataPort: 1024
}

const HandlerDefaults = {
    upload: async function () {},
    download: async function () {},
    list: async function () {},
    rename: async function () {}
}

const UserDefaults = {
    allowLoginWithoutPassword: false,
    allowUserFileCreate: true,
    allowUserFileRetrieve: true,
    allowUserFileOverwrite: true,
    allowUserFileDelete: true,
    allowUserFolderDelete: true,
    allowUserFolderCreate: true
}

const LoginType = Object.freeze({
    None: 0,
    Anonymous: 1,
    Password: 2,
    NoPassword: 3
})

const SocketStateAfterWrite = Object.freeze({
    Open: 0,
    End: 1
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

class ftpd extends EventEmitter {
    constructor (options) {
        super()

        // options
        this._opt = {}
        this._opt.tls = { ...TLSserverDefaults, ...options?.tls }
        this._opt.cnf = { ...FTPdefaults, ...UserDefaults, ...options?.cnf }
        this._opt.hdl = { ...HandlerDefaults, ...options?.hdl }
        this._useTLS = options && Object.keys(options).includes('tls')
        this._useHdl = options && Object.keys(options).includes('hdl')

        // checks
        if (!this._useHdl && !this._pathExists(this._opt.cnf.basefolder)) {
            if (this._opt.cnf.basefolder === defaultBaseFolder) {
                this._createDirectory(defaultBaseFolder)
            } else {
                throw new Error('Basefolder must exist')
            }
        }

        this.lastSocketKey = 0
        this.openSockets = new Map()

        // setup FTP on TCP
        this._tcp = net.createServer()
        this._tcp.on('connection', (socket) => this.Handler(this, socket))
        this._tcp.on('error', (err) => this.ErrorHandler(err))
        this._tcp.on('listening', () => {
            this.DebugHandler(`FTP server listening on ${inspect(this._tcp.address(), { showHidden: false, depth: null, breakLength: 'Infinity' })}`)
            this.emit('listen', { protocol: 'tcp', address: this._tcp.address().address.replace(/::ffff:/g, ''), port: this._tcp.address().port })
        })
        this._tcp.maxConnections = this._opt.cnf.maxConnections

        // setup FTP on TLS
        this._tls = tls.createServer(this._opt.tls)
        this._tls.on('secureConnection', (socket) => this.Handler(this, socket))
        this._tls.on('error', (err) => this.ErrorHandler(err))
        this._tls.on('listening', () => {
            this.DebugHandler(`FTP server listening on ${inspect(this._tls.address(), { showHidden: false, depth: null, breakLength: 'Infinity' })}`)
            this.emit('listen', { protocol: 'tls', address: this._tls.address().address.replace(/::ffff:/g, ''), port: this._tls.address().port })
        })
        this._tls.maxConnections = this._opt.cnf.maxConnections
    }

    start () {
        this._tcp.listen(this._opt.cnf.port)
        this._useTLS && this._tls.listen(this._opt.cnf.securePort)
    }

    stop () {
        for (const openSocket of this.openSockets.values()) {
            openSocket.destroy()
        }
        this._tcp.close()
        this._useTLS && this._tls.close()
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
            'ECONNRESET',
            'ERR_STREAM_DESTROYED',
            'ECONNREFUSED',
            'EPIPE',
            'ENOTCONN',
            'ERR_STREAM_WRITE_AFTER_END'
        ]
        if (!expectedErrorCodes.includes(err.code)) {
            console.error('error', `${_getDate()} ${inspect(err, { showHidden: false, depth: null, breakLength: 'Infinity' })}`)
        }
    }

    Handler (main, socket) {
        const remoteAddr = socket.remoteAddress.replace(/::ffff:/g, '')
        const localAddr = socket.localAddress.replace(/::ffff:/g, '')
        const connectionInfo = `[${remoteAddr}] [${socket.remotePort}]`
        const socketKey = ++main.lastSocketKey
        main.openSockets.set(socketKey, socket)
        let authenticated = false
        let isSecure = socket.encrypted || false
        let protection = false
        let username
        let basefolder = main._opt.cnf.basefolder
        let absolutePath = main._opt.cnf.basefolder
        let relativePath = '/'
        let renameFrom = ''
        let PBSZcompleted = false
        let addr = false
        let port = false
        let dataObj = {}
        let pasv = true
        let actv = false
        let ftpData = null
        let asciiOn = false
        let retrOffset = 0
        let allowFileCreate = false
        let allowFileRetrieve = false
        let allowFileOverwrite = false
        let allowFileDelete = false
        let allowFolderDelete = false
        let allowFolderCreate = false
        main.DebugHandler(`${connectionInfo} new FTP connection established`)

        const dataHandler = function (data) {
            try {
                data = data.toString()
                main.LogHandler(`${connectionInfo} < ${data.trim().replace(/^PASS\s.*$/i, 'PASS ***')}`)
                let cmd, arg
                [cmd, ...arg] = data.split(' ')
                cmd = cmd.trim()
                arg = arg.join(' ').trim()
                main.DebugHandler(`${connectionInfo} cmd[${cmd}] arg[${arg}]`)
                if (authenticated) {
                    const authenticatedHandler = authenticatedFunc.get(cmd)
                    if (authenticatedHandler) {
                        authenticatedHandler(cmd, arg)
                    } else {
                        main._writeToSocket(socket, '500', ' ', 'Command not implemented', connectionInfo, SocketStateAfterWrite.Open)
                    }
                } else {
                    const preAuthHandler = preAuthFunctions.get(cmd)
                    if (preAuthHandler) {
                        preAuthHandler(cmd, arg)
                    } else {
                        main._writeToSocket(socket, '530', ' ', 'Not logged in', connectionInfo, SocketStateAfterWrite.End)
                    }
                }
            } catch (err) {
                main._writeToSocket(socket, '550', ' ', `${err.message}`, connectionInfo, SocketStateAfterWrite.End)
            }
        }
        socket.on('data', dataHandler)
        socket.on('error', main.ErrorHandler)
        socket.on('close', () => {
            main.openSockets.delete(socketKey)
            main._informLogoff(username, remoteAddr)
            main.DebugHandler(`${connectionInfo} FTP connection closed`)
            if (ftpData) {
                ftpData.close()
            }
        })
        main._writeToSocket(socket, '220', ' ', 'Welcome', connectionInfo, SocketStateAfterWrite.Open)

        /*
         *  USER
         */
        const USER = function (cmd, arg) {
            username = arg
            const login = validateLoginType()
            switch (login) {
            case LoginType.None:
                main._writeToSocket(socket, '530', ' ', 'Not logged in', connectionInfo, SocketStateAfterWrite.Open)
                break
            case LoginType.Anonymous:
            case LoginType.Password:
                main._writeToSocket(socket, '331', ' ', `Password required for ${username}`, connectionInfo, SocketStateAfterWrite.Open)
                break
            case LoginType.NoPassword:
                authenticated = true
                main._writeToSocket(socket, '232', ' ', 'User logged in', connectionInfo, SocketStateAfterWrite.Open)
                main._informLogin(username, remoteAddr)
                break
            default:
                main._writeToSocket(socket, '331', ' ', `Password required for ${username}`, connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  PASS
         */
        const PASS = function (cmd, arg) {
            if (authenticateUser(arg)) {
                authenticated = true
                main._writeToSocket(socket, '230', ' ', 'Logged on', connectionInfo, SocketStateAfterWrite.Open)
                main._informLogin(username, remoteAddr)
            } else {
                main._writeToSocket(socket, '530', ' ', 'Username or password incorrect', connectionInfo, SocketStateAfterWrite.Open)
                socket.end()
            }
        }

        /*
         *  AUTH
         */
        const AUTH = function (cmd, arg) {
            if (arg === 'TLS' || arg === 'SSL') {
                main._writeToSocket(socket, '234', ' ', `Using authentication type ${arg}`, connectionInfo, SocketStateAfterWrite.Open)
                socket = new tls.TLSSocket(socket, { isServer: true, secureContext: tls.createSecureContext(main._opt.tls) })
                socket.on('secure', () => {
                    main.DebugHandler(`${connectionInfo} secure connection established`)
                    isSecure = socket.encrypted
                })
                socket.on('data', dataHandler)
            } else {
                main._writeToSocket(socket, '504', ' ', `Unsupported auth type ${arg}`, connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  NOOP
         */
        const NOOP = function () {
            main._writeToSocket(socket, '200', ' ', 'NOOP ok', connectionInfo, SocketStateAfterWrite.Open)
        }

        const preAuthFunctions = new Map([
            ['USER', USER],
            ['PASS', PASS],
            ['AUTH', AUTH],
            ['NOOP', NOOP]
        ])

        /*
         *  QUIT
         */
        const QUIT = function () {
            main._writeToSocket(socket, '221', ' ', 'Goodbye', connectionInfo, SocketStateAfterWrite.End)
        }

        /*
         *  PWD
         */
        const PWD = function () {
            main._writeToSocket(socket, '257', ' ', `"${relativePath}" is current directory`, connectionInfo, SocketStateAfterWrite.Open)
        }

        /*
         *  CLNT
         */
        const CLNT = function () {
            main._writeToSocket(socket, '200', ' ', 'Don\'t care', connectionInfo, SocketStateAfterWrite.Open)
        }

        /*
         *  PBSZ
         */
        const PBSZ = function (cmd, arg) {
            const size = arg
            PBSZcompleted = true
            main._writeToSocket(socket, '200', ' ', `PBSZ=${size}`, connectionInfo, SocketStateAfterWrite.Open)
        }

        /*
         *  OPTS
         */
        const OPTS = function (cmd, arg) {
            arg = arg.toLowerCase()
            if (arg === 'utf8 on') {
                main._writeToSocket(socket, '200', ' ', 'UTF8 ON', connectionInfo, SocketStateAfterWrite.Open)
            } else if (arg === 'utf8 off') {
                main._writeToSocket(socket, '200', ' ', 'UTF8 OFF', connectionInfo, SocketStateAfterWrite.Open)
            } else {
                main._writeToSocket(socket, '451', ' ', 'Not supported', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  PROT
         */
        const PROT = function (cmd, arg) {
            if (PBSZcompleted) {
                if (arg === 'C' || arg === 'P') {
                    protection = (arg === 'P')
                    main._writeToSocket(socket, '200', ' ', `Protection level is ${arg}`, connectionInfo, SocketStateAfterWrite.Open)
                } else {
                    main._writeToSocket(socket, '534', ' ', 'Protection level must be C or P', connectionInfo, SocketStateAfterWrite.Open)
                }
            } else {
                main._writeToSocket(socket, '503', ' ', 'PBSZ missing', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  FEAT
         */
        const FEAT = function () {
            const features = Array.from(preAuthFunctions.keys()).concat(Array.from(authenticatedFunc.keys())).join('\r\n ').replace('AUTH', 'AUTH TLS\r\n AUTH SSL')
            main._writeToSocket(socket, '211', '-', `Features:\r\n ${features}\r\n211 End`, connectionInfo, SocketStateAfterWrite.Open)
        }

        /*
         *  CWD
         */
        const CWD = function (cmd, arg) {
            let newPath = arg
            if (newPath.charAt(0) === '/') {
                let folder = path.join(basefolder, newPath)
                if (isValidFolder(folder) || main._useHdl) {
                    if (!folder.endsWith('/')) {
                        folder += '/'
                    }
                    if (!newPath.endsWith('/')) {
                        newPath += '/'
                    }
                    absolutePath = folder
                    relativePath = newPath
                    return main._writeToSocket(socket, '250', ' ', `CWD successful. "${relativePath}" is current directory`, connectionInfo, SocketStateAfterWrite.Open)
                }
            } else if (newPath !== '..') {
                let folder = path.join(basefolder, relativePath, newPath)
                if (isValidFolder(folder) || main._useHdl) {
                    if (!folder.endsWith('/')) {
                        folder += '/'
                    }
                    if (!newPath.endsWith('/')) {
                        newPath += '/'
                    }
                    absolutePath = folder
                    relativePath += newPath
                    return main._writeToSocket(socket, '250', ' ', `CWD successful. "${relativePath}" is current directory`, connectionInfo, SocketStateAfterWrite.Open)
                }
            } else if (newPath === '..') {
                if (relativePath !== '/') {
                    newPath = relativePath.split('/')
                    newPath.pop()
                    newPath.pop()
                    newPath = newPath.join('/') + '/'
                    const folder = path.join(basefolder, newPath)
                    if (isValidFolder(folder) || main._useHdl) {
                        absolutePath = folder
                        relativePath = newPath
                        return main._writeToSocket(socket, '250', ' ', `CWD successful. "${relativePath}" is current directory`, connectionInfo, SocketStateAfterWrite.Open)
                    }
                } else {
                    return main._writeToSocket(socket, '250', ' ', `CWD successful. "${relativePath}" is current directory`, connectionInfo, SocketStateAfterWrite.Open)
                }
            }
            return main._writeToSocket(socket, '530', ' ', 'CWD not successful', connectionInfo, SocketStateAfterWrite.Open)
        }

        /*
         *  SIZE
         */
        const SIZE = function (cmd, arg) {
            let file = arg
            if (file.charAt(0) === '/') {
                file = path.join(basefolder, file)
            } else {
                file = path.join(basefolder, relativePath, file)
            }
            if (!main._useHdl && main._beginsWith(basefolder, file)) {
                const stat = main._getPathStat(file)
                if (stat?.isFile()) {
                    return main._writeToSocket(socket, '213', ' ', `${stat.size.toString()}`, connectionInfo, SocketStateAfterWrite.Open)
                }
            }
            main._writeToSocket(socket, '550', ' ', 'File not found', connectionInfo, SocketStateAfterWrite.Open)
        }

        /*
         *  DELE
         */
        const DELE = function (cmd, arg) {
            let file = arg
            if (file.charAt(0) === '/') {
                file = path.join(basefolder, file)
            } else {
                file = path.join(basefolder, relativePath, file)
            }
            if (!main._useHdl && main._beginsWith(basefolder, file)) {
                const stat = main._getPathStat(file)
                if (stat?.isFile()) {
                    if (allowFileDelete) {
                        main._unlinkPath(file)
                        return main._writeToSocket(socket, '250', ' ', 'File deleted successfully', connectionInfo, SocketStateAfterWrite.Open)
                    }
                    return main._writeToSocket(socket, '550', ' ', 'Permission denied', connectionInfo, SocketStateAfterWrite.Open)
                }
            }
            main._writeToSocket(socket, '550', ' ', 'File not found', connectionInfo, SocketStateAfterWrite.Open)
        }

        /*
         *  RMD
         *  RMDA
         */
        const RMD = function (cmd, arg) {
            let folder = arg
            if (folder.charAt(0) === '/') {
                folder = path.join(basefolder, folder)
            } else {
                folder = path.join(basefolder, relativePath, folder)
            }
            if (!main._useHdl && allowFolderDelete && main._beginsWith(basefolder, folder)) {
                if (main._isDirectory(folder)) {
                    main._removePath(folder, { force: true, recursive: true })
                    main._writeToSocket(socket, '250', ' ', 'Folder deleted successfully', connectionInfo, SocketStateAfterWrite.Open)
                } else {
                    main._writeToSocket(socket, '550', ' ', 'Folder not found', connectionInfo, SocketStateAfterWrite.Open)
                }
            } else {
                main._writeToSocket(socket, '550', ' ', 'Permission denied', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  MKD
         */
        const MKD = function (cmd, arg) {
            let folder = arg
            if (folder.charAt(0) === '/') {
                folder = path.join(basefolder, folder)
            } else {
                folder = path.join(basefolder, relativePath, folder)
            }
            if (!main._useHdl && allowFolderCreate && main._beginsWith(basefolder, folder)) {
                if (main._isDirectory(folder)) {
                    main._writeToSocket(socket, '550', ' ', 'Folder exists', connectionInfo, SocketStateAfterWrite.Open)
                } else {
                    main._createDirectory(folder, { recursive: true })
                    main._writeToSocket(socket, '250', ' ', 'Folder created successfully', connectionInfo, SocketStateAfterWrite.Open)
                }
            } else {
                main._writeToSocket(socket, '550', ' ', 'Permission denied', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  LIST
         *  MLSD
         */
        const LIST = function (cmd) {
            dataObj.method = async function (obj) {
                if (obj.dataSocket && obj.cmdSocket && obj.absolutePath && obj.relativePath) {
                    if (asciiOn) {
                        obj.dataSocket.setEncoding('ascii')
                    }
                    let listData = ''
                    if (main._useHdl) {
                        const data = await main._opt.hdl.list(username, obj.relativePath, obj.MLSD)
                        data && (listData = data)
                    } else {
                        const read = main._readDirectory(obj.absolutePath)
                        for (const entry of read) {
                            let line
                            const file = path.join(obj.absolutePath, entry.trim())
                            const stat = main._statPath(file)
                            if (obj.MLSD) {
                                const size = stat.isDirectory() ? '' : `size=${stat.size};`
                                line = format('type=%s;modify=%s;%s %s\r\n', stat.isDirectory() ? 'dir' : 'file'
                                    , main._getDateForMLSD(stat.mtime)
                                    , size
                                    , entry.trim())
                            } else {
                                let size = stat.isDirectory() ? '0' : stat.size.toString()
                                size = new Array(14 - size.length).join(' ') + size
                                line = format('%s 1 %s %s %s %s %s\r\n', stat.isDirectory() ? 'dr--r--r--' : '-r--r--r--'
                                    , username
                                    , username
                                    , size
                                    , main._getDateForLIST(stat.mtime)
                                    , entry.trim())
                            }
                            listData += line
                        }
                    }
                    if (listData.length === 0) {
                        listData = '\r\n'
                    }
                    main.DebugHandler(`${connectionInfo} LIST response on data channel\r\n${listData}`)
                    obj.dataSocket.end(Buffer.from(listData))
                    main._writeToSocket(obj.cmdSocket, '226', ' ', `Successfully transferred "${relativePath}"`, connectionInfo, SocketStateAfterWrite.Open)
                }
            }
            dataObj.MLSD = (cmd === 'MLSD')
            dataObj.cmdSocket = socket
            dataObj.absolutePath = absolutePath
            dataObj.relativePath = relativePath
            openDataChannel(dataObj)
        }

        /*
         *  PORT
         */
        const PORT = function (cmd, arg) {
            pasv = false
            actv = false
            const cmdData = arg.split(',')
            if (cmdData.length === 6) {
                addr = `${cmdData[0]}.${cmdData[1]}.${cmdData[2]}.${cmdData[3]}`
                port = (parseInt(cmdData[4], 10) * 256) + parseInt(cmdData[5])
                actv = true
                main._writeToSocket(socket, '200', ' ', 'Port command successful', connectionInfo, SocketStateAfterWrite.Open)
            } else {
                main._writeToSocket(socket, '501', ' ', 'Port command failed', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  PASV
         */
        const PASV = function () {
            ftpData = setupDataChannel()
            pasv = false
            actv = false
            main._getDataPort((port) => {
                if (port > 0) {
                    ftpData.listen(port, () => {
                        main.DebugHandler(`${connectionInfo} listening on ${ftpData.address().port} for data connection`)
                        dataObj = {}
                        pasv = true
                        const p1 = (ftpData.address().port) / 256 | 0
                        const p2 = (ftpData.address().port) % 256
                        const pasvData = format('Entering passive mode (%s,%d,%d)', localAddr.split('.').join(','), p1, p2)
                        main._writeToSocket(socket, '227', ' ', `${pasvData}`, connectionInfo, SocketStateAfterWrite.Open)
                    })
                } else {
                    main._writeToSocket(socket, '501', ' ', 'Passive command failed', connectionInfo, SocketStateAfterWrite.Open)
                }
            })
        }

        /*
         *  EPRT
         */
        const EPRT = function (cmd, arg) {
            pasv = false
            actv = false
            const cmdData = arg.split('|')
            if (cmdData.length === 5) {
                addr = cmdData[2]
                port = parseInt(cmdData[3], 10)
                actv = true
                main._writeToSocket(socket, '200', ' ', 'Extended Port command successful', connectionInfo, SocketStateAfterWrite.Open)
            } else {
                main._writeToSocket(socket, '501', ' ', 'Extended port command failed', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  EPSV
         */
        const EPSV = function () {
            ftpData = setupDataChannel()
            pasv = false
            actv = false
            main._getDataPort((port) => {
                if (port > 0) {
                    ftpData.listen(port, () => {
                        main.DebugHandler(`${connectionInfo} listening on ${ftpData.address().port} for data connection`)
                        dataObj = {}
                        pasv = true
                        const pasvData = format('Entering extended passive mode (|||%d|)', ftpData.address().port)
                        main._writeToSocket(socket, '229', ' ', `${pasvData}`, connectionInfo, SocketStateAfterWrite.Open)
                    })
                } else {
                    main._writeToSocket(socket, '501', ' ', 'Extended passive command failed', connectionInfo, SocketStateAfterWrite.Open)
                }
            })
        }

        /*
         *  RETR
         */
        const RETR = function (cmd, arg) {
            const relativeFile = arg
            let file
            if (relativeFile.charAt(0) === '/') {
                file = path.join(basefolder, relativeFile)
            } else {
                file = path.join(basefolder, relativePath, relativeFile)
            }
            if (!allowFileRetrieve) {
                return main._writeToSocket(socket, '550', ' ', `Transfer failed "${relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
            }
            if (!main._useHdl && !main._pathExists(file)) {
                main._writeToSocket(socket, '550', ' ', 'File not found', connectionInfo, SocketStateAfterWrite.Open)
            }
            if (((main._getPathStat(file)?.isFile()) || main._useHdl) && main._beginsWith(basefolder, file)) {
                dataObj.method = async function (obj) {
                    if (obj.dataSocket && obj.cmdSocket && obj.file && obj.relativeFile) {
                        asciiOn && obj.dataSocket.setEncoding('ascii')
                        if (main._useHdl) {
                            const data = await main._opt.hdl.download(username, relativePath, obj.fileName, retrOffset)
                            retrOffset = 0
                            if (Buffer.isBuffer(data)) {
                                obj.dataSocket.end(data)
                                main._writeToSocket(obj.cmdSocket, '226', ' ', `Successfully transferred "${obj.relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                            } else {
                                obj.dataSocket.end()
                                main._writeToSocket(obj.cmdSocket, '550', ' ', `Transfer failed "${relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                            }
                        } else {
                            const streamOpts = {
                                flags: 'r',
                                start: retrOffset,
                                encoding: asciiOn ? 'ascii' : null,
                                autoClose: true,
                                emitClose: true
                            }
                            retrOffset = 0
                            const stream = main._createReadStream(obj.file, streamOpts)
                            stream.on('error', main.ErrorHandler)
                            stream.on('open', () => {
                                obj.dataSocket.on('close', () => {
                                    if (!obj.dataSocket.destroyed) {
                                        stream.destroy()
                                        main._writeToSocket(obj.cmdSocket, '426', ' ', `Connection closed. Aborted transfer of "${obj.relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                                    }
                                })
                                stream.pipe(obj.dataSocket)
                            })
                            stream.on('end', () => {
                                obj.dataSocket.end()
                                main._writeToSocket(obj.cmdSocket, '226', ' ', `Successfully transferred "${obj.relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                            })
                        }
                    }
                }
                dataObj.cmdSocket = socket
                dataObj.file = file
                dataObj.fileName = path.basename(file)
                dataObj.relativeFile = relativeFile
                openDataChannel(dataObj)
            }
        }

        /*
         *  REST
         */
        const REST = function (cmd, arg) {
            const offset = parseInt(arg, 10)
            if (offset > -1) {
                retrOffset = offset
                main._writeToSocket(socket, '350', ' ', `Restarting at ${retrOffset}`, connectionInfo, SocketStateAfterWrite.Open)
            } else {
                retrOffset = 0
                main._writeToSocket(socket, '550', ' ', 'Wrong restart offset', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  STOR
         */
        const STOR = function (cmd, arg) {
            const relativeFile = arg
            let file
            if (relativeFile.charAt(0) === '/') {
                file = path.join(basefolder, relativeFile)
            } else {
                file = path.join(basefolder, relativePath, relativeFile)
            }
            const fileExists = main._pathExists(file)
            if (fileExists && !allowFileOverwrite) {
                return main._writeToSocket(socket, '550', ' ', 'File already exists', connectionInfo, SocketStateAfterWrite.Open)
            }
            if (!fileExists && !allowFileCreate) {
                return main._writeToSocket(socket, '550', ' ', `Transfer failed "${relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
            }
            if (main._beginsWith(basefolder, file)) {
                dataObj.cmdSocket = socket
                dataObj.file = file
                dataObj.fileName = path.basename(file)
                dataObj.relativeFile = relativeFile
                dataObj.method = function (obj) {
                    if (obj.dataSocket && obj.cmdSocket && obj.relativeFile) {
                        if (asciiOn) {
                            obj.dataSocket.setEncoding('ascii')
                        }
                        if (main._useHdl) {
                            const data = []
                            obj.dataSocket.on('data', (d) => data.push(d))
                            obj.dataSocket.on('close', async () => {
                                const success = await main._opt.hdl.upload(username, relativePath, obj.fileName, Buffer.concat(data), obj.retrOffset)
                                if (success) {
                                    main._writeToSocket(obj.cmdSocket, '226', ' ', `Successfully transferred "${obj.relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                                } else {
                                    main._writeToSocket(obj.cmdSocket, '550', ' ', `Transfer failed "${relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                                }
                            })
                        } else if (obj.stream) {
                            obj.dataSocket.on('close', () => {
                                obj.stream.destroy()
                                main._writeToSocket(obj.cmdSocket, '226', ' ', `Successfully transferred "${obj.relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                            })
                            obj.dataSocket.pipe(obj.stream)
                        }
                    }
                }
                if (main._useHdl) {
                    dataObj.retrOffset = retrOffset
                    retrOffset = 0
                    openDataChannel(dataObj)
                } else {
                    const streamOpts = {
                        flags: retrOffset > 0 ? 'a+' : 'w',
                        start: retrOffset,
                        encoding: asciiOn ? 'ascii' : null,
                        autoClose: true,
                        emitClose: true
                    }
                    retrOffset = 0
                    const stream = main._createWriteStream(file, streamOpts)
                    stream.on('error', main.ErrorHandler)
                    stream.on('open', () => {
                        dataObj.stream = stream
                        openDataChannel(dataObj)
                    })
                    stream.on('end', () => {
                        if (dataObj.dataSocket) {
                            dataObj.dataSocket.end()
                        }
                        main._writeToSocket(socket, '550', ' ', `Transfer failed "${relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                    })
                }
            } else {
                main._writeToSocket(socket, '550', ' ', `Transfer failed "${relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  SYST
         */
        const SYST = function () {
            main._writeToSocket(socket, '215', ' ', 'UNIX', connectionInfo, SocketStateAfterWrite.Open)
        }

        /*
         *  TYPE
         */
        const TYPE = function (cmd, arg) {
            if (arg === 'A') {
                asciiOn = true
                main._writeToSocket(socket, '200', ' ', 'Type set to ASCII', connectionInfo, SocketStateAfterWrite.Open)
            } else {
                asciiOn = false
                main._writeToSocket(socket, '200', ' ', 'Type set to BINARY', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  RNFR
         */
        const RNFR = function (cmd, arg) {
            const relativeFile = arg
            let file
            if (relativeFile.charAt(0) === '/') {
                file = path.join(basefolder, relativeFile)
            } else {
                file = path.join(basefolder, relativePath, relativeFile)
            }
            if (((main._getPathStat(file)?.isFile()) || main._useHdl) && main._beginsWith(basefolder, file)) {
                renameFrom = file
                main._writeToSocket(socket, '350', ' ', 'File exists', connectionInfo, SocketStateAfterWrite.Open)
            } else {
                main._writeToSocket(socket, '550', ' ', 'File does not exist', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  RNTO
         */
        const RNTO = async function (cmd, arg) {
            const relativeFile = arg
            let file
            if (relativeFile.charAt(0) === '/') {
                file = path.join(basefolder, relativeFile)
            } else {
                file = path.join(basefolder, relativePath, relativeFile)
            }
            if (!main._useHdl && !main._pathExists(file) && main._beginsWith(basefolder, file)) {
                main._renamePath(renameFrom, file)
                renameFrom = ''
                main._writeToSocket(socket, '250', ' ', 'File renamed successfully', connectionInfo, SocketStateAfterWrite.Open)
            } else if (main._useHdl) {
                const success = await main._opt.hdl.rename(username, relativePath, path.basename(renameFrom), relativeFile)
                renameFrom = ''
                if (success) {
                    main._writeToSocket(socket, '250', ' ', 'File renamed successfully', connectionInfo, SocketStateAfterWrite.Open)
                } else {
                    main._writeToSocket(socket, '550', ' ', 'File rename failed', connectionInfo, SocketStateAfterWrite.Open)
                }
            } else {
                main._writeToSocket(socket, '550', ' ', 'File already exists', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  MODE
         */
        const MODE = function (cmd, arg) {
            if (arg.toUpperCase() === 'S') {
                main._writeToSocket(socket, '200', ' ', 'Mode set to Stream', connectionInfo, SocketStateAfterWrite.Open)
            } else {
                main._writeToSocket(socket, '504', ' ', 'Only stream mode is supported', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  STRU
         */
        const STRU = function (cmd, arg) {
            if (arg.toUpperCase() === 'F') {
                main._writeToSocket(socket, '200', ' ', 'Structure set to File', connectionInfo, SocketStateAfterWrite.Open)
            } else {
                main._writeToSocket(socket, '504', ' ', 'Only file structure is supported', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  ABOR
         */
        const ABOR = function () {
            if (dataObj.dataSocket && !dataObj.dataSocket.destroyed) {
                dataObj.dataSocket.destroy()
                main._writeToSocket(socket, '426', ' ', 'Connection closed; transfer aborted', connectionInfo, SocketStateAfterWrite.Open)
            }
            main._writeToSocket(socket, '226', ' ', 'Abort successful', connectionInfo, SocketStateAfterWrite.Open)
        }

        /*
         *  CDUP
         */
        const CDUP = function (cmd) {
            CWD(cmd, '..')
        }

        /*
         *  APPE
         */
        const APPE = function (cmd, arg) {
            const relativeFile = arg
            let file
            if (relativeFile.charAt(0) === '/') {
                file = path.join(basefolder, relativeFile)
            } else {
                file = path.join(basefolder, relativePath, relativeFile)
            }
            const fileExists = main._pathExists(file)
            if (fileExists && !allowFileOverwrite) {
                return main._writeToSocket(socket, '550', ' ', 'File already exists', connectionInfo, SocketStateAfterWrite.Open)
            }
            if (!fileExists && !allowFileCreate) {
                return main._writeToSocket(socket, '550', ' ', `Transfer failed "${relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
            }
            if (main._beginsWith(basefolder, file)) {
                dataObj.cmdSocket = socket
                dataObj.file = file
                dataObj.fileName = path.basename(file)
                dataObj.relativeFile = relativeFile
                dataObj.method = function (obj) {
                    if (obj.dataSocket && obj.cmdSocket && obj.relativeFile) {
                        if (asciiOn) {
                            obj.dataSocket.setEncoding('ascii')
                        }
                        if (main._useHdl) {
                            const data = []
                            obj.dataSocket.on('data', (d) => data.push(d))
                            obj.dataSocket.on('close', async () => {
                                const success = await main._opt.hdl.upload(username, relativePath, obj.fileName, Buffer.concat(data), 0)
                                if (success) {
                                    main._writeToSocket(obj.cmdSocket, '226', ' ', `Successfully transferred "${obj.relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                                } else {
                                    main._writeToSocket(obj.cmdSocket, '550', ' ', `Transfer failed "${relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                                }
                            })
                        } else if (obj.stream) {
                            obj.dataSocket.on('close', () => {
                                obj.stream.destroy()
                                main._writeToSocket(obj.cmdSocket, '226', ' ', `Successfully transferred "${obj.relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                            })
                            obj.dataSocket.pipe(obj.stream)
                        }
                    }
                }
                if (main._useHdl) {
                    openDataChannel(dataObj)
                } else {
                    const stream = main._createWriteStream(file, {
                        flags: 'a',
                        encoding: asciiOn ? 'ascii' : null,
                        autoClose: true,
                        emitClose: true
                    })
                    stream.on('error', main.ErrorHandler)
                    stream.on('open', () => {
                        dataObj.stream = stream
                        openDataChannel(dataObj)
                    })
                    stream.on('end', () => {
                        if (dataObj.dataSocket) {
                            dataObj.dataSocket.end()
                        }
                        main._writeToSocket(socket, '550', ' ', `Transfer failed "${relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
                    })
                }
            } else {
                main._writeToSocket(socket, '550', ' ', `Transfer failed "${relativeFile}"`, connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  STAT
         */
        const STAT = function (cmd, arg) {
            if (arg) {
                let target
                if (arg.charAt(0) === '/') {
                    target = path.join(basefolder, arg)
                } else {
                    target = path.join(basefolder, relativePath, arg)
                }
                if (!main._useHdl && main._beginsWith(basefolder, target)) {
                    const stat = main._getPathStat(target)
                    if (!stat) {
                        return main._writeToSocket(socket, '450', ' ', 'File not found', connectionInfo, SocketStateAfterWrite.Open)
                    }
                    const entry = path.basename(target)
                    let size = stat.isDirectory() ? '0' : stat.size.toString()
                    size = new Array(14 - size.length).join(' ') + size
                    const line = format('%s 1 %s %s %s %s %s',
                        stat.isDirectory() ? 'dr--r--r--' : '-r--r--r--',
                        username, username, size,
                        main._getDateForLIST(stat.mtime), entry)
                    main._writeToSocket(socket, '213', '-', `Status:\r\n ${line}\r\n213 End`, connectionInfo, SocketStateAfterWrite.Open)
                } else {
                    main._writeToSocket(socket, '450', ' ', 'File not found', connectionInfo, SocketStateAfterWrite.Open)
                }
            } else {
                main._writeToSocket(socket, '211', '-', `Status:\r\n Connected to ${remoteAddr}\r\n Logged in as ${username}\r\n TYPE: ${asciiOn ? 'ASCII' : 'BINARY'}\r\n211 End`, connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        /*
         *  MDTM
         */
        const MDTM = function (cmd, arg) {
            let file = arg
            if (file.charAt(0) === '/') {
                file = path.join(basefolder, file)
            } else {
                file = path.join(basefolder, relativePath, file)
            }
            if (!main._useHdl && main._beginsWith(basefolder, file)) {
                const stat = main._getPathStat(file)
                if (stat?.isFile()) {
                    const mtime = stat.mtime
                    return main._writeToSocket(socket, '213', ' ', main._getDateForMLSD(mtime), connectionInfo, SocketStateAfterWrite.Open)
                }
            }
            main._writeToSocket(socket, '550', ' ', 'File not found', connectionInfo, SocketStateAfterWrite.Open)
        }

        /*
         *  MFMT
         */
        const MFMT = function (cmd, arg) {
            let time, file
            [time, file] = arg.split(' ')
            if (file.charAt(0) === '/') {
                file = path.join(basefolder, file)
            } else {
                file = path.join(basefolder, relativePath, file)
            }
            if (!main._useHdl && main._beginsWith(basefolder, file)) {
                const stat = main._getPathStat(file)
                if (stat?.isFile()) {
                    const mtime = main._getDateForMFMT(time)
                    main._updateTimes(file, mtime, mtime)
                    return main._writeToSocket(socket, '253', ' ', 'Date/time changed okay', connectionInfo, SocketStateAfterWrite.Open)
                }
                return main._writeToSocket(socket, '550', ' ', 'File does not exist', connectionInfo, SocketStateAfterWrite.Open)
            } else if (main._useHdl) {
                main._writeToSocket(socket, '253', ' ', 'Date/time changed okay', connectionInfo, SocketStateAfterWrite.Open)
            } else {
                main._writeToSocket(socket, '550', ' ', 'File does not exist', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        const authenticatedFunc = new Map([
            ['QUIT', QUIT],
            ['PWD', PWD],
            ['CLNT', CLNT],
            ['PBSZ', PBSZ],
            ['OPTS', OPTS],
            ['PROT', PROT],
            ['FEAT', FEAT],
            ['CWD', CWD],
            ['SIZE', SIZE],
            ['DELE', DELE],
            ['RMD', RMD],
            ['RMDA', RMD],
            ['MKD', MKD],
            ['LIST', LIST],
            ['MLSD', LIST],
            ['PORT', PORT],
            ['PASV', PASV],
            ['EPRT', EPRT],
            ['EPSV', EPSV],
            ['RETR', RETR],
            ['REST', REST],
            ['STOR', STOR],
            ['APPE', APPE],
            ['SYST', SYST],
            ['TYPE', TYPE],
            ['RNFR', RNFR],
            ['RNTO', RNTO],
            ['MFMT', MFMT],
            ['MDTM', MDTM],
            ['NOOP', NOOP],
            ['MODE', MODE],
            ['STRU', STRU],
            ['ABOR', ABOR],
            ['CDUP', CDUP],
            ['STAT', STAT]
        ])

        const validateLoginType = function () {
            let login = LoginType.None
            if (username === 'anonymous' && main._opt.cnf.allowAnonymousLogin) {
                login = LoginType.Anonymous
            } else if (main._opt.cnf.user.length > 0) {
                for (const userEntry of main._opt.cnf.user) {
                    const u = { ...UserDefaults, ...userEntry }
                    if (typeof u === 'object' && username === u.username) {
                        if (Object.hasOwn(u, 'allowLoginWithoutPassword') && u.allowLoginWithoutPassword) {
                            setUserRights(u)
                            login = LoginType.NoPassword
                        } else {
                            login = LoginType.Password
                        }
                        break
                    }
                }
            } else if (username === main._opt.cnf.username) {
                if (main._opt.cnf.allowLoginWithoutPassword) {
                    setUserRights(main._opt.cnf)
                    login = LoginType.NoPassword
                } else {
                    login = LoginType.Password
                }
            }
            return login
        }

        const authenticateUser = function (password) {
            let success = false
            if (username === 'anonymous' && main._opt.cnf.allowAnonymousLogin) {
                allowFileCreate = main._opt.cnf.allowAnonymousFileCreate
                allowFileRetrieve = main._opt.cnf.allowAnonymousFileRetrieve
                allowFileOverwrite = main._opt.cnf.allowAnonymousFileOverwrite
                allowFileDelete = main._opt.cnf.allowAnonymousFileDelete
                allowFolderDelete = main._opt.cnf.allowAnonymousFolderDelete
                allowFolderCreate = main._opt.cnf.allowAnonymousFolderCreate
                success = true
            } else if (main._opt.cnf.user.length > 0) {
                for (const userEntry of main._opt.cnf.user) {
                    const u = { ...UserDefaults, ...userEntry }
                    if (typeof u === 'object' && username === u.username && (u.allowLoginWithoutPassword || password === u.password)) {
                        setUserRights(u)
                        success = true
                        break
                    }
                }
            } else if (username === main._opt.cnf.username && (main._opt.cnf.allowLoginWithoutPassword || password === main._opt.cnf.password)) {
                setUserRights(main._opt.cnf)
                success = true
            }
            main.DebugHandler(`${connectionInfo} authenticateUser success[${success}] username[${username}]`)
            return success
        }

        const setUserRights = function (obj) {
            if (Object.hasOwn(obj, 'basefolder') && main._isDirectory(obj.basefolder)) {
                basefolder = obj.basefolder
                absolutePath = obj.basefolder
            }
            Object.hasOwn(obj, 'allowUserFileCreate') && (allowFileCreate = obj.allowUserFileCreate)
            Object.hasOwn(obj, 'allowUserFileRetrieve') && (allowFileRetrieve = obj.allowUserFileRetrieve)
            Object.hasOwn(obj, 'allowUserFileOverwrite') && (allowFileOverwrite = obj.allowUserFileOverwrite)
            Object.hasOwn(obj, 'allowUserFileDelete') && (allowFileDelete = obj.allowUserFileDelete)
            Object.hasOwn(obj, 'allowUserFolderDelete') && (allowFolderDelete = obj.allowUserFolderDelete)
            Object.hasOwn(obj, 'allowUserFolderCreate') && (allowFolderCreate = obj.allowUserFolderCreate)
        }

        const setupDataChannel = function () {
            if (ftpData) {
                ftpData.close()
            }
            let dataChannel
            if (isSecure && protection) {
                dataChannel = tls.Server(main._opt.tls)
                dataChannel.on('secureConnection', (pasvSocket) => {
                    pasvSocket.on('error', main.ErrorHandler)
                    pasvSocket.setTimeout(5000)
                    pasvSocket.on('timeout', () => {
                        pasvSocket.destroy()
                    })
                    main.DebugHandler(`${connectionInfo} data connection established`)
                    dataObj.dataSocket = pasvSocket
                    if (dataObj.method) {
                        dataObj.method(dataObj)
                    }
                })
            } else {
                dataChannel = net.Server()
                dataChannel.on('connection', (pasvSocket) => {
                    pasvSocket.on('error', main.ErrorHandler)
                    pasvSocket.setTimeout(5000)
                    pasvSocket.on('timeout', () => {
                        pasvSocket.destroy()
                    })
                    pasvSocket.on('close', () => main.DebugHandler(`${connectionInfo} data connection has been closed`))
                    if (isSecure === true && protection === true) {
                        pasvSocket = new tls.TLSSocket(pasvSocket, { isServer: true, secureContext: tls.createSecureContext(main._opt.tls) })
                        pasvSocket.on('secure', () => {
                            main.DebugHandler(`${connectionInfo} data connection is secure`)
                            dataObj.dataSocket = pasvSocket
                            if (dataObj.method) {
                                dataObj.method(dataObj)
                            }
                        })
                    } else {
                        dataObj.dataSocket = pasvSocket
                        if (dataObj.method) {
                            dataObj.method(dataObj)
                        }
                    }
                    main.DebugHandler(`${connectionInfo} data connection established`)
                })
            }
            dataChannel.on('error', main.ErrorHandler)
            dataChannel.maxConnections = 1
            return dataChannel
        }

        const openDataChannel = function (obj) {
            if (actv || pasv) {
                main._writeToSocket(socket, '150', ' ', 'Opening data channel', connectionInfo, SocketStateAfterWrite.Open)
                if (actv) {
                    main.DebugHandler(`${connectionInfo} openDataChannel isSecure[${isSecure}] protection[${protection}] addr[${addr}] port[${port}]`)
                    const client = net.connect(port, addr, () => {
                        if (isSecure && protection) {
                            const activeSocket = new tls.TLSSocket(client, { isServer: true, secureContext: tls.createSecureContext(main._opt.tls) })
                            activeSocket.on('secure', () => {
                                main.DebugHandler(`${connectionInfo} data connection is secure`)
                                dataObj.dataSocket = activeSocket
                                dataObj.method(dataObj)
                            })
                            activeSocket.on('error', main.ErrorHandler)
                        } else {
                            obj.dataSocket = client
                            obj.method(obj)
                        }
                    })
                    client.setTimeout(5000)
                    client.on('timeout', () => {
                        client.destroy()
                    })
                    client.on('error', main.ErrorHandler)
                } else {
                    obj.method(obj)
                }
            } else {
                main._writeToSocket(socket, '501', ' ', 'Command failed', connectionInfo, SocketStateAfterWrite.Open)
            }
        }

        const isValidFolder = function (folder) {
            return main._isDirectory(folder) && main._beginsWith(basefolder, folder)
        }
    }

    _informLogin (username, remoteAddr) {
        this.emit('login', { user: username, address: remoteAddr, total: this.openSockets.size })
    }

    _informLogoff (username, remoteAddr) {
        this.emit('logoff', { user: username, address: remoteAddr, total: this.openSockets.size })
    }

    _writeToSocket (socket, code, delimiter, message, connectionInfo, socketState) {
        this.LogHandler(`${connectionInfo} > ${code}${delimiter}${message}`)
        socket.writable && socket.write(Buffer.from(`${code}${delimiter}${message}\r\n`))
        socketState === SocketStateAfterWrite.End && socket.end()
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

    _unlinkPath (target) {
        return fs.unlinkSync(target)
    }

    _readDirectory (target) {
        return fs.readdirSync(target)
    }

    _createReadStream (target, options) {
        return fs.createReadStream(target, options)
    }

    _createWriteStream (target, options) {
        return fs.createWriteStream(target, options)
    }

    _renamePath (fromPath, toPath) {
        return fs.renameSync(fromPath, toPath)
    }

    _updateTimes (target, atime, mtime) {
        return fs.utimesSync(target, atime, mtime)
    }
    /* eslint-enable security/detect-non-literal-fs-filename */

    _getDataPort (resolve) {
        const config = this._opt.cnf
        if (config.minDataPort > 0 && config.minDataPort < 65535) {
            const testPort = function (port) {
                const server = net.createServer()
                server.once('error', function () {
                    if (port >= (config.minDataPort + config.maxConnections)) {
                        resolve(0)
                    } else {
                        testPort(port + 1)
                    }
                })
                server.once('listening', function () {
                    server.close()
                })
                server.once('close', function () {
                    resolve(port)
                })
                server.listen(port)
            }
            testPort(config.minDataPort)
        } else {
            resolve(0)
        }
    }

    _getDateForLIST (mtime) {
        const shortMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const now = new Date(mtime)
        const MM = shortMonth[now.getMonth()]
        const DD = now.getDate().toString().padStart(2, '0')
        const H = now.getHours().toString().padStart(2, '0')
        const M = now.getMinutes().toString().padStart(2, '0')
        return `${MM} ${DD} ${H}:${M}`
    }

    _getDateForMLSD (mtime) {
        const now = new Date(mtime)
        const MM = (now.getMonth() + 1).toString().padStart(2, '0')
        const DD = now.getDate().toString().padStart(2, '0')
        const H = now.getHours().toString().padStart(2, '0')
        const M = now.getMinutes().toString().padStart(2, '0')
        const S = now.getSeconds().toString().padStart(2, '0')
        return `${now.getFullYear()}${MM}${DD}${H}${M}${S}`
    }

    _getDateForMFMT (time) {
        const Y = time.substring(0, 4)
        const M = time.substring(4, 6)
        const D = time.substring(6, 8)
        const Hrs = time.substring(8, 10)
        const Min = time.substring(10, 12)
        const Sec = time.substring(12, 14)
        return (Date.parse(`${Y}-${M}-${D}T${Hrs}:${Min}:${Sec}+00:00`) / 1000)
    }
}

export { ftpd }
