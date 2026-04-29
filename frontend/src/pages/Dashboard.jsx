import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { meetings as meetingsApi } from "@/services/api";
import { Video, Keyboard, PlusSquare, Link as LinkIcon, Plus, Copy, Check } from "lucide-react";

export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [joinId, setJoinId] = useState("");

    // New Meeting state
    const [isNewMeetingDropdownOpen, setIsNewMeetingDropdownOpen] = useState(false);
    const [generatedLink, setGeneratedLink] = useState("");
    const [copied, setCopied] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsNewMeetingDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const generateRandomId = () => {
        return Math.random().toString(36).substring(2, 11);
    };

    const handleStartInstantMeeting = async () => {
        try {
            const res = await meetingsApi.create("Instant Meeting");
            navigate(`/meeting/${res.data.meeting_id}`, { state: { isInstantMeeting: true } });
        } catch (error) {
            console.error("Failed to create meeting", error);
            alert("Could not create meeting. Please try again.");
        }
    };

    const handleCreateForLater = async () => {
        try {
            const res = await meetingsApi.create("Scheduled Meeting");
            const meetingUrl = `${window.location.origin}/meeting/${res.data.meeting_id}`;
            setGeneratedLink(meetingUrl);
            setIsNewMeetingDropdownOpen(false);
        } catch (error) {
            console.error("Failed to create meeting", error);
            alert("Could not create meeting. Please try again.");
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleJoinMeeting = (e) => {
        e.preventDefault();
        if (joinId.trim()) {
            navigate(`/meeting/${joinId.trim()}`);
        }
    };

    useEffect(() => {
        if (!user) {
            navigate("/login");
        }
    }, [user, navigate]);

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col dark:bg-zinc-950">
            {/* Top Navbar */}
            <nav className="bg-white border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <div className="bg-blue-600 p-2 rounded-lg text-white">
                        <Video size={20} />
                    </div>
                    <span className="font-bold text-xl dark:text-white">Vedameet</span>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.name}</span>
                    <button
                        onClick={logout}
                        className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            </nav>

            {/* Main Content Actions */}
            <main className="flex-1 max-w-5xl w-full mx-auto p-6 mt-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Create Meeting Card Wrapper */}
                    <div className="relative" ref={dropdownRef}>
                        {/* Create Meeting Card */}
                        <div
                            className="bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col items-center justify-center text-center space-y-4 hover:shadow-md transition-shadow cursor-pointer group h-full"
                            onClick={() => setIsNewMeetingDropdownOpen(!isNewMeetingDropdownOpen)}
                        >
                            <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
                                <Video size={40} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold dark:text-white">New Meeting</h3>
                                <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">Set up a new video meeting instantly</p>
                            </div>
                        </div>

                        {/* Dropdown Menu */}
                        {isNewMeetingDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-full sm:w-[300px] bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-100 dark:border-zinc-800 z-40 overflow-hidden text-left">
                                <div className="flex flex-col">
                                    <button
                                        onClick={handleCreateForLater}
                                        className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors w-full text-left"
                                    >
                                        <LinkIcon className="text-gray-500 mr-3" size={20} />
                                        <span className="font-medium text-gray-700 dark:text-gray-200">Create a meeting for later</span>
                                    </button>
                                    <div className="h-px bg-gray-100 dark:bg-zinc-800 w-full"></div>
                                    <button
                                        onClick={handleStartInstantMeeting}
                                        className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors w-full text-left"
                                    >
                                        <Plus className="text-gray-500 mr-3" size={20} />
                                        <span className="font-medium text-gray-700 dark:text-gray-200">Start an instant meeting</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Join Meeting Card */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                            <PlusSquare size={40} />
                        </div>
                        <div className="w-full">
                            <h3 className="text-xl font-bold dark:text-white">Join Meeting</h3>
                            <form onSubmit={handleJoinMeeting} className="mt-4 flex items-center justify-center space-x-2 max-w-sm mx-auto">
                                <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                        <Keyboard size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={joinId}
                                        onChange={(e) => setJoinId(e.target.value)}
                                        placeholder="Enter short ID (e.g. abc-def-ghi)"
                                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent sm:text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!joinId.trim()}
                                    className="bg-gray-100 text-gray-900 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                                >
                                    Join
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>

            {/* Link Modal / Toast */}
            {generatedLink && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-bold dark:text-white">Here's the link to your meeting</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Copy this link and send it to people you want to meet with. Be sure to save it so you can use it later, too.
                        </p>
                        <div className="flex items-center space-x-2 bg-gray-50 dark:bg-zinc-800 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                            <span className="flex-1 truncate text-sm dark:text-gray-200 font-mono select-all">{generatedLink}</span>
                            <button
                                onClick={handleCopyLink}
                                className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                                title="Copy link"
                            >
                                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-500 dark:text-gray-400" />}
                            </button>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setGeneratedLink("")}
                                className="px-4 py-2 font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
