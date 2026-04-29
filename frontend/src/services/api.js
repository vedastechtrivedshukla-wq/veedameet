import axios from "axios";

// Default API Base for FastAPI instance
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const auth = {
    login: (username, password) => {
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);
        return api.post("/auth/login", formData);
    },
    register: (email, password, full_name) =>
        api.post("/auth/register", { email, password, full_name }),
    me: () => api.get("/auth/me"),
};

export const meetings = {
    create: (title) => api.post("/meetings/", { title }),
    get: (meeting_id) => api.get(`/meetings/${meeting_id}`),
    end: (meeting_id) => api.put(`/meetings/${meeting_id}/end`),
    uploadRecording: (meeting_id, formData) => api.post(`/meetings/${meeting_id}/recordings`, formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    }),
    notifyRecordingStart: (meeting_id) => api.post(`/meetings/${meeting_id}/notify-recording-start`),
};

export default api;
