export class SocketService {
    constructor(meetingId, token) {
        this.meetingId = meetingId;
        this.token = token;
        this.ws = null;
        this.handlers = new Map();
    }

    connect() {
        const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";
        this.ws = new WebSocket(`${wsUrl}/${this.meetingId}?token=${this.token}`);

        this.ws.onopen = () => {
            console.log("WebSocket connected");
            this.emit("connected", { status: "ok" });
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emit(data.event, data);
            } catch (err) {
                console.error("Failed to parse WS message", err);
            }
        };

        this.ws.onclose = () => {
            console.log("WebSocket disconnected");
            this.emit("disconnected", { status: "closed" });
        };
    }

    on(event, callback) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.handlers.get(event);
        if (callbacks) {
            callbacks.forEach(cb => cb(data));
        }
    }

    send(event, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ event, ...payload }));
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
