import { useEffect, useRef } from "react";
import { useMeetingStore } from "./useMeetingStore";
import { PeerManager } from "../services/peerManager";

/**
 * useWebRTC — manages direct P2P WebRTC connections using the existing
 * WebSocket signaling channel (SocketService).
 *
 * @param {string}      meetingId    - Current meeting short-id
 * @param {MediaStream} localStream  - Local camera/mic stream (null before joined)
 * @param {object}      socketService - Connected SocketService instance
 * @param {object}      user         - Current authenticated user { id, name, email }
 */
export function useWebRTC(meetingId, localStream, socketService, user) {
    const { updateParticipant, removeParticipant } = useMeetingStore();
    const peerManagerRef = useRef(null);

    // Keep a ref to the latest localStream so PeerManager can access it
    // without needing to recreate the whole connection when it changes.
    const localStreamRef = useRef(localStream);

    // Sync the ref whenever the stream changes, and push it into an existing PeerManager
    useEffect(() => {
        localStreamRef.current = localStream;
        if (peerManagerRef.current && localStream) {
            peerManagerRef.current.updateLocalStream(localStream);
        }
    }, [localStream]);

    useEffect(() => {
        // Only activate when the user has joined and we have all needed refs
        if (!meetingId || !socketService || !user) return;

        const pm = new PeerManager(
            user.id,
            localStreamRef.current, // use the ref value at creation time
            socketService,
            {
                onRemoteStream: (userId, stream) => {
                    console.log("[useWebRTC] Remote stream received from", userId);
                    updateParticipant(userId, {
                        stream,
                        isMicOn: true,
                        isVideoOn: true,
                    });
                },
                onRemoteStreamRemoved: (userId) => {
                    console.log("[useWebRTC] Remote stream removed for", userId);
                    removeParticipant(userId);
                },
            }
        );

        pm.start();
        peerManagerRef.current = pm;

        // When a new user joins the meeting room, the existing members call them
        const handleUserJoined = (data) => {
            const theirId = String(data.user_id);
            if (theirId !== String(user.id)) {
                console.log("[useWebRTC] New user joined, initiating call to", theirId);
                pm.initiateCallTo(theirId);
            }
        };

        socketService.on("user_joined", handleUserJoined);

        return () => {
            pm.stop();
            peerManagerRef.current = null;
        };
        // NOTE: localStream is intentionally excluded — we handle it via the ref above
        // to avoid tearing down all peer connections every time the stream object changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meetingId, user, socketService]);

    return { peerManagerRef };
}
