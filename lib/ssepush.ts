/*
 * NEC Mobile Backend Platform : SSE Push(Node.js) library version 7.0.0
 *
 * Copyright (C) 2014-2018, NEC Corporation.
 * All rights reserved.
 */
import Timer = NodeJS.Timer;

const Nebula = require('@nec-baas/jssdk');
const EventSource = require('./eventsource.js');
const url = require('url');

/**
 * SSE Push 受信クラス
 */
export class SsePush {
    private Nebula: any;
    private options: any;
    private channels: string[];
    private allowedSenders: string[];
    private heartbeatInterval: number;

    private deviceToken: string;
    private callback: any;
    private eventSource: any;
    private timer: Timer;

    /**
     * コンストラクタ
     * @param Nebula Nebulaインスタンス
     * @param options オプション。詳細は EventSource のマニュアル参照。
     * @constructor
     */
    constructor(Nebula: any, options: any) {
        SsePush._assertNotNull(Nebula, "Nebula");

        this.Nebula = Nebula;
        this.options = options;

        this.channels = [];
        this.allowedSenders = [];
        this.heartbeatInterval = 0;
    }

    static _assertNotNull(value: any, name: string) {
        if (value == null) {
            throw new Error(name + " must not be null");
        }
    }

    /**
     * デバイストークン（デバイス固有の識別子)をセットする。
     * UUID を使用することを推奨
     * @param deviceToken デバイストークン
     * @returns {SsePush} this
     */
    setDeviceToken(deviceToken: string) {
        SsePush._assertNotNull(deviceToken, "deviceToken");

        this.deviceToken = deviceToken;
        return this;
    }

    /**
     * 購読する channel 名の配列を指定する
     * @param channels channel名の配列
     * @returns {SsePush} this
     */
    setChannels(channels: string[]) {
        SsePush._assertNotNull(channels, "channels");

        this.channels = channels;
        return this;
    }

    /**
     * Push 送信を許可する allowedSender 名の配列を指定する
     * @param allowedSenders allowedSender名の配列
     * @returns {SsePush} this
     */
    setAllowedSenders(allowedSenders: string[]) {
        SsePush._assertNotNull(allowedSenders, "allowedSenders");

        this.allowedSenders = allowedSenders;
        return this;
    }
    
    /**
     * ハートビート間隔(秒)を指定する。
     * <p>
     * ハートビート間隔の2倍時間経過してもハートビートを受信できない場合は、
     * onError でエラー通知する。未設定時はハートビート監視しない。
     * @param interval ハートビート間隔(秒)
     * @returns {SsePush} this
     */
    setHeartbeatInterval(interval: number) {
        this.heartbeatInterval = interval;
        return this;
    }

    /**
     * SSE Push インスタレーション登録と受信を開始する。
     * callback には以下の2つのメソッドを指定すること。
     * <ul>
     *     <li>onMessage(event): メッセージ受信時に呼び出される。
     *     <li>onError(error): エラー時に呼び出される。error には status, statusText, responseText の3フィールドが設定される。
     * </ul>
     * <p>
     * 注) タイミングによっては、401 Unauthorized エラーになる場合がある。
     * (Pushサーバ側に認証情報が登録される前に接続が開始された場合)。
     * この場合はアプリケーション側でリトライする必要がある。
     * @param callback コールバック
     */
    start(callback: any) {
        SsePush._assertNotNull(callback, "callback");

        this.shutdown(); // shutdown old eventSource.

        console.log("SsePush: start");
        this.callback = callback;
        this._startRegister();
    }

    /**
     * 接続をシャットダウンする。
     * ハートビートタイマも停止する。
     */
    shutdown() {
        this._stopHeartbeatTimer();
        if (this.eventSource != null) {
            console.log("SsePush: shutdown: closing eventSource.");
            this.eventSource.close();
            this.eventSource = null;
        } else {
            console.log("SsePush: shutdown: already closed.");
        }
    }

    /**
     * BaaS サーバに対し Installation の登録を行う。
     * 登録が完了したら _startReceiver を呼び出して受信を開始する。
     * @private
     */
    _startRegister() {
        const req = new this.Nebula.HttpRequest(this.Nebula, "/push/installations");

        const data = this._createRegistrationData();

        req.setMethod("POST");
        req.setContentType("application/json");

        req.setData(data);

        req.execute()
            .then((r: any) => {
                const response = JSON.parse(r);
                const sse = response._sse;
                const uri = sse.uri;
                const username = sse.username;
                const password = sse.password;

                console.log("SsePush: Installation registered: uri=" + uri + " username=" + username);

                // TODO: 登録後時間を開けずに接続すると 401 エラーになる場合があるため、
                // ウェイトを入れる。
                setTimeout(() => {
                    this._startReceiver(uri, username, password);
                }, 3000);
            })
            .catch((err: any) => {
                console.error("SsePush: Installation register failed: " + JSON.stringify(err));
                this.callback.onError(err);
            });
    }

    _createRegistrationData() {
        SsePush._assertNotNull(this.deviceToken, "deviceToken");
        SsePush._assertNotNull(this.channels, "channels");
        SsePush._assertNotNull(this.allowedSenders, "allowedSenders");
        
        const data: any = {
            "_osType": "js",
            "_osVersion": "Unknown",
            "_deviceToken": this.deviceToken,
            "_pushType": "sse",
            "_channels": this.channels,
            "_appVersionCode": -1,
            "_appVersionString": "1.0.0",
            "_allowedSenders": this.allowedSenders
        };
        return data;
    }

    /**
     * SSE Push の受信を開始する。
     * @param uri SSE Push サーバ URI
     * @param username ユーザ名
     * @param password パスワード
     * @private
     */
    _startReceiver(uri: string, username: string, password: string) {
        console.log("SsePush: Start receiver");

        const options: any = {
            rejectUnauthorized: true // デフォルト値 (#7701 対応)
        };
        if (this.options != null) {
            Object.assign(options, this.options);
        }
        if (options.headers == null) {
            options.headers = {}
        }
        // Basic認証用のヘッダ指定
        options.headers['Authorization'] = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

        // Proxy 関連設定
        this._convertProxyOptions(uri, options);

        const eventSource = new EventSource(uri, options);
        this.eventSource = eventSource;

        eventSource.onopen = () => {
            console.log("SsePush: Connection established.");
            this.callback.onMessage("SsePush: Connection established.");
            this._restartHeartbeatTimer();
        };
        eventSource.onmessage = this.callback.onMessage;
        eventSource.onerror = this.callback.onError;
        eventSource.oncomment = () => {
            this._onHeartbeat();
        };
    }

    /**
     * Proxy オプションの変換。
     * SSE Push サーバ接続が HTTPS の場合、agent を使用するように変更する。
     * @param uri SSE Push サーバ URI
     * @param options オプション
     * @private
     */
    _convertProxyOptions(uri: string, options: any) {
        if (options.proxy == null) return; // no proxy options

        const parsedUrl = url.parse(uri);
        if (parsedUrl.protocol !== 'https:') return; // not https

        const proxyUrl = url.parse(options.proxy);
        const agentOptions: any = {
            proxy: {
                host: proxyUrl.hostname,
                port: parseInt(proxyUrl.port)
            }
        };
        if (options.rejectUnauthorized != null) {
            agentOptions.rejectUnauthorized = options.rejectUnauthorized;
        }
        const tunnel = require('tunnel-fork');
        const agent = tunnel.httpsOverHttp(agentOptions);
        agent.defaultPort = 443;

        options.agent = agent;
        delete options.proxy;
    }

    /**
     * ハートビート受信処理
     * @private
     */
    _onHeartbeat() {
        //console.log("heartbeat.");
        this._restartHeartbeatTimer()
    }

    /**
     * ハートビートタイマ設定
     * @private
     */
    _restartHeartbeatTimer() {
        this._stopHeartbeatTimer();
        if (this.heartbeatInterval <= 0) return;

        this.timer = setTimeout(() => {
            console.log("SsePush: heartbeat timer timed out, shut down.");
            this.shutdown();
            this.callback.onError({
                'type': 'error',
                'status': 500,
                'message': 'heartbeat timer timed out.'
            });
        }, this.heartbeatInterval * 2 * 1000);
    }

    /**
     * ハートビートタイマ停止
     * @private
     */
    _stopHeartbeatTimer() {
        if (this.timer != null) {
            clearTimeout(this.timer);
        }
    }

    /**
     * ユーティリティ。UUID生成。
     * @returns {string} UUID
     */
    uuid() {
        const S4 = () => {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        };
        return S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4();
    }
}
