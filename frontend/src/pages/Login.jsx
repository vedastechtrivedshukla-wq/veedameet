import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Video } from "lucide-react";

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [signature, setSignature] = useState("");
    const { login, register } = useAuth();
    const navigate = useNavigate();
    // Capture where the user was trying to go before being redirected to login
    const location = useLocation();
    const from = location.state?.from || "/dashboard";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        
        if (!isLogin && !acceptTerms) {
            setError("You must accept the terms and conditions to sign up.");
            return;
        }

        if (!isLogin && signature.trim().toLowerCase() !== fullName.trim().toLowerCase()) {
            setError("Please type your full name exactly to sign the terms and conditions.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(email, password, fullName);
            }
            navigate(from, { replace: true });
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                (isLogin ? "Incorrect email or password." : "Registration failed. Please try again.");
            setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50/50 dark:bg-zinc-950 p-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white dark:bg-zinc-900 p-8 shadow-xl border border-gray-100 dark:border-zinc-800">
                <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="rounded-full bg-blue-600 p-3 text-white">
                        <Video className="h-8 w-8" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Vedameet
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isLogin ? "Welcome back" : "Create your account"}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4 rounded-md shadow-sm">
                        {!isLogin && (
                            <div>
                                <label className="sr-only">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
                                    placeholder="Full Name"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                />
                            </div>
                        )}
                        <div>
                            <label className="sr-only">Email address</label>
                            <input
                                type="email"
                                required
                                className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="sr-only">Password</label>
                            <input
                                type="password"
                                required
                                className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {!isLogin && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            <div className="mb-3 p-3 h-32 overflow-y-auto bg-gray-50 dark:bg-zinc-800/50 rounded border border-gray-200 dark:border-zinc-700 text-xs space-y-2">
                                <p>Your audio and video data may be analyzed to enhance system performance, accuracy, and user experience.</p>
                                <p>Data may be stored securely and processed in accordance with applicable data protection laws.</p>
                                <p>Wherever reasonably possible, data will be anonymized or de-identified before being used for training purposes.</p>
                                <p>Your data will not be sold to third parties without your explicit consent, except as required by law.</p>
                            </div>
                            <div className="flex flex-col space-y-3 mt-3">
                                <div className="flex items-center">
                                    <input
                                        id="terms"
                                        name="terms"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-700 dark:ring-offset-zinc-900"
                                        checked={acceptTerms}
                                        onChange={(e) => setAcceptTerms(e.target.checked)}
                                    />
                                    <label htmlFor="terms" className="ml-2 block text-sm">
                                        I agree to the terms and conditions
                                    </label>
                                </div>
                                {acceptTerms && (
                                    <div>
                                        <label htmlFor="signature" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Digital Signature (Type your Full Name)
                                        </label>
                                        <input
                                            type="text"
                                            id="signature"
                                            required
                                            className="relative block w-full rounded-md border-0 py-2 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
                                            placeholder="John Doe"
                                            value={signature}
                                            onChange={(e) => setSignature(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="group relative flex w-full justify-center rounded-md bg-blue-600 py-2.5 px-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSubmitting
                                ? (isLogin ? "Signing in..." : "Creating account...")
                                : (isLogin ? "Sign in" : "Sign up")}
                        </button>
                    </div>
                </form>

                <div className="text-center text-sm">
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(""); }}
                        className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        {isLogin
                            ? "Don't have an account? Sign up"
                            : "Already have an account? Sign in"}
                    </button>
                </div>
            </div>
        </div>
    );
}
