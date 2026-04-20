import React, { useEffect, useRef } from "react";
import { User } from "lucide-react";

/** Attaches srcObject to a video/audio ref and plays it. */
function MediaElement({ stream, muted = false, mirror = false, className = "" }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current || !stream) return;
        if (ref.current.srcObject !== stream) {
            ref.current.srcObject = stream;
            ref.current.play().catch(() => { });
        }
    }, [stream]);

    const hasVideo = stream && stream.getVideoTracks().length > 0;
    const hasAudio = stream && stream.getAudioTracks().length > 0;

    if (hasVideo) {
        return (
            <video
                ref={ref}
                className={className}
                style={mirror ? { transform: "scaleX(-1)" } : {}}
                autoPlay
                playsInline
                muted={muted}
            />
        );
    }
    // Audio-only stream → hidden audio element, show avatar
    if (hasAudio) {
        return <audio ref={ref} autoPlay playsInline style={{ display: "none" }} />;
    }
    return null;
}

export default function VideoGrid({ participants, localStream, isVideoOn, isMicOn, isScreenSharing }) {
    // Filter out the local participant so they don't render twice (since we render Self manually below)
    const remoteParticipants = participants.filter(p => !p.isLocal);
    const total = remoteParticipants.length + 1; // +1 for local

    let gridClass = "grid-cols-1";
    if (total >= 2) gridClass = "grid-cols-1 md:grid-cols-2";
    if (total >= 5) gridClass = "grid-cols-2 lg:grid-cols-3";
    if (total >= 10) gridClass = "grid-cols-3 xl:grid-cols-4";

    return (
        <div className={`p-4 h-full w-full gap-4 grid ${gridClass} auto-rows-fr`}>
            {/* Local Participant (Self) */}
            <div className="relative bg-zinc-800 rounded-2xl overflow-hidden shadow-lg border border-zinc-700 flex flex-col justify-center items-center h-full w-full">
                {isVideoOn && localStream ? (
                    <MediaElement
                        stream={localStream}
                        muted={true}
                        mirror={!isScreenSharing}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex items-center justify-center w-24 h-24 bg-zinc-700 rounded-full text-zinc-400">
                        <User size={48} />
                    </div>
                )}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm font-medium z-10 flex items-center">
                    You {isMicOn === false && <span className="ml-2 text-red-500 text-xs">Muted</span>}
                </div>
            </div>

            {/* Remote Participants */}
            {remoteParticipants.map((p) => {
                const hasVideo = p.stream && p.stream.getVideoTracks().length > 0;
                return (
                    <div key={p.id} className="relative bg-zinc-800 rounded-2xl overflow-hidden shadow-lg border border-zinc-700 flex flex-col justify-center items-center h-full w-full">
                        {hasVideo ? (
                            <MediaElement
                                stream={p.stream}
                                muted={false}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <>
                                {/* Render hidden audio even with no video */}
                                {p.stream && <MediaElement stream={p.stream} muted={false} />}
                                <div className="flex items-center justify-center w-24 h-24 bg-zinc-700 rounded-full text-zinc-400">
                                    <User size={48} />
                                </div>
                            </>
                        )}
                        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm font-medium z-10">
                            {p.name}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
