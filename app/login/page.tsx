"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      alert("Enter email and password");
      return;
    }
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (!error) router.push("/map");
      else alert(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (!error) {
        alert("Signup successful! You can now login.");
        setIsLogin(true);
      } else {
        alert(error.message);
      }
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f1f5f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', -apple-system, sans-serif",
    }}>
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        padding: "48px 48px 40px",
        width: "480px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>

        {/* CS Logo box */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div style={{
            width: "64px", height: "64px",
            background: "linear-gradient(135deg, #7c6ff7 0%, #5b52e8 100%)",
            borderRadius: "16px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "14px",
          }}>
            <span style={{
              color: "#fff",
              fontWeight: 800,
              fontSize: "22px",
              letterSpacing: "-0.5px",
            }}>CS</span>
          </div>

          {/* App name */}
          <div style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "#111827",
            letterSpacing: "-0.4px",
            marginBottom: "4px",
          }}>CivicSolve</div>

          {/* Tagline */}
          <div style={{
            fontSize: "13px",
            color: "#9ca3af",
            marginBottom: "28px",
          }}>Smarter Cities • Safer Communities</div>

          {/* Page heading */}
          <div style={{
            fontSize: "19px",
            fontWeight: 700,
            color: "#111827",
            marginBottom: "28px",
          }}>
            {isLogin ? "Sign in to your account" : "Create your account"}
          </div>
        </div>

        {/* Email field */}
        <div style={{ marginBottom: "18px" }}>
          <label style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 600,
            color: "#374151",
            marginBottom: "6px",
          }}>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "8px",
              border: "1.5px solid #e5e7eb",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
              color: "#111827",
              fontFamily: "inherit",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#7c6ff7")}
            onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
          />
        </div>

        {/* Password field */}
        <div style={{ marginBottom: "26px" }}>
          <label style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 600,
            color: "#374151",
            marginBottom: "6px",
          }}>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "8px",
              border: "1.5px solid #e5e7eb",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
              color: "#111827",
              fontFamily: "inherit",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#7c6ff7")}
            onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
          />
        </div>

        {/* Sign In button */}
        <button
          onClick={handleAuth}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            background: loading ? "#a5b4fc" : "#5b52e8",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            letterSpacing: "-0.1px",
            transition: "background 0.2s",
            marginBottom: "20px",
          }}
          onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = "#4a42d6" }}
          onMouseLeave={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = "#5b52e8" }}
        >
          {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
        </button>

        {/* Bottom toggle */}
        <p style={{
          textAlign: "center",
          fontSize: "13px",
          color: "#6b7280",
          margin: 0,
        }}>
          {isLogin ? "New to CivicSolve? " : "Already have an account? "}
          <span
            onClick={() => setIsLogin(!isLogin)}
            style={{
              color: "#5b52e8",
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            {isLogin ? "Create one" : "Sign in"}
          </span>
        </p>

      </div>
    </div>
  );
}
