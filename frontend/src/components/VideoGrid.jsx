import React, { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";

function MediaElement({ stream, muted = false, mirror = false, className = "" }) {
    const ref = useRef(null);

    useEffect(() => {
        if (!ref.current || !stream) return;
        if (ref.current.srcObject !== stream) {
            ref.current.srcObject = stream;
            ref.current.play().catch(err => console.warn("Play error:", err));
        }
    }, [stream]);

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
                // isVideoOn defaults to true if unknown (before any media_state event arrives).
                // It will be set to false when we receive a media_state event from that user.
                const remoteVideoOn = p.isVideoOn !== false;
                const hasStream = p.stream && p.stream.getVideoTracks().length > 0;
                const showVideo = remoteVideoOn && hasStream;

                return (
                    <div key={p.id} className="relative bg-zinc-800 rounded-2xl overflow-hidden shadow-lg border border-zinc-700 flex flex-col justify-center items-center h-full w-full">
                        {/* Always render MediaElement when we have a stream so audio works,
                            but only show it visually when video is actually on */}
                        {hasStream && (
                            <MediaElement
                                stream={p.stream}
                                muted={false}
                                className={`w-full h-full object-cover absolute inset-0 ${showVideo ? "opacity-100 z-0" : "opacity-0 -z-10"}`}
                            />
                        )}
                        {/* Show avatar when video is off or no stream yet */}
                        {!showVideo && (
                            <div className="flex items-center justify-center w-24 h-24 bg-zinc-700 rounded-full text-zinc-400 z-10">
                                <User size={48} />
                            </div>
                        )}
                        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 text-white text-sm font-medium z-10 flex items-center">
                            {p.name}
                            {p.isMicOn === false && <span className="ml-2 text-red-500 text-xs">Muted</span>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
