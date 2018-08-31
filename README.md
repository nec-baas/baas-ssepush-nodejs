NECモバイルバックエンド基盤: Node.js 用 SSE Push SDK
====================================================

NECモバイルバックエンド基盤(BaaS)の Node.js 向け SSE Push
クライアントライブラリです。

本ライブラリは Node.js 専用です。ブラウザでは利用できません。

準備
----

本ライブラリを使用するアプリケーションディレクトリ(package.jsonが存在する
ディレクトリ)に移動し、本ライブラリを npm install でインストールしてください。

    $ npm install @nec-baas/ssepush-node --save

使用方法
--------

サンプルが example/client.js にありますので、詳細はこちらを確認ください。

### インスタンスの生成

最初に、本ライブラリを require してください。
(BaaS ライブラリの require と初期化も必要です)

    const SsePush = require('@nec-baas/ssepush-node').SsePush;

以下手順で SsePush インスタンスを生成します。

    const ssePush = new SsePush(Nebula);
    // デバイストークン設定
    ssePush.setDeviceToken(deviceToken);

デバイストークンは、デバイスに固有の識別子です。UUIDなどを使用することを
推奨します(SsePush.uuid()で生成可能)。デバイストークンは同一デバイス
では原則変更しないように、適宜保存するなどしてください。

### 受信チャネル設定

受信チャネルを設定する場合は、setChannels で指定します。

    ssePush.setChannels(['channel1', 'channel2'])

### ハートビート間隔・監視設定

ハートビート間隔の設定は setHeartbeatInterval で行います。
値はサーバ側の設定に合わせてください。

    ssePush.setHeartbeatInterval(30);

ハートビート間隔の2倍の時間が経過してもハートビート受信ができない場合は、
onError でエラー通知されます。

なお、ハートビート間隔を設定しない場合は、ハートビート監視は行われません。

### 登録・受信開始

BaaSサーバへのインスタレーション登録と Push 待ち受けを開始します。
ユーザがログイン状態になっている場合は、インスタレーションは自動的にユーザ
に紐づけされます。

    // BaaSサーバへの登録と Push 待ち受けを開始
    ssePush.start({
    	onMessage: (message) => {
    		// 受信処理
    	},
    	onError: (error) => {
    		// エラー処理
    	}
    });

SSE Push メッセージを受信するたびに onMessage が呼び出されます。
引数でメッセージが渡されます。メッセージは以下のような JSON object
で、本文は "data" に格納されます。

    {
        "type": "message",
        "data": "This is a test.",
        "lastEventId": "",
        "origin": "https://baas.example.com"
    }
 
エラー時は onError が呼び出されますので、適宜回復処理を行ってください。
ステータスコードは error.status に格納されます。

オプション
---------

Proxy サーバを使用する場合は、SsePush コンストラクタの第二引数にオプション
を指定してください (注: 認証付きの Proxy は使用できません)

    const options = { proxy: 'http://proxy.example.com:8080' }
    const ssePush = new SsePush(Nebula, options);

HTTPS接続でかつサーバ側が自己署名証明書を使用している場合は、以下のオプションを指定します。
(非推奨)

    const options = { rejectUnauthorized: false }

その他のオプションについては、[EventSource](https://github.com/EventSource/eventsource)
の README を参照してください。

OSSライセンス
-------------

本モジュールは EventSource v1.0.5 を改造したものを含んでいます。
(lib/eventsource.js)
https://github.com/EventSource/eventsource

改造内容は以下のとおりです。

* oncomment コールバックを追加
* options に agent を追加

ライセンス条件は LICENSE.eventsource を参照してください。
