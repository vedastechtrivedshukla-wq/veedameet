import React, { useState, useEffect, useRef } from "react";
import {
    Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff,
    Users, MessageSquare, MoreVertical, CircleDot,
    Layout, Maximize, Minimize, PictureInPicture,
    AlertCircle, Settings
} from "lucide-react";

export default function Controls({
    isHost,
    isMicOn,
    isVideoOn,
    isScreenSharing,
    isRecording,
    participantCount,
    onToggleMic,
    onToggleVideo,
    onToggleScreenShare,
    onToggleRecording,
    onLeave,
    onToggleChat,
    onToggleParticipants,
}) {
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMoreMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Listen to fullscreen changes
    useEffect(() => {
        function handleFullscreenChange() {
            setIsFullscreen(!!document.fullscreenElement);
        }
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
        setIsMoreMenuOpen(false);
    };

    const handleMenuAction = (action) => {
        if (action === "recording") {
            if (onToggleRecording) onToggleRecording();
        } else {
            console.log(`Action triggered: ${action}`);
        }
        setIsMoreMenuOpen(false);
    };

    return (
        <div className="h-20 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-6 z-10 w-full relative">
            <div className="flex items-center space-x-4 w-1/3">
                {/* Meeting Info Could Go Here */}
                <span className="text-white text-sm font-medium">12:00 PM | Vedameet Room</span>
            </div>

            <div className="flex items-center justify-center space-x-3 w-1/3 relative">
                <button
                    onClick={onToggleMic}
                    className={`p-4 rounded-full flex items-center justify-center transition-colors ${isMicOn ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-red-500 hover:bg-red-600 text-white"
                        }`}
                    title={isMicOn ? "Turn off mic" : "Turn on mic"}
                >
                    {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                </button>

                <button
                    onClick={onToggleVideo}
                    className={`p-4 rounded-full flex items-center justify-center transition-colors ${isVideoOn ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-red-500 hover:bg-red-600 text-white"
                        }`}
                    title={isVideoOn ? "Turn off camera" : "Turn on camera"}
                >
                    {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
                </button>

                {isHost && (
                    <button
                        onClick={onToggleScreenShare}
                        className={`p-4 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? "bg-green-600 hover:bg-green-700 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-white"
                            }`}
                        title={isScreenSharing ? "Stop sharing" : "Share screen"}
                    >
                        <MonitorUp size={24} />
                    </button>
                )}

                {/* More Options Button */}
                <div ref={menuRef} className="relative">
                    <button
                        onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                        className={`p-4 rounded-full flex items-center justify-center transition-colors ${isMoreMenuOpen ? "bg-zinc-700 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-white"
                            }`}
                        title="More options"
                    >
                        <MoreVertical size={24} />
                    </button>

                    {/* More Options Dropdown */}
                    {isMoreMenuOpen && (
                        <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-64 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <ul className="text-sm text-zinc-300 font-medium">
                                <li>
                                    <button
                                        onClick={() => handleMenuAction("recording")}
                                        className="w-full flex items-center px-4 py-3 hover:bg-zinc-700 transition-colors text-left"
                                    >
                                        <CircleDot size={18} className={`mr-3 ${isRecording ? 'text-green-500 animate-pulse' : 'text-red-500'}`} />
                                        <span>{isRecording ? "Stop recording" : "Recording option"}</span>
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => handleMenuAction("layout")}
                                        className="w-full flex items-center px-4 py-3 hover:bg-zinc-700 transition-colors text-left"
                                    >
                                        <Layout size={18} className="mr-3" />
                                        <span>Adjust view</span>
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={toggleFullscreen}
                                        className="w-full flex items-center px-4 py-3 hover:bg-zinc-700 transition-colors text-left"
                                    >
                                        {isFullscreen ? (
                                            <Minimize size={18} className="mr-3" />
                                        ) : (
                                            <Maximize size={18} className="mr-3" />
                                        )}
                                        <span>{isFullscreen ? "Exit full screen" : "Full screen"}</span>
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => handleMenuAction("pip")}
                                        className="w-full flex items-center px-4 py-3 hover:bg-zinc-700 transition-colors text-left"
                                    >
                                        <PictureInPicture size={18} className="mr-3" />
                                        <span>Open picture in picture</span>
                                    </button>
                                </li>
                                <li className="border-t border-zinc-700 my-1"></li>
                                <li>
                                    <button
                                        onClick={() => handleMenuAction("report")}
                                        className="w-full flex items-center px-4 py-3 hover:bg-zinc-700 transition-colors text-left"
                                    >
                                        <AlertCircle size={18} className="mr-3 text-yellow-500" />
                                        <span>Report a problem</span>
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => handleMenuAction("settings")}
                                        className="w-full flex items-center px-4 py-3 hover:bg-zinc-700 transition-colors text-left"
                                    >
                                        <Settings size={18} className="mr-3" />
                                        <span>Settings</span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>

                <button
                    onClick={onLeave}
                    className="p-4 rounded-3xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors px-6 ml-2"
                    title="Leave meeting"
                >
                    <PhoneOff size={24} />
                    <span className="ml-2 font-bold hidden sm:inline">Leave</span>
                </button>
            </div>

            <div className="flex items-center justify-end space-x-3 w-1/3">
                <button
                    onClick={onToggleParticipants}
                    className="relative p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                    title="Participants"
                >
                    <Users size={20} />
                    {participantCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                            {participantCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={onToggleChat}
                    className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                    title="Chat"
                >
                    <MessageSquare size={20} />
                </button>
            </div>
        </div>
    );
}
