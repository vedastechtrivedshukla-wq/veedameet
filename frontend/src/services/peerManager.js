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

        this._boundOnOffer = this._onOffer.bind(this);
        this._boundOnAnswer = this._onAnswer.bind(this);
        this._boundOnIce = this._onIceCandidate.bind(this);
        this._boundOnUserLeft = this._onUserLeft.bind(this);
    }

    /** Call once after creating this instance, before anyone else joins. */
    start() {
        this.socket.on("webrtc_offer", this._boundOnOffer);
        this.socket.on("webrtc_answer", this._boundOnAnswer);
        this.socket.on("webrtc_ice", this._boundOnIce);
        this.socket.on("user_left", this._boundOnUserLeft);
    }

    /**
     * Update the local stream (e.g. when camera becomes available after PeerManager
     * was already created). Adds any missing tracks to all existing peer connections.
     */
    updateLocalStream(newStream) {
        this.localStream = newStream;
        for (const [remoteUserId, pc] of this.peers.entries()) {
            this._addLocalTracksIfMissing(pc, remoteUserId);
        }
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
        // 1. Update the persistent localStream so future peers get the new track
        if (this.localStream) {
            if (oldTrack) {
                try { this.localStream.removeTrack(oldTrack); } catch (e) { }
            }
            if (newTrack) {
                try { this.localStream.addTrack(newTrack); } catch (e) { }
            }
        }

        // 2. Replace the track in existing peer connections and renegotiate
        for (const [remoteUserId, pc] of this.peers.entries()) {
            const sender = pc.getSenders().find(s => s.track?.kind === newTrack.kind);
            if (sender) {
                try {
                    await sender.replaceTrack(newTrack);

                    // Force renegotiation to ensure remote video element receives new dimensions/codec
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    this.socket.send("webrtc_offer", {
                        to: remoteUserId,
                        from: this.myUserId,
                        sdp: offer,
                    });
                } catch (e) {
                    console.warn(`[PeerManager] Failed to replace track for ${remoteUserId}`, e);
                }
            }
        }
    }

    /** Add a local track to all active peer connections (e.g. screen share when camera was off). */
    async addLocalTrack(newTrack) {
        // 1. Initialize or update localStream
        if (!this.localStream) {
            this.localStream = new MediaStream();
        }
        try { this.localStream.addTrack(newTrack); } catch (e) { }

        // 2. Add track to existing peer connections and renegotiate
        for (const [remoteUserId, pc] of this.peers.entries()) {
            try {
                pc.addTrack(newTrack, this.localStream);

                // Force renegotiation
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                this.socket.send("webrtc_offer", {
                    to: remoteUserId,
                    from: this.myUserId,
                    sdp: offer,
                });
            } catch (e) {
                console.warn(`[PeerManager] Failed to add track for ${remoteUserId}`, e);
            }
        }
    }

    /** Tear down all connections. */
    stop() {
        for (const pc of this.peers.values()) pc.close();
        this.peers.clear();
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

            // Collect tracks in a persistent array or stream
            if (!pc._remoteStream) pc._remoteStream = new MediaStream();
            pc._remoteStream.addTrack(e.track);

            // Create a completely NEW MediaStream object so React detects the reference change
            const newStream = new MediaStream(pc._remoteStream.getTracks());
            pc._remoteStream = newStream;

            if (this.callbacks?.onRemoteStream) {
                this.callbacks.onRemoteStream(remoteUserId, newStream);
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

    /** Add all local tracks to a peer connection (skips kinds already present). */
    _addLocalTracks(pc) {
        if (!this.localStream) return;
        const existingKinds = new Set(pc.getSenders().map(s => s.track?.kind).filter(Boolean));
        this.localStream.getTracks().forEach(track => {
            if (!existingKinds.has(track.kind)) {
                pc.addTrack(track, this.localStream);
            }
        });
    }

    /**
     * Add any tracks from localStream that are not yet in the peer connection,
     * then renegotiate if new tracks were added.
     */
    async _addLocalTracksIfMissing(pc, remoteUserId) {
        if (!this.localStream) return;
        const existingKinds = new Set(pc.getSenders().map(s => s.track?.kind).filter(Boolean));
        let addedAny = false;
        this.localStream.getTracks().forEach(track => {
            if (!existingKinds.has(track.kind)) {
                pc.addTrack(track, this.localStream);
                addedAny = true;
            }
        });

        if (addedAny && pc.signalingState !== "closed") {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                this.socket.send("webrtc_offer", {
                    to: remoteUserId,
                    from: this.myUserId,
                    sdp: offer,
                });
            } catch (e) {
                console.warn(`[PeerManager] Renegotiation after late track add failed for ${remoteUserId}`, e);
            }
        }
    }

    _cleanupPeer(remoteUserId) {
        const pc = this.peers.get(remoteUserId);
        if (pc) { pc.close(); this.peers.delete(remoteUserId); }

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
        }

        // Add local tracks now. If localStream isn't ready yet, retry once after 300 ms
        // so the participant's camera also reaches the host.
        this._addLocalTracks(pc);
        if (!this.localStream) {
            setTimeout(() => {
                if (this.localStream) {
                    this._addLocalTracksIfMissing(pc, fromId);
                }
            }, 300);
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
