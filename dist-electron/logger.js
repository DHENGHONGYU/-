"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = getLogger;
const electron_1 = require("electron");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const MIN_LEVEL = process.env.ELECTRON_LOG_LEVEL || 'info';
let logStream = null;
function getLogStream() {
    if (logStream)
        return logStream;
    try {
        const logDir = path.join(electron_1.app.getPath('userData'), 'logs');
        fs.mkdirSync(logDir, { recursive: true });
        const logFile = path.join(logDir, 'electron-main.log');
        logStream = fs.createWriteStream(logFile, { flags: 'a' });
        return logStream;
    }
    catch {
        return null;
    }
}
function formatLog(level, module, message, data) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ' ' + JSON.stringify(data) : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${dataStr}`;
}
function getLogger(module) {
    return {
        debug(message, data) {
            if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.debug) {
                const line = formatLog('debug', module, message, data);
                console.debug(line);
                getLogStream()?.write(line + '\n');
            }
        },
        info(message, data) {
            if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.info) {
                const line = formatLog('info', module, message, data);
                console.info(line);
                getLogStream()?.write(line + '\n');
            }
        },
        warn(message, data) {
            if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.warn) {
                const line = formatLog('warn', module, message, data);
                console.warn(line);
                getLogStream()?.write(line + '\n');
            }
        },
        error(message, data) {
            if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.error) {
                const line = formatLog('error', module, message, data);
                console.error(line);
                getLogStream()?.write(line + '\n');
            }
        },
    };
}
