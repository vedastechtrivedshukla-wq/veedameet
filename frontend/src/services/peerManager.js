/**
 * PeerManager — Direct WebRTC mesh using the existing WS signaling channel.
 *
 * How it works:
 *  - When a new user joins, all existing peers send them an Offer.
 *  - The new user answers each offer, completing the handshake.
 *  - ICE candidates are trickled through the WS room broadcast.
 *  - Each remote peer gets its own RTCPeerConnection → its own MediaStream.
 *  - Audio plays automatically via hidden <audio> elements injected into DOM.
 */

const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

export class PeerManager {
    /**
     * @param {string}      myUserId      - This client's user id (as string)
     * @param {MediaStream} localStream   - The local camera/mic stream
     * @param {object}      socketService - SocketService instance (already connected)
     * @param {object}      callbacks     - { onRemoteStream(userId, stream), onRemoteStreamRemoved(userId) }
     */
    constructor(myUserId, localStream, socketService, callbacks) {
        this.myUserId = String(myUserId);
        this.localStream = localStream;
        this.socket = socketService;
        this.callbacks = callbacks;

        // Map<remoteUserId, RTCPeerConnection>
        this.peers = new Map();
        // Map<remoteUserId, HTMLAudioElement>  — keeps remote audio alive
        this.audioEls = new Map();

        this._boundOnOffer    = this._onOffer.bind(this);
        this._boundOnAnswer   = this._onAnswer.bind(this);
        this._boundOnIce      = this._onIceCandidate.bind(this);
        this._boundOnUserLeft = this._onUserLeft.bind(this);
    }

    /** Call once after creating this instance, before anyone else joins. */
    start() {
        this.socket.on("webrtc_offer",  this._boundOnOffer);
        this.socket.on("webrtc_answer", this._boundOnAnswer);
        this.socket.on("webrtc_ice",    this._boundOnIce);
        this.socket.on("user_left",     this._boundOnUserLeft);
    }

    /**
     * Call when a remote user joins (received user_joined WS event).
     * The caller (existing member) creates the offer.
     */
    async initiateCallTo(remoteUserId) {
        remoteUserId = String(remoteUserId);
        if (remoteUserId === this.myUserId) return;
        if (this.peers.has(remoteUserId)) return; // already connected

        const pc = this._createPeerConnection(remoteUserId);
        this.peers.set(remoteUserId, pc);
        this._addLocalTracks(pc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.socket.send("webrtc_offer", {
            to: remoteUserId,
            from: this.myUserId,
            sdp: offer,
        });
    }

    /** Replace a local track in all active peer connections (e.g. screen share swap). */
    async replaceLocalTrack(oldTrack, newTrack) {
        for (const pc of this.peers.values()) {
            const sender = pc.getSenders().find(s => s.track?.kind === newTrack.kind);
            if (sender) await sender.replaceTrack(newTrack);
        }
    }

    /** Tear down all connections. */
    stop() {
        for (const pc of this.peers.values()) pc.close();
        this.peers.clear();

        for (const el of this.audioEls.values()) el.remove();
        this.audioEls.clear();
    }

    // ─── Private ────────────────────────────────────────────────────────────

    _createPeerConnection(remoteUserId) {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.socket.send("webrtc_ice", {
                    to: remoteUserId,
                    from: this.myUserId,
                    candidate: e.candidate,
                });
            }
        };

        pc.ontrack = (e) => {
            console.log(`[PeerManager] Got track from ${remoteUserId}:`, e.track.kind);
            const stream = e.streams?.[0] || new MediaStream([e.track]);

            // Play audio via a hidden element — required for audio-only or mixed streams
            if (e.track.kind === "audio") {
                this._ensureAudioElement(remoteUserId, stream);
            }

            if (this.callbacks?.onRemoteStream) {
                this.callbacks.onRemoteStream(remoteUserId, stream);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[PeerManager] ${remoteUserId} →`, pc.connectionState);
            if (pc.connectionState === "failed" || pc.connectionState === "closed") {
                this._cleanupPeer(remoteUserId);
            }
        };

        return pc;
    }

    _addLocalTracks(pc) {
        if (!this.localStream) return;
        this.localStream.getTracks().forEach(track => {
            pc.addTrack(track, this.localStream);
        });
    }

    /** Creates (or reuses) a hidden <audio> element to play remote audio. */
    _ensureAudioElement(userId, stream) {
        let el = this.audioEls.get(userId);
        if (!el) {
            el = document.createElement("audio");
            el.autoplay = true;
            el.setAttribute("playsinline", "");
            el.style.display = "none";
            document.body.appendChild(el);
            this.audioEls.set(userId, el);
        }
        if (el.srcObject !== stream) {
            el.srcObject = stream;
            el.play().catch(err => console.warn("[PeerManager] Audio autoplay blocked:", err));
        }
    }

    _cleanupPeer(remoteUserId) {
        const pc = this.peers.get(remoteUserId);
        if (pc) { pc.close(); this.peers.delete(remoteUserId); }

        const el = this.audioEls.get(remoteUserId);
        if (el) { el.remove(); this.audioEls.delete(remoteUserId); }

        if (this.callbacks?.onRemoteStreamRemoved) {
            this.callbacks.onRemoteStreamRemoved(remoteUserId);
        }
    }

    // ─── WS signaling handlers ───────────────────────────────────────────────

    async _onOffer(data) {
        if (String(data.to) !== this.myUserId) return;

        const fromId = String(data.from);
        let pc = this.peers.get(fromId);
        if (!pc) {
            pc = this._createPeerConnection(fromId);
            this.peers.set(fromId, pc);
            this._addLocalTracks(pc);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.send("webrtc_answer", {
            to: fromId,
            from: this.myUserId,
            sdp: answer,
        });
    }

    async _onAnswer(data) {
        if (String(data.to) !== this.myUserId) return;

        const fromId = String(data.from);
        const pc = this.peers.get(fromId);
        if (pc && pc.signalingState !== "stable") {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
    }

    async _onIceCandidate(data) {
        if (String(data.to) !== this.myUserId) return;

        const fromId = String(data.from);
        const pc = this.peers.get(fromId);
        if (pc && data.candidate) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.warn("[PeerManager] Failed to add ICE candidate", e);
            }
        }
    }

    _onUserLeft(data) {
        this._cleanupPeer(String(data.user_id));
    }
}
