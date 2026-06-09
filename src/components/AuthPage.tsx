import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { secureGetDoc, secureSetDoc } from "../lib/firestoreUtils";
import { Server, ArrowLeft, Mail, Lock, User, AlertCircle, Sparkles, CheckCircle } from "lucide-react";
import { motion } from "motion/react";

interface AuthPageProps {
  onSuccess: () => void;
  onBackToLanding: () => void;
  initialMode?: "login" | "register";
}

export default function AuthPage({ onSuccess, onBackToLanding, initialMode = "login" }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot_password" | "verification_sent">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        onSuccess();
      } else if (mode === "register") {
        if (!name.trim()) throw new Error("Please enter your name.");
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const user = credential.user;
        
        // Update profile in Auth with the user's full name so that App.tsx can capture it
        await updateProfile(user, { displayName: name });
        
        try {
          await sendEmailVerification(user);
        } catch (vErr) {
          console.warn("Verification email skip:", vErr);
        }

        setMode("verification_sent");
      } else if (mode === "forgot_password") {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Password reset email sent! Check your inbox.");
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || "An authentication error occurred.";
      if (err.code === "auth/operation-not-allowed") {
        errMsg = "Email/Password sign-in is not enabled in your Firebase project. Please use the 'Login with Google Workspace' button instead, or enable 'Email/Password' under Sign-in methods in your Firebase Auth Console.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || "Google authentication encounter. Please try again.";
      if (err.code === "auth/operation-not-allowed") {
        errMsg = "Google sign-in is not enabled in your Firebase project. Please enable 'Google' under Sign-in methods in your Firebase Auth Console.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col justify-center items-center p-4 sm:p-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.06),transparent_50%)]" />

      {/* Responsive natural Header return */}
      <div className="w-full max-w-md mb-6 z-10 flex justify-start">
        <button 
          onClick={onBackToLanding}
          className="text-xs font-mono text-[#D1D5DB] hover:text-white flex items-center gap-2 group cursor-pointer transition-colors px-1 py-1"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-emerald-400" />
          Return to Landing Home
        </button>
      </div>

      {/* Main glass box form container */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-[#0a1120]/60 border border-white/5 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center mb-4">
            <Server className="w-6 h-6 text-emerald-400" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-white">
            {mode === "login" && "Welcome Back"}
            {mode === "register" && "Create Account"}
            {mode === "forgot_password" && "Reset Password"}
            {mode === "verification_sent" && "Verify Email"}
          </span>
          <p className="text-xs text-gray-400 mt-2 text-center max-w-xs">
            {mode === "login" && "Enter details to monitor python servers"}
            {mode === "register" && "Deploy bots instantly on isolated host hardware"}
            {mode === "forgot_password" && "Receive security recovery verification links"}
            {mode === "verification_sent" && "Authentication registered successfully"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 leading-relaxed font-mono">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-300 leading-relaxed font-mono">{successMsg}</p>
          </div>
        )}

        {mode !== "verification_sent" ? (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wide">Your Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full bg-[#080c14] border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-sans"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wide">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-[#080c14] border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                  required
                />
              </div>
            </div>

            {mode !== "forgot_password" && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-gray-400 font-mono uppercase tracking-wide">Sequence Password</label>
                  {mode === "login" && (
                    <button 
                      type="button" 
                      onClick={() => setMode("forgot_password")}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#080c14] border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              id="auth-submit-btn"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-black font-display font-semibold rounded-xl text-xs tracking-wider transition-all duration-300 cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.2)] disabled:cursor-not-allowed mt-6"
            >
              {loading ? "AUTHENTICATING SERVER LOGS..." : (
                mode === "login" ? "SIGN IN INSTANTLY" : 
                mode === "register" ? "INITIALIZE DISK DEPLOYMENT" : "SEND RECOVERY MAIL"
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <Sparkles className="w-12 h-12 text-emerald-400 animate-bounce" />
            </div>
            <p className="text-xs text-gray-300 leading-relaxed max-w-sm mx-auto">
              We have dispatched a security verification email link to <span className="text-white font-mono">{email}</span>. Click the link to qualify and activate your sandboxed space.
            </p>
            <button 
              onClick={() => setMode("login")}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl text-xs font-semibold text-white tracking-widest uppercase cursor-pointer"
            >
              Proceed to Sign In
            </button>
          </div>
        )}

        {mode !== "verification_sent" && (
          <>
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
              <span className="relative bg-[#0b0f19] px-3 text-[10px] text-gray-500 font-mono tracking-widest uppercase">Or OAuth Engine</span>
            </div>

            <button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              id="google-signin-btn"
              className="w-full py-3 bg-[#080d15] hover:bg-white/5 border border-white/5 rounded-xl text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer duration-300 hover:border-white/15"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.65-.62-1.04-1.39-1.21-2.19z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Login with Google Workspace
            </button>

            <div className="mt-8 text-center">
              {mode === "login" && (
                <p className="text-xs text-gray-400">
                  New to our bot hardware? {" "}
                  <button 
                    onClick={() => setMode("register")}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline underline-offset-4"
                  >
                    Create client account
                  </button>
                </p>
              )}
              {(mode === "register" || mode === "forgot_password") && (
                <p className="text-xs text-gray-400">
                  Already have hosting credentials? {" "}
                  <button 
                    onClick={() => setMode("login")}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline underline-offset-4"
                  >
                    Sign in here
                  </button>
                </p>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
