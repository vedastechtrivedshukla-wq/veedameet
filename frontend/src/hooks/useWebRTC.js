import { useEffect, useRef, useState } from "react";
import { useMeetingStore } from "./useMeetingStore";
import { JanusWebRTC } from "../services/janusWebRTC";
import axios from "axios";

export function useWebRTC(meetingId, localStream) {
    const { addParticipant, removeParticipant } = useMeetingStore();
    const [isConnected, setIsConnected] = useState(false);

    const janusWsUrl = import.meta.env.VITE_JANUS_WS_URL || "ws://localhost:8188/";
    const janusApiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

    // Expose the ref itself — NOT .current — so callers always get the live instance
    const webrtcRef = useRef(null);

    // NOTE: `localStream` is intentionally NOT in the dep array.
    // We only initialize Janus once per meeting join. Track swaps happen via
    // replaceLocalTrack() on the existing connection, not by re-initializing.
    useEffect(() => {
        if (!localStream || !meetingId) return;

        let isActive = true;

        async function initWebRTC() {
            try {
                // 1. Fetch meeting info to get the janus_room_id
                const token = localStorage.getItem("token");
                const res = await axios.get(`${janusApiUrl}/meetings/${meetingId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const dbMeeting = res.data;
                const roomId = dbMeeting.janus_room_id;

                if (!roomId) {
                    throw new Error("Meeting does not have a Janus Room ID provisioned");
                }

                if (!isActive) return;

                // 2. Instantiate and connect JanusWebRTC client
                webrtcRef.current = new JanusWebRTC(janusWsUrl, roomId, localStream, {
                    onRemoteStream: (feedId, stream) => {
                        console.log("Received remote stream for feed", feedId);
                        addParticipant({
                            id: feedId,
                            name: `User ${feedId}`,
                            stream: stream,
                            isMicOn: true,
                            isVideoOn: true
                        });
                    },
                    onRemoteStreamRemove: (feedId) => {
                        console.log("Remote feed left", feedId);
                        removeParticipant(feedId);
                    }
                });

                webrtcRef.current.connect();

                // Poll connection status
                const checkInterval = setInterval(() => {
                    if (webrtcRef.current && webrtcRef.current.isConnected !== isConnected) {
                        setIsConnected(webrtcRef.current.isConnected);
                    }
                }, 500);

                return () => clearInterval(checkInterval);

            } catch (err) {
                console.error("WebRTC initialization failed", err);
            }
        }

        const cleanupPromise = initWebRTC();

        return () => {
            isActive = false;
            cleanupPromise.then(clearFn => clearFn && clearFn());
            if (webrtcRef.current) {
                webrtcRef.current.disconnect();
                webrtcRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meetingId, janusWsUrl, janusApiUrl]); // localStream deliberately excluded

    // Return the ref object itself so callers always get the live instance
    return { isConnected, webrtcRef };
}
