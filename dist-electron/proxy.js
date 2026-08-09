"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProxyHandler = createProxyHandler;
exports.isDomainWhitelisted = isDomainWhitelisted;
const electron_1 = require("electron");
const logger_1 = require("./logger");
const logger = (0, logger_1.getLogger)('proxy');
const DOMAIN_WHITELIST = [
    'proxy.finance.qq.com',
    'hq.sinajs.cn',
    'push2.eastmoney.com',
    'push2his.eastmoney.com',
    'datacenter-web.eastmoney.com',
    'reportapi.eastmoney.com',
    'np-anotice-stock.eastmoney.com',
    'api.tushare.pro',
    'api.deepseek.com',
];
const LOCAL_PROXIES = {
    '/api/embed': {
        target: 'http://127.0.0.1:8001',
    },
    '/api/akshare': {
        target: 'http://127.0.0.1:8000',
        rewrite: (p) => p.replace('/api/akshare', ''),
    },
    '/api/collect': {
        target: 'http://127.0.0.1:8000',
    },
};
function createProxyHandler(_mainWindow) {
    logger.info('Setting up API proxy handlers...');
    electron_1.session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const url = details.url;
        for (const [prefix, config] of Object.entries(LOCAL_PROXIES)) {
            if (url.includes(prefix) || url.includes(prefix.replace('/api/', ''))) {
                callback({});
                return;
            }
        }
        callback({});
    });
    electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...details.responseHeaders };
        responseHeaders['access-control-allow-origin'] = ['*'];
        responseHeaders['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
        responseHeaders['access-control-allow-headers'] = ['Content-Type, Authorization'];
        callback({ responseHeaders });
    });
    logger.info('API proxy handlers set up successfully');
}
function isDomainWhitelisted(hostname) {
    return DOMAIN_WHITELIST.some((domain) => hostname === domain || hostname.endsWith('.' + domain));
}
