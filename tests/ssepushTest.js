const SsePush = require('../lib/ssepush.js').SsePush;

const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;

describe("SsePush init", () => {
    const sse = new SsePush({}, {});

    it("初期化", () => {
        expect(sse.channels).have.lengthOf(0);
        expect(sse.allowedSenders).have.lengthOf(0);
        expect(sse.heartbeatInterval).equal(0);
    });

    it("デバイストークン設定", () => {
        expect(sse.setDeviceToken("TOKEN")).equal(sse);
        expect(sse.deviceToken).equal("TOKEN");
    });

    it("チャネル設定", () => {
        expect(sse.setChannels(["a","b"])).equal(sse);
        expect(sse.channels).deep.equal(["a", "b"]);
    });

    it("送信者許可設定", () => {
        expect(sse.setAllowedSenders(["g:group1","g:group2"])).equal(sse);
        expect(sse.allowedSenders).deep.equal(["g:group1","g:group2"]);
    });
    
    it("ハートビート間隔設定", () => {
        expect(sse.setHeartbeatInterval(60)).equal(sse);
        expect(sse.heartbeatInterval).equal(60);
    });
});

describe("_createRegistrationData", () => {
    const sse = new SsePush({}, {});

    it("正常に registration data が生成されること", () => {
        sse.setDeviceToken("TOKEN1");
        sse.setChannels(["c1", "c2"]);
        sse.setAllowedSenders(["g:group1","g:group2"]);
        
        const data = sse._createRegistrationData();

        expect(data._deviceToken).equal("TOKEN1");
        expect(data._channels).deep.equal(["c1", "c2"]);
        expect(data._allowedSenders).deep.equal(["g:group1","g:group2"]);
        expect(data._pushType).equal("sse");
    });
});

describe("_convertProxyOptions", () => {
    const sse = new SsePush({}, {});
    const proxy = "http://proxy.example.com:8080";

    it("Proxy未指定時は何もしないこと", () => {
        const options = {};
        sse._convertProxyOptions("xxx", options);
        expect(options).deep.equal({});
    });

    it("HTTPS接続でない場合は何もしないこと", () => {
        const options = {proxy: proxy};
        sse._convertProxyOptions("http://example.com/sse", options);
        expect(options.proxy).equal(proxy);
        expect(options).not.have.property("agent");
    });

    it("HTTPS接続時に tunnel agent が設定されること", () => {
        const options = {proxy: proxy, rejectUnauthorized: false};
        sse._convertProxyOptions("https://example.com/sse", options);

        expect(options).not.have.property("proxy");
        const agent = options.agent;
        expect(agent).not.be.null;
        expect(agent.options.proxy.host).equal("proxy.example.com");
        expect(agent.options.proxy.port).equal(8080);
        expect(agent.options.rejectUnauthorized).be.false;
        expect(agent.defaultPort).equal(443);
    })
});
