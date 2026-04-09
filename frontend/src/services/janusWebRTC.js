export class JanusWebRTC {
    constructor(wsUrl, roomId, localStream, callbacks) {
        this.wsUrl = wsUrl;
        this.roomId = roomId;
        this.localStream = localStream;
        this.callbacks = callbacks; // { onRemoteStream: (id, stream) => {}, onRemoteStreamRemove: (id) => {} }

        this.ws = null;
        this.sessionId = null;
        this.publisherId = null;
        this.publisherHandleId = null;
        this.publisherPc = null;

        this.subscriberHandlers = {}; // feedId -> { handleId, pc }

        this.transactionResolvers = {};
        this.isConnected = false;
    }

    _tx() {
        return Math.random().toString(36).substring(2, 15);
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    async sendTransaction(msg) {
        return new Promise((resolve, reject) => {
            const tx = this._tx();
            msg.transaction = tx;
            this.transactionResolvers[tx] = { resolve, reject, timer: setTimeout(() => reject('timeout'), 10000) };
            this.send(msg);
        });
    }

    connect() {
        this.ws = new WebSocket(this.wsUrl, 'janus-protocol');

        this.ws.onopen = async () => {
            try {
                // 1. Create Session
                const createRes = await this.sendTransaction({ janus: "create" });
                this.sessionId = createRes.data.id;

                // 2. Attach Publisher Handle
                const attachRes = await this.sendTransaction({ janus: "attach", session_id: this.sessionId, plugin: "janus.plugin.videoroom" });
                this.publisherHandleId = attachRes.data.id;

                // 3. Join as Publisher
                const joinRes = await this.sendTransaction({
                    janus: "message",
                    session_id: this.sessionId,
                    handle_id: this.publisherHandleId,
                    body: { request: "join", room: this.roomId, ptype: "publisher", display: "user" }
                });

                // Keep-alive
                this.keepAliveInterval = setInterval(() => {
                    this.send({ janus: "keepalive", session_id: this.sessionId, transaction: this._tx() });
                }, 25000);

            } catch (err) {
                console.error("Janus Publisher connect error:", err);
            }
        };

        this.ws.onmessage = async (e) => {
            const msg = JSON.parse(e.data);

            if (msg.transaction && this.transactionResolvers[msg.transaction]) {
                const resolver = this.transactionResolvers[msg.transaction];
                clearTimeout(resolver.timer);
                resolver.resolve(msg);
                delete this.transactionResolvers[msg.transaction];

                if (msg.janus !== 'ack') return; // Keep processing if it's an ack, but wait for the real event
            }

            this.handleMessage(msg);
        };

        this.ws.onclose = () => {
            this.cleanup();
        };
    }

    async handleMessage(msg) {
        if (msg.janus === "event" && msg.plugindata?.data) {
            const data = msg.plugindata.data;

            // Publisher joined -> create WebRTC offer
            if (data.videoroom === "joined") {
                this.publisherId = data.id;
                this.isConnected = true;
                await this.publishLocalStream();

                // If there are existing publishers, subscribe to them
                if (data.publishers) {
                    for (const pub of data.publishers) {
                        this.subscribeToFeed(pub.id);
                    }
                }
            }

            // New publisher joined
            if (data.videoroom === "event" && data.publishers) {
                for (const pub of data.publishers) {
                    this.subscribeToFeed(pub.id);
                }
            }

            // Publisher left
            if (data.videoroom === "event" && data.leaving && typeof data.leaving === 'number') {
                const feedId = data.leaving;
                if (this.callbacks?.onRemoteStreamRemove) {
                    this.callbacks.onRemoteStreamRemove(feedId);
                }
            }
        }

        // Handle JSEP Answers (Publisher)
        if (msg.janus === "event" && msg.jsep && msg.sender === this.publisherHandleId) {
            if (this.publisherPc) {
                await this.publisherPc.setRemoteDescription(msg.jsep);
            }
        }

        // Handle Subscriptions (Offer from Janus)
        if (msg.janus === "event" && msg.jsep && msg.plugindata?.data?.videoroom === "attached") {
            const feedId = msg.plugindata.data.id;
            const handleId = msg.sender;
            await this.handleSubscriberOffer(feedId, handleId, msg.jsep);
        }
    }

    async publishLocalStream() {
        this.publisherPc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

        this.publisherPc.onicecandidate = (e) => {
            if (e.candidate) {
                this.send({ janus: "trickle", session_id: this.sessionId, handle_id: this.publisherHandleId, candidate: e.candidate, transaction: this._tx() });
            } else {
                this.send({ janus: "trickle", session_id: this.sessionId, handle_id: this.publisherHandleId, candidate: { completed: true }, transaction: this._tx() });
            }
        };

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => this.publisherPc.addTrack(track, this.localStream));
        }

        const offer = await this.publisherPc.createOffer();
        await this.publisherPc.setLocalDescription(offer);

        await this.sendTransaction({
            janus: "message",
            session_id: this.sessionId,
            handle_id: this.publisherHandleId,
            body: { request: "configure", audio: true, video: true },
            jsep: offer
        });
    }

    async replaceLocalTrack(oldTrack, newTrack) {
        if (!this.publisherPc) return;
        const sender = this.publisherPc.getSenders().find(s => s.track && s.track.kind === newTrack.kind);
        if (sender) {
            await sender.replaceTrack(newTrack);
        }
    }

    async subscribeToFeed(feedId) {
        const attachRes = await this.sendTransaction({ janus: "attach", session_id: this.sessionId, plugin: "janus.plugin.videoroom" });
        const subHandleId = attachRes.data.id;

        this.subscriberHandlers[feedId] = { handleId: subHandleId, pc: null };

        await this.sendTransaction({
            janus: "message",
            session_id: this.sessionId,
            handle_id: subHandleId,
            body: { request: "join", room: this.roomId, ptype: "subscriber", feed: feedId }
        });
    }

    async handleSubscriberOffer(feedId, handleId, jsepOffer) {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        this.subscriberHandlers[feedId].pc = pc;

        pc.ontrack = (e) => {
            if (e.streams && e.streams[0]) {
                if (this.callbacks?.onRemoteStream) {
                    this.callbacks.onRemoteStream(feedId, e.streams[0]);
                }
            }
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.send({ janus: "trickle", session_id: this.sessionId, handle_id: handleId, candidate: e.candidate, transaction: this._tx() });
            } else {
                this.send({ janus: "trickle", session_id: this.sessionId, handle_id: handleId, candidate: { completed: true }, transaction: this._tx() });
            }
        };

        await pc.setRemoteDescription(jsepOffer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await this.sendTransaction({
            janus: "message",
            session_id: this.sessionId,
            handle_id: handleId,
            body: { request: "start", room: this.roomId },
            jsep: answer
        });
    }

    disconnect() {
        this.cleanup();
    }

    cleanup() {
        clearInterval(this.keepAliveInterval);
        if (this.publisherPc) this.publisherPc.close();
        Object.values(this.subscriberHandlers).forEach(sub => sub.pc && sub.pc.close());
        this.subscriberHandlers = {};

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send({ janus: "destroy", session_id: this.sessionId, transaction: this._tx() });
            this.ws.close();
        }
    }
}
