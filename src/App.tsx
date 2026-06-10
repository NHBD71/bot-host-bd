import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { secureGetDoc, secureSetDoc, secureUpdateDoc } from "./lib/firestoreUtils";
import { UserProfile } from "./types";
import LandingPage from "./components/LandingPage";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import AdminPanel from "./components/AdminPanel";
import DocPage from "./components/DocPage";
import { Server, ShieldAlert, Cpu, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [screen, setScreen] = useState<"landing" | "login" | "register" | "dashboard" | "admin" | "docs">("landing");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Subscribe to Firebase auth transitions
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Retrieve user profile document
          let profile = await secureGetDoc("users", currentUser.uid) as UserProfile | null;
          
          // Auto-upgrade system owner email to admin role
          if (currentUser.email === "rootyou518@gmail.com") {
            if (!profile) {
              const newProfile = {
                uid: currentUser.uid,
                name: currentUser.displayName || "Root Admin",
                email: currentUser.email,
                role: "admin",
                plan: "enterprise",
                status: "active"
              };
              await secureSetDoc("users", currentUser.uid, {
                ...newProfile,
                createdAt: serverTimestamp()
              });
              profile = {
                ...newProfile,
                createdAt: new Date().toISOString()
              } as UserProfile;
            } else if (profile.role !== "admin" || profile.plan !== "enterprise") {
              profile.role = "admin";
              profile.plan = "enterprise";
              await secureUpdateDoc("users", currentUser.uid, {
                role: "admin",
                plan: "enterprise"
              });
            }
          }

          if (profile) {
            setUserProfile(profile);
            setScreen("dashboard");
          } else {
            // Unregistered user profile safeguard - provision profile doc
            const defaultProfile = {
              uid: currentUser.uid,
              name: currentUser.displayName || currentUser.email?.split("@")[0] || "Client Host",
              email: currentUser.email || "",
              role: "user",
              plan: "free",
              status: "active"
            };
            await secureSetDoc("users", currentUser.uid, {
              ...defaultProfile,
              createdAt: serverTimestamp()
            });
            setUserProfile({
              ...defaultProfile,
              createdAt: new Date().toISOString()
            } as UserProfile);
            setScreen("dashboard");
          }
        } catch (err) {
          console.error("Profile payload sync error:", err);
        }
      } else {
        setUserProfile(null);
        if (screen !== "login" && screen !== "register" && screen !== "docs") {
          setScreen("landing");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setScreen("landing");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Pre-loader sequence
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center animate-spin">
          <Cpu className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="font-mono text-xs text-gray-500 tracking-widest uppercase">Initializing BotHost-BD Clusters...</div>
      </div>
    );
  }

  // Suspension / Ban Screens
  if (userProfile && (userProfile.status === "banned" || userProfile.status === "suspended")) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md p-8 rounded-2xl bg-red-500/5 border border-red-500/15 space-y-6"
        >
          <div className="flex justify-center">
            <ShieldAlert className="w-16 h-16 text-red-500 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display font-extrabold text-white text-xl uppercase">Infrastructure Suspension Notice</h1>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              Access credentials mapped to UID <span className="text-white block">{userProfile.uid}</span> have been suspended or banned for host code violations.
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full py-3 bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-400 rounded-xl text-xs font-bold font-mono tracking-widest uppercase cursor-pointer"
          >
            Acknowledge & Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {screen === "landing" && (
        <LandingPage 
          onGetStarted={() => setScreen("register")} 
          onLogin={() => setScreen("login")} 
        />
      )}

      {(screen === "login" || screen === "register") && (
        <AuthPage 
          key={screen}
          initialMode={screen} 
          onSuccess={() => setScreen("dashboard")} 
          onBackToLanding={() => setScreen("landing")} 
        />
      )}

      {screen === "dashboard" && userProfile && (
        <Dashboard 
          userProfile={userProfile} 
          onLogout={handleLogout}
          onEnterAdmin={userProfile.role === "admin" ? () => setScreen("admin") : undefined}
        />
      )}

      {screen === "admin" && userProfile && userProfile.role === "admin" && (
        <AdminPanel 
          adminUser={userProfile} 
          onExit={() => setScreen("dashboard")} 
        />
      )}
    </AnimatePresence>
  );
}
