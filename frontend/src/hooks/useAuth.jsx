import React, { createContext, useContext, useState, useEffect } from "react";
import { auth as authApi } from "@/services/api";

const AuthContext = createContext(null);

// Helper: map the backend UserResponse shape to a consistent user object
const mapUser = (data) => ({
    id: data.id,
    email: data.email,
    name: data.full_name || data.email.split("@")[0],
});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            setLoading(false);
            return;
        }
        // Restore session by fetching the current user from the backend
        authApi.me()
            .then((res) => setUser(mapUser(res.data)))
            .catch(() => {
                // Token is invalid or expired — clear it
                localStorage.removeItem("token");
            })
            .finally(() => setLoading(false));
    }, []);

    const login = async (email, password) => {
        const res = await authApi.login(email, password);
        const { access_token } = res.data;
        localStorage.setItem("token", access_token);
        // Fetch the real user profile
        const meRes = await authApi.me();
        setUser(mapUser(meRes.data));
    };

    const register = async (email, password, fullName) => {
        await authApi.register(email, password, fullName);
        // After registering, log in to get the token
        await login(email, password);
    };

    const logout = () => {
        localStorage.removeItem("token");
        setUser(null);
    };

    const value = { user, loading, login, register, logout };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
