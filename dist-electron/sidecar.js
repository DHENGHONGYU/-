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
exports.PythonSidecar = void 0;
const node_child_process_1 = require("node:child_process");
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const net = __importStar(require("node:net"));
const electron_1 = require("electron");
const logger_1 = require("./logger");
const logger = (0, logger_1.getLogger)('sidecar');
const DEFAULT_PORTS = {
    daemon: 8765,
    embedding: 8001,
    collector: 8000,
};
const HEALTH_CHECK_INTERVAL_MS = 1500;
const HEALTH_CHECK_TIMEOUT_MS = 120_000;
const RESTART_DELAY_MS = 3000;
const MAX_RESTART_COUNT = 3;
class PythonSidecar {
    process = null;
    status = 'stopped';
    ports;
    restartCount = 0;
    logFile;
    isStopping = false;
    constructor() {
        this.ports = { ...DEFAULT_PORTS };
        const logDir = path.join(electron_1.app.getPath('userData'), 'logs');
        fs.mkdirSync(logDir, { recursive: true });
        this.logFile = path.join(logDir, 'sidecar.log');
    }
    getStatus() {
        return this.status;
    }
    getPorts() {
        return { ...this.ports };
    }
    async getHealth() {
        if (this.status !== 'running') {
            return { status: 'stopped', embeddingLoaded: false, modelId: '', ports: null };
        }
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`http://127.0.0.1:${this.ports.embedding}/api/embed/health`, {
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!res.ok) {
                return { status: 'unhealthy', embeddingLoaded: false, modelId: '', ports: this.ports };
            }
            const data = (await res.json());
            return {
                status: data.status,
                embeddingLoaded: data.model_loaded,
                modelId: data.model_id,
                ports: this.ports,
            };
        }
        catch {
            return { status: 'unreachable', embeddingLoaded: false, modelId: '', ports: this.ports };
        }
    }
    async start() {
        if (this.status === 'running' || this.status === 'starting') {
            logger.warn('Sidecar already running or starting');
            return;
        }
        this.status = 'starting';
        this.isStopping = false;
        this.ports = await this.findFreePorts();
        const mode = process.env.VITE_DEV_SERVER_URL ? 'development' : 'production';
        logger.info('Starting Python Sidecar', {
            mode,
            ports: this.ports,
            portBinding: {
                daemon: `127.0.0.1:${this.ports.daemon} (Embedding Daemon)`,
                embedding: `127.0.0.1:${this.ports.embedding} (Embedding Service)`,
                collector: `127.0.0.1:${this.ports.collector} (AKShare Collector)`,
            },
        });
        const { exe, args, cwd, env } = this.resolveSidecarPath();
        const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
        logStream.write(`\n${'='.repeat(60)}\n`);
        logStream.write(`[${new Date().toISOString()}] Starting sidecar\n`);
        logStream.write(`exe=${exe}\nargs=${args.join(' ')}\ncwd=${cwd}\n`);
        logStream.write(`${'='.repeat(60)}\n`);
        this.process = (0, node_child_process_1.spawn)(exe, args, {
            cwd,
            env: { ...process.env, ...env },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
        this.process.stdout?.on('data', (data) => {
            const text = data.toString().trim();
            if (text) {
                logStream.write(`[stdout] ${text}\n`);
                logger.debug('sidecar stdout', { text });
            }
        });
        this.process.stderr?.on('data', (data) => {
            const text = data.toString().trim();
            if (text) {
                logStream.write(`[stderr] ${text}\n`);
                logger.warn('sidecar stderr', { text });
            }
        });
        this.process.on('exit', (code, signal) => {
            logStream.write(`[${new Date().toISOString()}] Process exited: code=${code} signal=${signal}\n`);
            logStream.end();
            if (this.isStopping) {
                this.status = 'stopped';
                logger.info('Sidecar stopped gracefully');
                return;
            }
            this.status = 'error';
            logger.error('Sidecar exited unexpectedly', { code, signal, restartCount: this.restartCount });
            if (this.restartCount < MAX_RESTART_COUNT) {
                this.restartCount++;
                logger.info(`Auto-restarting in ${RESTART_DELAY_MS}ms (attempt ${this.restartCount})`);
                setTimeout(() => {
                    this.start().catch((err) => {
                        logger.error('Auto-restart failed', err);
                    });
                }, RESTART_DELAY_MS);
            }
            else {
                logger.error('Max restart count reached, giving up');
            }
        });
        this.process.on('error', (err) => {
            logStream.write(`[error] ${err.message}\n`);
            logStream.end();
            this.status = 'error';
            logger.error('Sidecar process error', err);
        });
        try {
            await this.waitForHealth();
            this.status = 'running';
            this.restartCount = 0;
            logger.info('Python Sidecar is ready');
        }
        catch (err) {
            this.status = 'error';
            logger.error('Sidecar failed to become healthy', err);
            throw err;
        }
    }
    async stop() {
        this.isStopping = true;
        if (!this.process) {
            this.status = 'stopped';
            return;
        }
        logger.info('Stopping Python Sidecar...');
        if (process.platform === 'win32' && this.process.pid) {
            try {
                (0, node_child_process_1.spawn)('taskkill', ['/pid', String(this.process.pid), '/f', '/t'], {
                    windowsHide: true,
                    stdio: 'ignore',
                });
            }
            catch (err) {
                logger.error('taskkill failed', err);
            }
        }
        else {
            this.process.kill('SIGTERM');
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }, 3000);
        }
        await new Promise((resolve) => {
            if (!this.process) {
                resolve();
                return;
            }
            const proc = this.process;
            const onExit = () => resolve();
            proc.once('exit', onExit);
            setTimeout(() => {
                proc.removeListener('exit', onExit);
                resolve();
            }, 5000);
        });
        this.process = null;
        this.status = 'stopped';
        logger.info('Python Sidecar stopped');
    }
    async restart() {
        logger.info('Restarting Python Sidecar...');
        await this.stop();
        this.isStopping = false;
        this.restartCount = 0;
        await this.start();
    }
    async findFreePorts() {
        const daemon = await this.findFreePort(DEFAULT_PORTS.daemon);
        const embedding = await this.findFreePort(DEFAULT_PORTS.embedding);
        const collector = await this.findFreePort(DEFAULT_PORTS.collector);
        return { daemon, embedding, collector };
    }
    findFreePort(startPort) {
        return new Promise((resolve) => {
            const tryPort = (port) => {
                const tester = net.createServer();
                tester.once('error', () => {
                    tryPort(port + 1);
                });
                tester.once('listening', () => {
                    tester.close(() => resolve(port));
                });
                tester.listen(port, '127.0.0.1');
            };
            tryPort(startPort);
        });
    }
    resolveSidecarPath() {
        const env = {
            SIDECAR_DAEMON_PORT: String(this.ports.daemon),
            SIDECAR_EMBEDDING_PORT: String(this.ports.embedding),
            SIDECAR_COLLECTOR_PORT: String(this.ports.collector),
            PYTHONUNBUFFERED: '1',
            PYTHONIOENCODING: 'utf-8',
        };
        if (process.env.VITE_DEV_SERVER_URL) {
            const projectRoot = path.resolve(__dirname, '..');
            const pythonExe = process.env.V9_PYTHON_EXE ?? 'python';
            const entryScript = path.join(projectRoot, 'backend', 'sidecar_entry.py');
            logger.info('[Sidecar Path] Development mode path resolution', {
                mode: 'development',
                VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL,
                V9_PYTHON_EXE: process.env.V9_PYTHON_EXE,
                __dirname,
                projectRoot,
                pythonExe,
                entryScript,
                entryScriptExists: fs.existsSync(entryScript),
            });
            return {
                exe: pythonExe,
                args: [
                    entryScript,
                    '--daemon-port', String(this.ports.daemon),
                    '--embedding-port', String(this.ports.embedding),
                    '--collector-port', String(this.ports.collector),
                ],
                cwd: projectRoot,
                env,
            };
        }
        const resourcePath = process.resourcesPath;
        const sidecarDir = path.join(resourcePath, 'v9-python-sidecar');
        const exeName = process.platform === 'win32' ? 'v9-python-sidecar.exe' : 'v9-python-sidecar';
        const exe = path.join(sidecarDir, exeName);
        logger.info('[Sidecar Path] Production mode path resolution', {
            mode: 'production',
            resourcesPath: resourcePath,
            sidecarDir,
            exe,
            exeExists: fs.existsSync(exe),
        });
        return {
            exe,
            args: [
                '--daemon-port', String(this.ports.daemon),
                '--embedding-port', String(this.ports.embedding),
                '--collector-port', String(this.ports.collector),
            ],
            cwd: sidecarDir,
            env,
        };
    }
    async waitForHealth() {
        const startTime = Date.now();
        const healthUrl = `http://127.0.0.1:${this.ports.embedding}/api/embed/health`;
        logger.info(`Waiting for sidecar health at ${healthUrl}...`);
        while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT_MS) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const res = await fetch(healthUrl, { signal: controller.signal });
                clearTimeout(timeout);
                if (res.ok) {
                    const data = (await res.json());
                    if (data.status === 'ok' || data.status === 'ready') {
                        logger.info('Sidecar health check passed');
                        return;
                    }
                }
            }
            catch {
            }
            await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
        }
        throw new Error(`Sidecar health check timed out after ${HEALTH_CHECK_TIMEOUT_MS / 1000}s`);
    }
}
exports.PythonSidecar = PythonSidecar;
