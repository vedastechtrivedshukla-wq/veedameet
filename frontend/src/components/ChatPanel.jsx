import React, { useState } from "react";
import { Send, X } from "lucide-react";

export default function ChatPanel({ messages, onSendMessage, onClose }) {
    const [input, setInput] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input.trim());
            setInput("");
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 w-80 shrink-0 shadow-xl z-20 transition-all">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-zinc-800">
                <h3 className="font-bold text-gray-900 dark:text-white">In-call Messages</h3>
                <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-zinc-950/50">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-gray-500 dark:text-gray-400 text-center px-4">
                        Messages can be seen by anyone in the call and are deleted when the call ends.
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.senderId === "self"; // Or check against context user.id
                        return (
                            <div key={idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 mx-1">
                                    {isMe ? "You" : msg.senderName} • {msg.time}
                                </span>
                                <div
                                    className={`px-4 py-2.5 rounded-2xl max-w-[90%] text-sm shadow-sm ${isMe
                                            ? "bg-blue-600 text-white rounded-tr-sm"
                                            : "bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-zinc-700 rounded-tl-sm"
                                        }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Send a message"
                        className="flex-1 bg-gray-100 dark:bg-zinc-800 border-none rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-600 dark:text-white placeholder:text-gray-500"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
