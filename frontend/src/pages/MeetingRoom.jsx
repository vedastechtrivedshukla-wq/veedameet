import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMeetingStore } from "@/hooks/useMeetingStore";
import { useWebRTC } from "@/hooks/useWebRTC";
import { SocketService } from "@/services/socket";
import { meetings as meetingsApi } from "@/services/api";

import Controls from "@/components/Controls";
import VideoGrid from "@/components/VideoGrid";
import ChatPanel from "@/components/ChatPanel";

import { X, UserPlus, Copy, Check, Shield, Mic, MicOff, Video as VideoIcon, VideoOff, User, Crown, LogIn, LogOut } from "lucide-react";

export default function MeetingRoom() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    // Pre-Join State
    const [hasJoined, setHasJoined] = useState(location.state?.isInstantMeeting || false);
    const [mediaChecked, setMediaChecked] = useState(false);

    // Host detection from API
    const [isHost, setIsHost] = useState(false);

    // Local UI State
    const [showChat, setShowChat] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    // previewStream is what the local video tile shows.
    // It equals localStream normally, but the displayStream when screen sharing.
    // Keeping it separate prevents localStream changes from re-initialising Janus.
    const [previewStream, setPreviewStream] = useState(null);
    const screenStreamRef = useRef(null); // holds the active displayStream
    const [showReadyModal, setShowReadyModal] = useState(location.state?.isInstantMeeting || false);
    const [showAddOthersModal, setShowAddOthersModal] = useState(false);
    const [inviteInput, setInviteInput] = useState("");
    const [copied, setCopied] = useState(false);
    const [joinToast, setJoinToast] = useState(null); // { name, type: 'joined'|'left' }
    const toastTimerRef = useRef(null);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    // Global Sync State
    const {
        participants,
        messages,
        isMicOn,
        isVideoOn,
        isScreenSharing,
        setMic,
        setVideo,
        setScreenShare,
        addMessage,
        addParticipant,
        removeParticipant,
        resetParticipants,
        resetMessages,
    } = useMeetingStore();

    const socketRef = useRef(null);
    const { isConnected, webrtcRef } = useWebRTC(id, hasJoined ? localStream : null);

    useEffect(() => {
        if (!user) {
            navigate("/login");
        }
    }, [user, navigate]);

    // Fetch meeting info from API to determine host status
    useEffect(() => {
        if (!user || !id) return;
        meetingsApi.get(id)
            .then((res) => {
                const meeting = res.data;
                setIsHost(meeting.host_id === user.id || meeting.host?.id === user.id);
            })
            .catch((err) => {
                console.warn("Could not fetch meeting info for host check", err);
                // Fallback: trust location.state
                setIsHost(!!location.state?.isInstantMeeting);
            });
    }, [id, user]);

    // Reset stale store state when entering a meeting room
    useEffect(() => {
        resetParticipants();
        resetMessages();
        // Cleanup when leaving
        return () => {
            resetParticipants();
            resetMessages();
        };
    }, [id]);

    // 1. Initialize local media (Always happens first for preview)
    useEffect(() => {
        if (!user) return;

        let activeStream = null;
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                activeStream = stream;
                setLocalStream(stream);
                setPreviewStream(stream); // preview starts as camera
                setMediaChecked(true);
            })
            .catch((err) => {
                console.error("Failed to get local media", err);
                setVideo(false);
                setMic(false);
                setMediaChecked(true);
            });

        return () => {
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [user]);

    // 2. Initialize WebSocket Signaling (Only happens AFTER joining)
    useEffect(() => {
        if (!user || !hasJoined) return;

        const token = localStorage.getItem("token");
        socketRef.current = new SocketService(id, token);

        // Add the local user to the participants list immediately
        addParticipant({ id: user.id, name: user.name, email: user.email, isLocal: true });

        const showToast = (name, type) => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            setJoinToast({ name, type });
            toastTimerRef.current = setTimeout(() => setJoinToast(null), 4000);
        };

        // When another user joins the meeting
        socketRef.current.on("user_joined", (data) => {
            if (data.user_id !== user.id) {
                const name = data.user_name || data.user_email || `User ${data.user_id}`;
                addParticipant({
                    id: data.user_id,
                    name,
                    email: data.user_email,
                    isLocal: false,
                });
                showToast(name, "joined");
            }
        });

        // When another user leaves the meeting
        socketRef.current.on("user_left", (data) => {
            if (data.user_id !== user.id) {
                const leaving = participants.find(p => p.id === data.user_id);
                removeParticipant(data.user_id);
                showToast(data.user_name || (leaving?.name) || `User ${data.user_id}`, "left");
            }
        });

        socketRef.current.on("chat_message", (data) => {
            addMessage({
                senderId: data.sender_id,
                senderName: data.sender_name || "Unknown",
                text: data.message,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        });

        socketRef.current.connect();

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            // Remove the local user when they leave
            removeParticipant(user.id);
        };
    }, [id, user, hasJoined]);

    const handleToggleMic = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !isMicOn);
        }
        setMic(!isMicOn);
        // TODO: Send mute signal via WS or WebRTC metadata
    };

    const handleToggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !isVideoOn);
        }
        setVideo(!isVideoOn);
    };

    const stopScreenStream = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
        }
    };

    const revertToCamera = async () => {
        stopScreenStream();
        try {
            // Re-acquire a fresh camera video track (audio track already live in localStream)
            const camVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newVideoTrack = camVideoStream.getVideoTracks()[0];

            // Replace the sender track in the existing Janus connection
            if (webrtcRef.current) {
                await webrtcRef.current.replaceLocalTrack(
                    localStream.getVideoTracks()[0],
                    newVideoTrack
                );
            }

            // Splice the new video track into localStream (keep the live audio track)
            localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
            localStream.addTrack(newVideoTrack);

            setPreviewStream(localStream); // show camera in local tile again
            setScreenShare(false);
        } catch (e) {
            console.error("Failed to restore camera after screen share", e);
            setScreenShare(false);
        }
    };

    const handleToggleScreenShare = async () => {
        if (!isScreenSharing) {
            try {
                const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                screenStreamRef.current = displayStream;

                const screenVideoTrack = displayStream.getVideoTracks()[0];
                const oldVideoTrack = localStream.getVideoTracks()[0];

                // 1. Replace the WebRTC sender track (does NOT change localStream state,
                //    so useWebRTC will NOT re-initialize the Janus connection)
                if (webrtcRef.current && oldVideoTrack && screenVideoTrack) {
                    await webrtcRef.current.replaceLocalTrack(oldVideoTrack, screenVideoTrack);
                }

                // 2. Stop the old camera video track so the camera light turns off
                if (oldVideoTrack) oldVideoTrack.stop();

                // 3. Only update the preview stream — localStream itself stays the same
                setPreviewStream(displayStream);
                setScreenShare(true);

                // 4. Revert automatically when user presses the browser "Stop sharing" button
                screenVideoTrack.onended = revertToCamera;

            } catch (err) {
                if (err.name !== "NotAllowedError") {
                    console.error("Screen share error", err);
                }
                // User cancelled the picker — nothing to do
            }
        } else {
            await revertToCamera();
        }
    };

    const handleToggleRecording = async () => {
        if (!isRecording) {
            try {
                // Request screen and system audio
                const displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: "always" },
                    audio: true
                });

                // Create an AudioContext to mix microphone and system audio
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const destination = audioContext.createMediaStreamDestination();

                // 1. Add Microphone Audio (if available)
                if (localStream && localStream.getAudioTracks().length > 0) {
                    const micTrack = localStream.getAudioTracks()[0];
                    const micStream = new MediaStream([micTrack]);
                    const micSource = audioContext.createMediaStreamSource(micStream);
                    micSource.connect(destination);
                }

                // 2. Add System/Tab Audio (from the screen share selection, if they clicked "Share audio")
                if (displayStream.getAudioTracks().length > 0) {
                    const sysTrack = displayStream.getAudioTracks()[0];
                    const sysStream = new MediaStream([sysTrack]);
                    const sysSource = audioContext.createMediaStreamSource(sysStream);
                    sysSource.connect(destination);
                }

                // Combine Video from display, Audio from mixed destination
                const combinedTracks = [
                    ...displayStream.getVideoTracks(),
                    ...destination.stream.getAudioTracks()
                ];

                const finalStream = new MediaStream(combinedTracks);

                recordedChunksRef.current = [];
                const mediaRecorder = new MediaRecorder(finalStream, { mimeType: 'video/webm' });

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        recordedChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    document.body.appendChild(a);
                    a.style = 'display: none';
                    a.href = url;
                    a.download = `vedameet-recording-${new Date().getTime()}.webm`;
                    a.click();

                    window.URL.revokeObjectURL(url);
                    displayStream.getTracks().forEach(track => track.stop());
                    audioContext.close();
                    setIsRecording(false);
                };

                displayStream.getVideoTracks()[0].onended = () => {
                    if (mediaRecorder.state !== 'inactive') {
                        mediaRecorder.stop();
                    }
                };

                mediaRecorder.start();
                mediaRecorderRef.current = mediaRecorder;
                setIsRecording(true);
            } catch (err) {
                console.error("Error starting recording:", err);
                alert("Could not start recording: " + err.message);
            }
        } else {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
        }
    };

    const handleLeave = () => {
        // Teardown WebRTC & WS
        if (socketRef.current) socketRef.current.disconnect();
        navigate("/dashboard");
    };

    const handleSendMessage = (text) => {
        addMessage({
            senderId: "self",
            senderName: user.name,
            text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        // Broadcast via WS
        if (socketRef.current) {
            socketRef.current.send("chat_message", {
                message: text,
                sender_name: user?.name,
            });
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRealJoin = () => {
        setHasJoined(true);
        if (location.state?.isInstantMeeting) {
            setShowReadyModal(true);
        }
    };

    if (!user) return null;

    if (!hasJoined) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
                    {/* Left: Video Preview */}
                    <div className="flex flex-col items-center w-full">
                        <div className="relative w-full aspect-video bg-zinc-900 rounded-2xl overflow-hidden shadow-xl border border-zinc-800 flex items-center justify-center">
                            {localStream && isVideoOn ? (
                                <video
                                    ref={(video) => {
                                        if (video) video.srcObject = localStream;
                                    }}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="w-full h-full object-cover transform scale-x-[-1]"
                                />
                            ) : (
                                <div className="text-zinc-500 flex flex-col items-center">
                                    <VideoOff size={48} className="mb-4 text-zinc-600" />
                                    <span>Camera is off</span>
                                </div>
                            )}

                            {/* Preview Controls Overlay */}
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                                <button
                                    onClick={handleToggleMic}
                                    className={`p-3 rounded-full flex items-center justify-center transition-colors shadow-lg border border-white/10 ${isMicOn ? "bg-zinc-800/80 hover:bg-zinc-700/80 text-white" : "bg-red-500/90 hover:bg-red-600 text-white"}`}
                                >
                                    {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                                </button>
                                <button
                                    onClick={handleToggleVideo}
                                    className={`p-3 rounded-full flex items-center justify-center transition-colors shadow-lg border border-white/10 ${isVideoOn ? "bg-zinc-800/80 hover:bg-zinc-700/80 text-white" : "bg-red-500/90 hover:bg-red-600 text-white"}`}
                                >
                                    {isVideoOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Join Info & Button */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-6">
                        <div>
                            <h1 className="text-3xl font-normal text-gray-900 dark:text-white pb-2">Ready to join?</h1>
                            <p className="text-gray-500 dark:text-zinc-400">Meeting ID: <span className="font-mono text-zinc-300">{id}</span></p>
                        </div>
                        <button
                            onClick={handleRealJoin}
                            disabled={!mediaChecked}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full font-medium transition-colors shadow-sm text-lg w-full md:w-auto"
                        >
                            {mediaChecked ? "Join Now" : "Getting camera..."}
                        </button>
                    </div>

                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">

            {/* Join / Leave Toast Notification */}
            {joinToast && (
                <div
                    key={joinToast.name + joinToast.type}
                    className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-zinc-800 border border-zinc-700 text-white px-5 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-3 duration-300"
                >
                    <div className={`p-1.5 rounded-full ${joinToast.type === 'joined' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        {joinToast.type === 'joined'
                            ? <LogIn size={16} className="text-green-400" />
                            : <LogOut size={16} className="text-red-400" />}
                    </div>
                    <span className="text-sm font-medium">
                        <span className="text-white font-semibold">{joinToast.name}</span>
                        {' '}{joinToast.type === 'joined' ? 'joined the meeting' : 'left the meeting'}
                    </span>
                    <button onClick={() => setJoinToast(null)} className="ml-1 text-zinc-400 hover:text-white">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Main content grid area */}
            <div className="flex-1 flex overflow-hidden relative">
                <main className={`flex-1 transition-all duration-300 relative`}>
                    <VideoGrid
                        participants={participants}
                        localStream={previewStream}
                        isVideoOn={isVideoOn}
                        isMicOn={isMicOn}
                        isScreenSharing={isScreenSharing}
                    />
                </main>

                {/* Right side panels */}
                {showChat && (
                    <ChatPanel
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        onClose={() => setShowChat(false)}
                    />
                )}

                {/* Participants Panel */}
                {showParticipants && (
                    <div className="w-72 bg-zinc-900 border-l border-zinc-800 flex flex-col animate-in slide-in-from-right-4 duration-200">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                            <h2 className="text-white font-semibold text-base">People ({participants.length})</h2>
                            <button
                                onClick={() => setShowParticipants(false)}
                                className="p-1 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                            {/* All participants from the store (includes local user with isLocal: true) */}
                            {participants.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors group">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 ${p.isLocal ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                                        {p.name?.charAt(0)?.toUpperCase() || <User size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium truncate">
                                            {p.name || p.email}
                                            {p.isLocal && <span className="text-zinc-400 text-xs ml-1">(You)</span>}
                                        </p>
                                        <p className="text-zinc-500 text-xs truncate">{p.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {isHost && p.isLocal && (
                                            <Crown size={14} className="text-yellow-400" title="Host" />
                                        )}
                                        <div className="w-2 h-2 rounded-full bg-green-400" title="Online" />
                                    </div>
                                </div>
                            ))}

                            {participants.filter(p => !p.isLocal).length === 0 && (
                                <div className="text-center text-zinc-500 text-sm py-6">
                                    <User size={32} className="mx-auto mb-2 text-zinc-600" />
                                    <p>Waiting for others to join...</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <Controls
                isHost={isHost}
                isMicOn={isMicOn}
                isVideoOn={isVideoOn}
                isScreenSharing={isScreenSharing}
                isRecording={isRecording}
                participantCount={participants.length}
                onToggleMic={handleToggleMic}
                onToggleVideo={handleToggleVideo}
                onToggleScreenShare={handleToggleScreenShare}
                onToggleRecording={handleToggleRecording}
                onLeave={handleLeave}
                onToggleChat={() => {
                    setShowChat(!showChat);
                    setShowParticipants(false);
                }}
                onToggleParticipants={() => {
                    setShowParticipants(!showParticipants);
                    setShowChat(false);
                }}
            />

            {/* Instant Meeting Ready Modal */}
            {showReadyModal && (
                <div className="absolute bottom-24 left-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-[360px] p-6 z-50 border border-gray-200 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-medium text-gray-900 dark:text-white mt-1">Your meeting's ready</h2>
                        <button
                            onClick={() => setShowReadyModal(false)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <button
                        onClick={() => setShowAddOthersModal(true)}
                        className="bg-[#0b57d0] hover:bg-[#0b57d0]/90 text-white font-medium py-2 px-4 rounded-full flex items-center mb-5 transition-colors"
                    >
                        <UserPlus size={18} className="mr-2" />
                        Add others
                    </button>

                    <p className="text-[15px] text-[#444746] dark:text-gray-300 mb-3 leading-snug">
                        Or share this meeting link with others you want in the meeting
                    </p>

                    <div className="bg-[#f0f4f9] dark:bg-zinc-800 rounded-md p-3 flex items-center justify-between mb-4 hover:bg-[#e0e4e9] dark:hover:bg-zinc-700 transition-colors cursor-pointer" onClick={handleCopyLink}>
                        <span className="text-[15px] text-[#1f1f1f] dark:text-gray-200 truncate pr-2 font-mono">
                            {window.location.host}/meeting/{id}
                        </span>
                        <button className="text-gray-700 dark:text-gray-300 p-1 shrink-0">
                            {copied ? <Check size={20} className="text-green-600" /> : <Copy size={20} />}
                        </button>
                    </div>

                    <div className="flex items-start mb-4 text-[#444746] dark:text-gray-400">
                        <div className="bg-[#e8f0fe] dark:bg-blue-900/30 p-1.5 rounded-full mr-3 shrink-0">
                            <Shield size={16} className="text-[#0b57d0] dark:text-blue-400" />
                        </div>
                        <p className="text-[13px] leading-tight pt-0.5">
                            People who use this meeting link must get your permission before they can join.
                        </p>
                    </div>

                    <p className="text-[13px] text-[#444746] dark:text-gray-500">
                        Joined as {user?.email || user?.name}
                    </p>
                </div>
            )}

            {/* Add Others Modal */}
            {showAddOthersModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-medium text-gray-900 dark:text-white">Add others</h2>
                            <button
                                onClick={() => setShowAddOthersModal(false)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Enter email or name
                            </label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800 border-b-2 border-transparent focus:border-[#0b57d0] dark:focus:border-blue-500 rounded-t-md outline-none transition-colors text-gray-900 dark:text-white"
                                placeholder="Email id or name"
                                value={inviteInput}
                                onChange={(e) => setInviteInput(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setShowAddOthersModal(false);
                                    setInviteInput("");
                                }}
                                className="px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    // Mock sending invite
                                    if (inviteInput.trim()) {
                                        alert(`Invitation sent to: ${inviteInput}`);
                                        setShowAddOthersModal(false);
                                        setInviteInput("");
                                    }
                                }}
                                disabled={!inviteInput.trim()}
                                className="px-5 py-2 text-sm font-medium text-white bg-[#0b57d0] hover:bg-[#0b57d0]/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
                            >
                                Send invite
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
