import { create } from "zustand";

export const useMeetingStore = create((set, get) => ({
    participants: [],
    messages: [],
    isMicOn: true,
    isVideoOn: true,
    isScreenSharing: false,
    meetingStatus: "idle", // idle, connecting, connected, ended

    setMic: (state) => set({ isMicOn: state }),
    setVideo: (state) => set({ isVideoOn: state }),
    setScreenShare: (state) => set({ isScreenSharing: state }),

    addParticipant: (p) => set((state) => ({
        participants: [...state.participants.filter(x => x.id !== p.id), p]
    })),
    removeParticipant: (id) => set((state) => ({
        participants: state.participants.filter(p => p.id !== id)
    })),
    resetParticipants: () => set({ participants: [] }),

    addMessage: (m) => set((state) => ({ messages: [...state.messages, m] })),
    resetMessages: () => set({ messages: [] }),
    setStatus: (status) => set({ meetingStatus: status }),
}));
