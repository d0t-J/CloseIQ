import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import enzetiLogo from "./assets/enzeti_logo.png";

<<<<<<< HEAD


// Supabase client
=======
// Supabase client via .env variables (make sure they are set)
>>>>>>> 101b94097e4e9c76700b73f0881137582ab2c039
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
);

export default function LoginPage({ onLogin }) {
<<<<<<< HEAD
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const showError = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      showError(error.message);
    } else {
      onLogin && onLogin(data.session);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center px-4 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),transparent_55%)]" />

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-[#141414] border border-[#d4af37] text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3">
          <span className="text-[#d4af37] text-lg">⚠</span>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl p-8 shadow-2xl">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
        <div className="mb-4 flex items-center justify-center">
            <img
            src={enzetiLogo}
            alt="eNZeTi Logo"
            className="w-28 h-28 object-contain drop-shadow-[0_0_30px_rgba(212,175,55,0.45)]"
            />
        </div>

        <p className="text-sm text-slate-400 mt-1 font-medium">
            Real-time AI Sales Coaching
        </p>
        </div>


        {/* Form */}
        <h2 className="text-lg font-semibold text-white mb-6">
          Log in to your account
        </h2>

        <form onSubmit={handleLogin} className="space-y-5">

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-[#262626] text-white rounded-lg focus:ring-2 focus:ring-[#d4af37]/30 focus:border-[#d4af37] outline-none transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-300">
                Password
              </label>
              <span className="text-xs text-[#d4af37] cursor-pointer">
                Forgot password?
              </span>
            </div>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-[#262626] text-white rounded-lg focus:ring-2 focus:ring-[#d4af37]/30 focus:border-[#d4af37] outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#d4af37] hover:bg-[#c9a227] text-black font-semibold py-2.5 rounded-lg transition active:scale-[0.98]"
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[#262626] text-center">
          <p className="text-sm text-slate-400">
            Don't have an account?{" "}
            <span className="text-[#d4af37] font-medium cursor-pointer">
              Contact Administrator
            </span>
          </p>
        </div>
      </div>
    </div>
  );
=======
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
>>>>>>> 101b94097e4e9c76700b73f0881137582ab2c039
}
