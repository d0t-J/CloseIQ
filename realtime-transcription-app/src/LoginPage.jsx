import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase client via .env variables (make sure they are set)
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
);

export default function LoginPage({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        const { error, data } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            setError(error.message);
        } else {
            onLogin && onLogin(data.session); // pass session object
        }
    };

    return (
        <div
            style={{
                maxWidth: 350,
                margin: "100px auto",
                padding: 24,
                border: "1px solid #ddd",
                borderRadius: 6,
            }}
        >
            <h2>Agent Login</h2>
            <form onSubmit={handleLogin}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    required
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ marginBottom: 8, width: "100%" }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    required
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ marginBottom: 8, width: "100%" }}
                />
                <button type="submit" style={{ width: "100%" }}>
                    Login
                </button>
                {error && (
                    <div style={{ color: "red", marginTop: 8 }}>{error}</div>
                )}
            </form>
        </div>
    );
}
