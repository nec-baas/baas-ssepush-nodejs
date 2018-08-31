const Nebula = require('@nec-baas/jssdk').Nebula;
const SsePush = require('../lib/ssepush.js').SsePush;
//const SsePush = require('baas-ssepush-nodejs').SsePush;

const config = require('./config.js');
const proxy = config.proxy;

// BaaS 初期化
if (proxy != null) {
    Nebula.setHttpProxy(proxy);
    Nebula.setHttpsProxy(proxy);
}
Nebula.initialize(config);

// SSE Push インスタンス生成
const options = {};
if (proxy != null) {
    options.proxy = "http://" + proxy.host + ":" + proxy.port;
}
const ssePush = new SsePush(Nebula, options);

// デバイストークン設定
ssePush.setDeviceToken(config.deviceToken);

// ハートビート間隔設定
ssePush.setHeartbeatInterval(30);

// 登録・受信開始
console.log("Start connect: deviceToken = " + config.deviceToken);
ssePush.start({
    onMessage: (message) => {
        console.log("push message: " + JSON.stringify(message));
    },
    onError: (error) => {
        console.log("ERROR: " + JSON.stringify(error));
    }
});



