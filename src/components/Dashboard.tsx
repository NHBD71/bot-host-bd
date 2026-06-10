import React, { useState, useEffect } from "react";
import { secureGetDocs, secureAddDoc, secureDeleteDoc, secureUpdateDoc, secureSetDoc } from "../lib/firestoreUtils";
import { BotMetadata, UserProfile, Announcement, HostingPlan, SubscriptionRequest } from "../types";
import { 
  Server, Cpu, Layers, RefreshCw, Plus, Trash2, StopCircle, 
  Play, Settings, Terminal, Search, Download, AlertCircle, 
  HelpCircle, CheckCircle, FileCode, Upload, ShieldAlert,
  Sliders, User, Volume2, HardDrive, HelpCircle as HelpIcon, ArrowUpRight,
  Menu, X
} from "lucide-react";
import SupportSystem from "./SupportSystem";
import { auth } from "../firebase";
import { serverTimestamp } from "firebase/firestore";

interface DashboardProps {
  userProfile: UserProfile;
  onLogout: () => void;
  onEnterAdmin?: () => void;
}

export default function Dashboard({ userProfile, onLogout, onEnterAdmin }: DashboardProps) {
  const [bots, setBots] = useState<BotMetadata[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [plans, setPlans] = useState<HostingPlan[]>([]);
  const [subRequests, setSubRequests] = useState<SubscriptionRequest[]>([]);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Bkash' | 'Nagad'>('Bkash');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"bots" | "create" | "notices" | "support" | "billing">("bots");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Create Bot Fields
  const [newBotName, setNewBotName] = useState("");
  const [newBotToken, setNewBotToken] = useState("");
  const [newBotDesc, setNewBotDesc] = useState("");
  const [newPythonVersion, setNewPythonVersion] = useState<"3.10" | "3.11" | "3.12">("3.12");
  
  // File uploading states
  const [botPyContent, setBotPyContent] = useState<string>("");
  const [requirementsContent, setRequirementsContent] = useState<string>("");
  const [botPyFileName, setBotPyFileName] = useState<string>("");
  const [reqsFileName, setReqsFileName] = useState<string>("");
  const [fileError, setFileError] = useState<string | null>(null);

  // Active Logging Terminal State
  const [logBot, setLogBot] = useState<BotMetadata | null>(null);
  const [logContent, setLogContent] = useState<string>("");
  const [logSearch, setLogSearch] = useState<string>("");
  const [logPollingInterval, setLogPollingInterval] = useState<any>(null);

  // Active Bot Setting Editor Modal State
  const [editingBot, setEditingBot] = useState<BotMetadata | null>(null);
  const [editBotName, setEditBotName] = useState("");
  const [editBotToken, setEditBotToken] = useState("");
  const [editBotEnv, setEditBotEnv] = useState("");
  const [editAutoRestart, setEditAutoRestart] = useState(true);
  const [editBotPyContent, setEditBotPyContent] = useState<string | null>(null);
  const [editBotPyFileName, setEditBotPyFileName] = useState<string>("");
  const [editRequirementsContent, setEditRequirementsContent] = useState<string | null>(null);
  const [editRequirementsFileName, setEditRequirementsFileName] = useState<string>("");
  const [editFileError, setEditFileError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserData();
  }, [activeTab]);

  // Handle Log Polling
  useEffect(() => {
    if (logBot) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 3000);
      setLogPollingInterval(interval);
      return () => {
        clearInterval(interval);
      };
    } else {
      if (logPollingInterval) {
        clearInterval(logPollingInterval);
        setLogPollingInterval(null);
      }
    }
  }, [logBot, logSearch]);

  async function fetchUserData() {
    setLoading(true);
    try {
      // Query individual active user bots from Firestore
      const userBots = await secureGetDocs("bots", [{ field: "ownerId", operator: "==", value: userProfile.uid }]);
      setBots((userBots || []) as any);

      // Query broadcast notifications
      const news = await secureGetDocs("announcements");
      setAnnouncements((news || []) as any);

      // Query plans collection
      const pricingPlans = await secureGetDocs("plans");
      setPlans((pricingPlans || []) as any);

      // Query payment requests for user
      const userRequests = await secureGetDocs("subscription_requests", [{ field: "userId", operator: "==", value: userProfile.uid }]);
      setSubRequests((userRequests || []) as any);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitUpgradeRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUpgradePlan) return;
    if (!senderNumber.trim() || !transactionId.trim()) {
      alert("Please provide all payment verification details.");
      return;
    }

    setSubmittingRequest(true);
    try {
      const generatedRequestId = `req-${Math.random().toString(36).substring(2, 11)}`;
      const requestPayload: SubscriptionRequest = {
        requestId: generatedRequestId,
        userId: userProfile.uid,
        userName: userProfile.name,
        userEmail: userProfile.email,
        planId: selectedUpgradePlan.id || selectedUpgradePlan.name.toLowerCase(),
        planName: selectedUpgradePlan.name,
        price: selectedUpgradePlan.price,
        paymentMethod: paymentMethod,
        senderNumber: senderNumber.trim(),
        transactionId: transactionId.trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await secureAddDoc("subscription_requests", requestPayload);
      alert("Your payment transaction request has been submitted successfully! Admin will verify the TrxID and activate your plan.");
      
      // Reset state
      setSenderNumber('');
      setTransactionId('');
      setIsUpgradeModalOpen(false);
      setSelectedUpgradePlan(null);
      fetchUserData();
    } catch (err) {
      alert("Failed to record payment transaction reference.");
    } finally {
      setSubmittingRequest(false);
    }
  }

  // File parsing validation helpers
  function checkForbiddenExtensions(name: string): boolean {
    const forbidden = ["zip", "exe", "bat", "sh", "apk", "php", "js", "html", "rar", "7z", "tar", "gz"];
    const ext = name.split(".").pop()?.toLowerCase();
    return ext ? forbidden.includes(ext) : false;
  }

  const handleBotPyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5242880) {
      setFileError("File: bot.py exceeds 5MB size envelope limit.");
      return;
    }

    if (file.name !== "bot.py") {
      setFileError("Upload failed: Primary file name must be exactly 'bot.py'.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      setBotPyContent(evt.target?.result as string);
      setBotPyFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleRequirementsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5242880) {
      setFileError("File: requirements.txt exceeds 5MB limit.");
      return;
    }

    const normalizedName = file.name.toLowerCase();
    if (normalizedName !== "requirements.txt" && normalizedName !== "requirement.txt") {
      setFileError("Upload failed: Requirements file must be 'requirements.txt' or 'requirement.txt'.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      setRequirementsContent(evt.target?.result as string);
      setReqsFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleEditBotPyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5242880) {
      setEditFileError("File: bot.py exceeds 5MB size limit.");
      return;
    }

    if (file.name !== "bot.py") {
      setEditFileError("Upload failed: File name must be exactly 'bot.py'.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      setEditBotPyContent(evt.target?.result as string);
      setEditBotPyFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleEditRequirementsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5242880) {
      setEditFileError("File: requirements.txt exceeds 5MB size limit.");
      return;
    }

    const normalizedName = file.name.toLowerCase();
    if (normalizedName !== "requirements.txt" && normalizedName !== "requirement.txt") {
      setEditFileError("Upload failed: Requirements file must be 'requirements.txt' or 'requirement.txt'.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      setEditRequirementsContent(evt.target?.result as string);
      setEditRequirementsFileName(file.name);
    };
    reader.readAsText(file);
  };

  // Create Bot Workspace Dispatch
  async function handleCreateBot(e: React.FormEvent) {
    e.preventDefault();
    setFileError(null);

    // Limit active slots based on current selected tier or dynamic plan
    const currentPlan = plans.find(p => p.name.toLowerCase() === userProfile.plan.toLowerCase());
    const limitMap: Record<string, number> = { free: 1, premium: 10, enterprise: 99999 };
    const currentLimit = currentPlan ? Number(currentPlan.maxBots) : (limitMap[userProfile.plan.toLowerCase()] || 1);
    if (bots.length >= currentLimit) {
      setFileError(`Active bot limit reached! Your plan allows max ${currentLimit} bots. Upgrade in Billings tab.`);
      return;
    }

    if (!botPyContent) {
      setFileError("Configuration profile required: 'bot.py' must be uploaded.");
      return;
    }

    if (!newBotToken.trim()) {
      setFileError("Bots cannot poll without a valid Token.");
      return;
    }

    setLoading(true);
    const generatedBotId = `bot-${Math.random().toString(36).substring(2, 11)}`;

    try {
      // 1. Submit static source texts to back-end for validation and write
      const writeResponse = await fetch(`/api/bots/${generatedBotId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userProfile.uid,
          botName: newBotName.trim(),
          botPy: botPyContent,
          requirementsTxt: requirementsContent,
          pythonVersion: newPythonVersion
        })
      });

      const writeResult = await writeResponse.json();
      if (!writeResponse.ok) {
        throw new Error(writeResult.error || "Workspace initialization failure.");
      }

      // 2. Register bot metadata profile in Firestore using ABAC standards
      const freshBot = {
        botId: generatedBotId,
        ownerId: userProfile.uid,
        botName: newBotName.trim(),
        token: newBotToken.trim(),
        description: newBotDesc.trim(),
        status: "offline",
        uptime: 0,
        pythonVersion: newPythonVersion,
        createdAt: serverTimestamp(),
        autoRestart: true,
        envVars: "{}",
        codeText: botPyContent
      };

      await secureSetDoc("bots", generatedBotId, freshBot);
      
      // Reset forms
      setNewBotName("");
      setNewBotToken("");
      setNewBotDesc("");
      setBotPyContent("");
      setRequirementsContent("");
      setBotPyFileName("");
      setReqsFileName("");
      
      alert("Bot created successfully! Redirecting to dashboard...");
      setActiveTab("bots");
    } catch (err: any) {
      setFileError(err.message || "Failed to organize bot architecture.");
    } finally {
      setLoading(false);
    }
  }

  // Manage Active Server Processes (Start, Stop, Restart, Delete)
  async function triggerBotProcessAction(bot: BotMetadata, action: "start" | "stop" | "restart") {
    try {
      const res = await fetch(`/api/bots/${bot.botId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userProfile.uid,
          botName: bot.botName,
          autoRestart: bot.autoRestart !== false,
          origin: window.location.origin
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Trigger rapid refresh to pull status changes
        fetchUserData();
      } else {
        alert(`Process Control Alert: ${data.error}`);
      }
    } catch (err) {
      alert("Lost connectivity with VPS host.");
    }
  }

  async function handleDeleteBotWorkspace(bot: BotMetadata) {
    if (!confirm(`Warning: This triggers permanent eradication of all workspace files for ${bot.botName}. Continue?`)) return;
    
    try {
      // Clear active log selection if the deleted bot is being actively logged
      if (logBot && logBot.botId === bot.botId) {
        setLogBot(null);
        setLogContent("");
      }

      // 1. Map document ID from the loaded bot state (with fallback to client query)
      const docId = (bot as any).id || bot.botId;

      // 2. Direct server to kill process, clean filesystem, and perform Firestore deletion
      const res = await fetch(`/api/bots/${bot.botId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: userProfile.uid,
          documentId: docId
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to purge database records or disk workspace assets.");
      }

      // 3. Keep local fallback in case backend REST didn't reach client sync rules cleanly
      try {
        await secureDeleteDoc("bots", docId);
      } catch (dbErr) {
        console.log("Local Firestore direct delete skipped or ignored (already handled on server):", dbErr);
      }

      alert(`Bot "${bot.botName}" and its cloud workspace have been successfully deleted.`);
      fetchUserData();
    } catch (err: any) {
      alert(`Failed to delete bot workspace: ${err.message || err}`);
    }
  }

  // Live Logs API Retrieval
  async function fetchLogs() {
    if (!logBot) return;
    try {
      const res = await fetch(`/api/bots/${logBot.botId}/logs?userId=${userProfile.uid}&search=${logSearch}`);
      const data = await res.json();
      if (res.ok) {
        setLogContent(data.logs || "");
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleClearLogs() {
    if (!logBot) return;
    try {
      await fetch(`/api/bots/${logBot.botId}/clear-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userProfile.uid })
      });
      fetchLogs();
    } catch (e) {
      console.error(e);
    }
  }

  function handleDownloadLogs() {
    if (!logBot) return;
    const blob = new Blob([logContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${logBot.botName}_host_logs.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Update Bot Settings Dialog
  function openSettingsEditor(bot: BotMetadata) {
    setEditingBot(bot);
    setEditBotName(bot.botName);
    setEditBotToken(bot.token);
    setEditBotEnv(bot.envVars || "{}");
    setEditAutoRestart(bot.autoRestart !== false);
    setEditBotPyContent(null);
    setEditBotPyFileName("");
    setEditRequirementsContent(null);
    setEditRequirementsFileName("");
    setEditFileError(null);
  }

  async function saveBotSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBot) return;

    if (editFileError) {
      alert(`File Error: ${editFileError}`);
      return;
    }

    try {
      // Validate key pairs json
      let parsedEnv = {};
      try {
        parsedEnv = JSON.parse(editBotEnv);
      } catch {
        alert("Environment variables must be a valid flat JSON format. E.g. {\"DB_URL\": \"redis://abc\"}");
        return;
      }

      // 1. If user selected/uploaded new files, verify and POST to server side first
      if (editBotPyContent !== null || editRequirementsContent !== null) {
        const updateRes = await fetch(`/api/bots/${editingBot.botId}/update-files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userProfile.uid,
            botPy: editBotPyContent,
            requirementsTxt: editRequirementsContent
          })
        });

        if (!updateRes.ok) {
          const errData = await updateRes.json();
          alert(`File Setup Update Error: ${errData.error || "Failed to update files on the host system."}`);
          return;
        }
      }

      // 2. Commit metadata variables to Firestore
      const snapshot = await secureGetDocs("bots", [{ field: "botId", operator: "==", value: editingBot.botId }]);
      if (snapshot && snapshot.length > 0) {
        const docId = (snapshot[0] as any).id;
        await secureUpdateDoc("bots", docId, {
          botName: editBotName.trim(),
          token: editBotToken.trim(),
          envVars: editBotEnv.trim(),
          autoRestart: editAutoRestart,
          codeText: editBotPyContent !== null ? editBotPyContent : (editingBot.codeText || "")
        });

        // If status is running, trigger restart automatically to inject environments and run new code
        if (editingBot.status === "running") {
          triggerBotProcessAction(editingBot, "restart");
        }

        setEditingBot(null);
        alert("Bot parameters and workspace files updated successfully!");
        fetchUserData();
      }
    } catch (e: any) {
      alert(`Failed core parameters update: ${e.message || e}`);
    }
  }

  // Stats Counters
  const runningCount = bots.filter(b => b.status === "running").length;
  const offlineCount = bots.filter(b => b.status !== "running").length;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      {/* Dynamic Upper Bar navbar */}
      <header className="sticky top-0 z-40 bg-[#080d16]/95 backdrop-blur-md border-b border-white/5 py-3 px-4 md:px-12 flex flex-col lg:flex-row justify-between items-center gap-3.5 lg:gap-4">
        {/* Row 1: Logo and Quick Actions on Mobile */}
        <div className="flex w-full lg:w-auto items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center">
              <Cpu className="w-4.5 h-4.5 md:w-5 md:h-5 text-emerald-400" />
            </div>
            <div>
              <span className="font-display font-bold text-base md:text-lg text-white leading-tight block">BotHost BD Hub</span>
              <span className="block text-[8px] md:text-[9px] text-[#86EFAC] font-mono uppercase tracking-wider font-semibold">Live Bot Console</span>
            </div>
          </div>

          {/* Quick exit and toggle controls on mobile */}
          <div className="flex items-center gap-2 lg:hidden">
            {userProfile.role === "admin" && onEnterAdmin && (
              <button 
                onClick={onEnterAdmin}
                className="px-2.5 py-1 text-[9px] font-bold border border-rose-500/30 text-rose-400 hover:bg-rose-500/5 transition cursor-pointer rounded-md"
              >
                ADMIN
              </button>
            )}
            
            {/* Direct Profile Access button on mobile */}
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold flex items-center justify-center hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              title="My Account Profile"
            >
              <User className="w-4 h-4 text-emerald-400" />
            </button>

            {/* Premium Hamburger Menu Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 active:scale-95 transition-all cursor-pointer"
              title="Toggle Menu"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4 text-emerald-400" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Tab Controls: DISPLAY ONLY ON DESKTOP DIRECTLY */}
        <div className="hidden lg:flex bg-[#05080e] border border-white/5 rounded-xl p-1 gap-1 w-auto">
          <button 
            onClick={() => { setActiveTab("bots"); setLogBot(null); }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === "bots" ? "bg-emerald-500 text-black shadow-lg font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            Workspaces
          </button>
          <button 
            onClick={() => { setActiveTab("create"); setLogBot(null); }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === "create" ? "bg-emerald-500 text-black shadow-lg font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            Create Bot
          </button>
          <button 
            onClick={() => { setActiveTab("notices"); setLogBot(null); }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === "notices" ? "bg-emerald-500 text-black shadow-lg font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            System Notices
          </button>
          <button 
            onClick={() => { setActiveTab("support"); setLogBot(null); }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === "support" ? "bg-emerald-500 text-black shadow-lg font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            Support (সাপোর্ট)
          </button>
          <button 
            onClick={() => { setActiveTab("billing"); setLogBot(null); }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === "billing" ? "bg-emerald-500 text-black shadow-lg font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            Billings
          </button>
        </div>

        {/* User context triggers: Hidden on mobile */}
        <div className="hidden lg:flex items-center gap-4">
          {userProfile.role === "admin" && onEnterAdmin && (
            <button 
              onClick={onEnterAdmin}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-rose-500/30 text-rose-400 hover:bg-rose-500/5 transition cursor-pointer"
            >
              ADMIN PANEL
            </button>
          )}
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="text-right border-r border-white/5 pr-4 flex items-center gap-2 hover:opacity-85 transition cursor-pointer bg-transparent border-0"
            title="Click to view full profile details"
          >
            <div className="text-right">
              <div className="text-xs font-bold text-white uppercase">{userProfile.name}</div>
              <div className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider font-semibold">Tier: {userProfile.plan}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold uppercase">
              {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U"}
            </div>
          </button>
          <button 
            onClick={onLogout}
            id="dash-logout-btn"
            className="px-4 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors font-medium cursor-pointer"
          >
            Exit Hub
          </button>
        </div>
      </header>

      {/* MOBILE COLLAPSIBLE DRAWER MENU: Renders when menu is toggled */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-b border-white/5 bg-[#05080e]/95 backdrop-blur-lg px-4 py-4 space-y-3 z-30 transition-all shadow-xl">
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest pb-1 border-b border-white/5">Console Functions</div>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => { setActiveTab("bots"); setIsMobileMenuOpen(false); setLogBot(null); }}
              className={`flex items-center gap-2 p-3 text-xs font-medium rounded-xl transition cursor-pointer ${
                activeTab === "bots" ? "bg-emerald-500 text-black font-bold" : "bg-white/[0.02] border border-white/5 text-gray-300 hover:text-white"
              }`}
            >
              <Cpu className="w-4 h-4" /> Workspaces
            </button>
            <button 
              onClick={() => { setActiveTab("create"); setIsMobileMenuOpen(false); setLogBot(null); }}
              className={`flex items-center gap-2 p-3 text-xs font-medium rounded-xl transition cursor-pointer ${
                activeTab === "create" ? "bg-emerald-500 text-black font-bold" : "bg-white/[0.02] border border-white/5 text-gray-300 hover:text-white"
              }`}
            >
              <Plus className="w-4 h-4" /> Create Bot
            </button>
            <button 
              onClick={() => { setActiveTab("notices"); setIsMobileMenuOpen(false); setLogBot(null); }}
              className={`flex items-center gap-2 p-3 text-xs font-medium rounded-xl transition cursor-pointer ${
                activeTab === "notices" ? "bg-emerald-500 text-black font-bold" : "bg-white/[0.02] border border-white/5 text-gray-300 hover:text-white"
              }`}
            >
              <Sliders className="w-4 h-4" /> System Notices
            </button>
            <button 
              onClick={() => { setActiveTab("support"); setIsMobileMenuOpen(false); setLogBot(null); }}
              className={`flex items-center gap-2 p-3 text-xs font-medium rounded-xl transition cursor-pointer ${
                activeTab === "support" ? "bg-emerald-500 text-black font-bold" : "bg-white/[0.02] border border-white/5 text-gray-300 hover:text-white"
              }`}
            >
              <HelpCircle className="w-4 h-4" /> Support (সাপোর্ট)
            </button>
            <button 
              onClick={() => { setActiveTab("billing"); setIsMobileMenuOpen(false); setLogBot(null); }}
              className={`flex items-center gap-2 p-3 text-xs font-medium rounded-xl col-span-2 transition cursor-pointer ${
                activeTab === "billing" ? "bg-emerald-500 text-black font-bold" : "bg-white/[0.02] border border-white/5 text-gray-300 hover:text-white"
              }`}
            >
              <Sliders className="w-4 h-4 text-cyan-400" /> Host Billings
            </button>
          </div>

          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest pt-2 pb-1 border-b border-white/5">My Account Identity</div>
          
          {/* Mobile Profile Trigger Shortcut */}
          <button 
            type="button"
            onClick={() => { setIsProfileModalOpen(true); setIsMobileMenuOpen(false); }}
            className="w-full flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 rounded-xl text-left cursor-pointer transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center font-bold font-mono text-xs">
                {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div>
                <span className="block text-xs font-bold text-white uppercase">{userProfile.name}</span>
                <span className="block text-[9px] text-[#A7F3D0] font-mono">Tier: {userProfile.plan.toUpperCase()}</span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">Expand Details &rarr;</span>
          </button>

          {/* Quick Exit inside Mobile navigation menu */}
          <button 
            onClick={onLogout}
            className="w-full py-2.5 mt-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-semibold text-xs rounded-xl uppercase transition cursor-pointer text-center"
          >
            Disconnect Account
          </button>
        </div>
      )}

      {/* Primary stat layout: 3 elegant horizontal rows on mobile, 5 premium columns on desktop */}
      <section className="bg-white/[0.01] border-b border-white/5 py-4 md:py-6 px-4 md:px-12 w-full">
        <div className="max-w-7xl mx-auto">
          {/* Mobile View: 3 Premium horizontal cards/lines */}
          <div className="flex flex-col gap-3 md:hidden">
            {/* Row 1: Workspace Activity (Installed & Active Bots) */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#0d1627] to-[#0a1120] border border-white/5 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Workspace Activity</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm font-bold text-white">{bots.length} Installed</span>
                    <span className="text-gray-600 text-xs">•</span>
                    <span className="text-sm font-bold text-emerald-400">{runningCount} Running</span>
                  </div>
                </div>
              </div>
              <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">Active</span>
            </div>

            {/* Row 2: Slots & Resource Allocation */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#0d1627] to-[#0a1120] border border-white/5 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Resource Allocation</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-semibold text-gray-300">
                      {userProfile.plan === "free" && "1 Script Limit"}
                      {userProfile.plan === "premium" && "10 Scripts Limit"}
                      {userProfile.plan === "enterprise" && "Unlimited Slots"}
                    </span>
                    <span className="text-gray-600 text-[9px] font-mono">({offlineCount} idle)</span>
                  </div>
                </div>
              </div>
              <span className="text-[8px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded uppercase">Tier: {userProfile.plan}</span>
            </div>

            {/* Row 3: SLA & Hardware Status */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#091120]/45 to-[#050912]/45 border border-white/5 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Hardware Node health</span>
                  <span className="text-xs font-bold text-emerald-400 mt-0.5 block">SLA GUARANTEED 99.9%</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-mono text-gray-400 uppercase font-bold">Live Stream</span>
              </div>
            </div>
          </div>

          {/* Desktop View: Sleek 5-column flat grid */}
          <div className="hidden md:grid grid-cols-5 gap-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Bots Installed</span>
              <div className="font-display font-extrabold text-2xl text-white">{bots.length}</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-1">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold block">Running Bots</span>
              <div className="font-display font-extrabold text-2xl text-white">{runningCount}</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Offline Slots</span>
              <div className="font-display font-extrabold text-2xl text-white">{offlineCount}</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Uptime Limits</span>
              <div className="font-display font-bold text-sm text-emerald-400 truncate leading-snug">
                {userProfile.plan === "free" && "1 Script Max"}
                {userProfile.plan === "premium" && "10 Scripts Max"}
                {userProfile.plan === "enterprise" && "Unlimited"}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#091120]/40 border border-white/5 space-y-1">
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Hardware Status</span>
              <div className="font-mono text-xs text-white flex items-center gap-1.5 pt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-emerald-400">99.9% MONITOR</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Viewport content sheets */}
      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 md:p-12 flex-1">
        {activeTab === "bots" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 gap-4">
              <h2 className="font-display font-bold text-lg md:text-xl text-white">Your Managed Py Workspaces</h2>
              <button 
                onClick={() => setActiveTab("create")}
                className="w-full sm:w-auto justify-center px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-display font-bold text-xs tracking-wide uppercase rounded-xl flex items-center gap-2 cursor-pointer transition-shadow"
              >
                <Plus className="w-4 h-4 text-black" /> Create Bot Workspace
              </button>
            </div>

            {/* Direct Instant Support Admin Notice Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-cyan-500/5 border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg text-left">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-widest font-extrabold">Support Admin Contact</span>
                </div>
                <p className="text-gray-300 text-xs sm:text-sm font-sans font-medium leading-relaxed">
                  যেকোনো সমস্যার তাত্ক্ষণিক সমাধানের জন্য, পেমেন্ট অ্যাপ্রুভ বা কাস্টম বট হোস্ট কোড ভেরিফিকেশনের জন্য সরাসরি নিচে দেওয়া লিঙ্কে আমাদের টেলিগ্রামে নক করুন।
                </p>
                <div className="text-[11px] font-mono text-gray-400">
                  Telegram Username: <span className="text-emerald-400 font-bold select-all font-mono">@noobxvau</span> (24/7 Support)
                </div>
              </div>
              <a 
                href="https://t.me/noobxvau"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full md:w-auto px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 shrink-0 text-center shadow-[0_4px_12px_rgba(16,185,129,0.15)] hover:shadow-[0_4px_20px_rgba(16,185,129,0.3)] font-display"
              >
                Contact Admin &rarr;
              </a>
            </div>

            {bots.length === 0 ? (
              <div className="rounded-2xl p-8 md:p-16 border-2 border-dashed border-white/5 text-center space-y-4">
                <FileCode className="w-12 h-12 md:w-16 md:h-16 text-gray-700 mx-auto animate-bounce" />
                <div className="font-display font-bold text-base md:text-lg text-white">No Bot Workspaces Installed</div>
                <p className="text-gray-400 text-xs max-w-sm mx-auto">
                  Instantiate your very first Python package containing bot.py and requirements.txt straight on our sandboxed hosts!
                </p>
                <button 
                  onClick={() => setActiveTab("create")}
                  className="w-full sm:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Configure My First Bot
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                {bots.map((bot, idx) => (
                  <div key={idx} className="rounded-2xl p-5 md:p-6 bg-[#0c1220]/60 border border-white/5 flex flex-col justify-between space-y-5 md:space-y-6 hover:border-emerald-500/25 hover:shadow-[0_4px_24px_rgba(16,185,129,0.03)] transition-all duration-300">
                    <div>
                      {/* Bot card upper title bar */}
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <div>
                          <h3 className="font-display font-bold text-base text-white">{bot.botName}</h3>
                          <span className="font-mono text-[9px] text-gray-500">ID: {bot.botId}</span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono tracking-wider font-bold uppercase ${
                          bot.status === "running" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" : "bg-gray-500/10 text-gray-400 border border-white/5"
                        }`}>
                          ● {bot.status}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 line-clamp-2 h-8 mb-4">{bot.description || "No description provided."}</p>

                      {/* Hardware params specs */}
                      <div className="grid grid-cols-2 gap-3 p-3 bg-black/40 rounded-xl font-mono text-[10px] text-gray-400 mb-4">
                        <div>VERSION: <span className="text-white">Py {bot.pythonVersion}</span></div>
                        <div>RESTART: <span className="text-white">{bot.autoRestart !== false ? "AUTO" : "MAN"}</span></div>
                        <div className="col-span-2">CREATED: <span className="text-white">{new Date(bot.createdAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>

                    {/* Bot card interactions */}
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        {bot.status !== "running" ? (
                          <button 
                            onClick={() => triggerBotProcessAction(bot, "start")}
                            className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold font-display flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Play className="w-3.5 h-3.5 text-black" /> Run Bot
                          </button>
                        ) : (
                          <button 
                            onClick={() => triggerBotProcessAction(bot, "stop")}
                            className="flex-1 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold font-display flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <StopCircle className="w-3.5 h-3.5" /> Stop
                          </button>
                        )}
                        <button 
                          onClick={() => triggerBotProcessAction(bot, "restart")}
                          className="px-3 bg-white/5 hover:bg-white/10 text-white rounded-lg flex items-center justify-center border border-white/5 cursor-pointer"
                          title="Restart workspace process"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex gap-2 border-t border-white/5 pt-3">
                        <button 
                          onClick={() => setLogBot(bot)}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-[11px] font-mono font-semibold tracking-wide flex items-center justify-center gap-1 cursor-pointer border border-white/5 transition-all"
                        >
                          <Terminal className="w-3 h-3 text-emerald-400" /> Logs Console
                        </button>
                        <button 
                          onClick={() => openSettingsEditor(bot)}
                          className="px-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg flex items-center justify-center border border-white/5 cursor-pointer"
                          title="Workspace variables & auto-restart settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteBotWorkspace(bot)}
                          className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                          title="Delete bot workspace"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Bot Form Panel */}
        {activeTab === "create" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Left Setup inputs */}
            <form onSubmit={handleCreateBot} className="lg:col-span-1 p-5 md:p-8 rounded-2xl bg-[#0a1120]/60 border border-white/5 space-y-5 shadow-xl">
              <h3 className="font-display font-bold text-base md:text-lg text-white">Workspace Genesis Parameters</h3>
              
              {fileError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-xs text-red-300 font-mono leading-relaxed">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1.5 tracking-wider font-semibold">Bot Workspace Name</label>
                  <input 
                    type="text" 
                    value={newBotName}
                    onChange={e => setNewBotName(e.target.value)}
                    placeholder="e.g. BTC Price Updates Bot"
                    className="w-full bg-[#050911]/80 border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1.5 tracking-wider font-semibold">Telegram Bot Token (Secure)</label>
                  <input 
                    type="password" 
                    value={newBotToken}
                    onChange={e => setNewBotToken(e.target.value)}
                    placeholder="e.g. 123456:ABC-DEF1234ghIkl-zyx"
                    className="w-full bg-[#050911]/80 border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1.5 tracking-wider font-semibold">Short description</label>
                  <input 
                    type="text" 
                    value={newBotDesc}
                    onChange={e => setNewBotDesc(e.target.value)}
                    placeholder="e.g. Automatic cryptos notifier and handler"
                    className="w-full bg-[#050911]/80 border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1.5 tracking-wider font-semibold">Python Environment Execution</label>
                  <select 
                    value={newPythonVersion}
                    onChange={e => setNewPythonVersion(e.target.value as any)}
                    className="w-full bg-[#050911]/80 border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  >
                    <option value="3.12">Python 3.12 (Latest standard)</option>
                    <option value="3.11">Python 3.11</option>
                    <option value="3.10">Python 3.10</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-black font-display font-extrabold text-xs tracking-wider uppercase rounded-xl cursor-pointer transition shadow-[0_4px_12px_rgba(16,185,129,0.15)]"
              >
                {loading ? "INITIALIZING GATES..." : "GENERATE AND LAUNCH WORKSPACE"}
              </button>
            </form>

            {/* Right physical upload drag drop zone */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-5 md:p-8 rounded-2xl bg-[#0a1120]/45 border border-white/5 space-y-6 shadow-xl">
                <div>
                  <h4 className="font-display font-semibold text-white text-base">Files Setup Area</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-lg leading-relaxed">
                    You must upload bot.py. requirements.txt is optional (ঐচ্ছিক) if you have specialized pip libraries to compile. Only authorized python code and pip libraries limits are compiled.
                  </p>
                </div>

                {/* Upload Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                  {/* File 1: bot.py */}
                  <div className="p-5 md:p-6 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/30 transition-colors flex flex-col justify-between h-44 md:h-48 bg-[#040810]/50">
                    <div>
                      <FileCode className="w-7 h-7 text-emerald-400 mb-2.5" />
                      <div className="text-xs font-mono font-bold text-white uppercase flex items-center justify-between">
                        <span>bot.py</span>
                        <span className="text-[9px] text-rose-400 lowercase font-sans font-normal">(required)</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">Required. Defines polling methods, connection variables and Telegram commanding loops.</p>
                    </div>
                    <div>
                      <label className="block mt-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded text-center text-xs font-semibold cursor-pointer border border-white/5 transition">
                        Select bot.py
                        <input type="file" accept=".py" onChange={handleBotPyUpload} className="hidden" />
                      </label>
                      {botPyFileName && <span className="block text-[10px] text-emerald-400 font-mono mt-1 text-center truncate font-medium">{botPyFileName} Loaded</span>}
                    </div>
                  </div>

                  {/* File 2: requirements.txt */}
                  <div className="p-5 md:p-6 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/30 transition-colors flex flex-col justify-between h-44 md:h-48 bg-[#040810]/50">
                    <div>
                      <Sliders className="w-7 h-7 text-cyan-400 mb-2.5" />
                      <div className="text-xs font-mono font-bold text-white uppercase flex items-center gap-1.5">
                        requirements.txt <span className="text-[10px] text-gray-400 font-sans font-normal lowercase">(optional / ঐচ্ছিক)</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">Optional / ঐচ্ছিক. Defines external pip components (e.g. pyTelegramBotAPI or requests package).</p>
                    </div>
                    <div>
                      <label className="block mt-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded text-center text-[#E0F2FE] rounded text-center text-xs font-semibold cursor-pointer border border-white/5 transition">
                        Select requirements.txt
                        <input type="file" accept=".txt" onChange={handleRequirementsUpload} className="hidden" />
                      </label>
                      {reqsFileName && <span className="block text-[10px] text-cyan-400 font-mono mt-1 text-center truncate font-medium">{reqsFileName} Loaded</span>}
                    </div>
                  </div>
                </div>

                {/* Secure Sandbox Information Warnings */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-gray-300 leading-relaxed font-mono">
                    SECURITY WARNING: All uploaded packages are isolated. File uploads containing system level binaries, zip, tar, node libraries, or bash configurations will trigger auto-ban mechanisms across BotHost BD servers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notices Screen */}
        {activeTab === "notices" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <h2 className="font-display font-bold text-lg text-white">System Broadcasts</h2>
            {announcements.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-500 font-mono uppercase border border-white/5 rounded-2xl">
                No active announcements broadcasted currently.
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((item, idx) => (
                  <div key={idx} className="p-6 rounded-2xl glass-panel space-y-2 relative border-l-2 border-emerald-500">
                    <h3 className="font-display font-bold text-base text-white">{item.title}</h3>
                    <p className="text-xs text-gray-300 leading-relaxed">{item.message}</p>
                    <div className="text-[10px] font-mono text-gray-500 mt-1">Dispatched: {new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Support care workspace */}
        {activeTab === "support" && (
          <div className="space-y-6">
            <SupportSystem userId={userProfile.uid} userName={userProfile.name} isAdminMode={false} />
          </div>
        )}

        {/* Upgrade / Billing tabs */}
        {activeTab === "billing" && (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="font-display font-bold text-xl text-white">Select Your Deployment Plan</h2>
                <p className="text-xs text-gray-400 mt-1">Verify or elevate your active VPS bot slots based on infrastructure demands.</p>
              </div>
              <div className="text-[11px] font-mono p-2 bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 rounded-lg">
                Your Current Tier: <span className="uppercase font-bold text-emerald-400">{userProfile.plan}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(plans.length === 0 ? [
                { id: 'free', name: 'Free', price: 0, maxBots: 1, limits: '1 Active Bot Workspace\nBasic Shared CPU Cores\nStandard Logs Only' },
                { id: 'premium', name: 'Premium', price: 500, maxBots: 10, limits: '10 Active Bot Slots\nAuto-Restart Monitoring\nPremium Log Streaming' },
                { id: 'enterprise', name: 'Enterprise', price: 1500, maxBots: 100, limits: '100 Active Bot Slots\nDedicated CPU Limit\nPriority Support' },
              ] : plans).map((p: any) => {
                const isCurrent = userProfile.plan.toLowerCase() === p.name.toLowerCase();
                const pendingRequest = subRequests.find(r => r.planName.toLowerCase() === p.name.toLowerCase() && r.status === 'pending');
                
                return (
                  <div 
                    key={p.id || p.name} 
                    className={`p-6 rounded-xl space-y-4 flex flex-col justify-between relative transition-all duration-300 ${
                      isCurrent 
                        ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30' 
                        : 'glass-card border-white/5 hover:border-white/10'
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute top-4 right-4 bg-emerald-500 text-black text-[9px] font-mono uppercase px-2 py-0.5 rounded font-bold">
                        Current Active
                      </span>
                    )}
                    {pendingRequest && (
                      <span className="absolute top-4 right-4 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-mono uppercase px-2 py-0.5 rounded animate-pulse">
                        Pending Verification
                      </span>
                    )}

                    <div className="space-y-3">
                      <div className="font-display font-bold text-base text-white tracking-wider flex items-center gap-1.5 uppercase">
                        {p.name}
                      </div>
                      <div className="text-3xl font-display font-extrabold text-white mt-1">
                        {p.price} Taka <span className="text-xs text-gray-400 font-normal">/ mo</span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        Slots limit: <span className="text-white font-bold">{p.maxBots} active bots</span>
                      </div>
                      
                      <div className="text-xs text-gray-300 space-y-2 pt-2 font-mono border-t border-white/5">
                        {p.limits ? p.limits.split('\n').map((lim: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-400">
                            <span className="text-emerald-400">●</span> {lim}
                          </div>
                        )) : (
                          <div className="text-gray-400 font-mono">● Standard hosting slot allocation rules</div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4">
                      {isCurrent ? (
                        <button 
                          disabled
                          className="w-full py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-lg text-xs font-semibold uppercase tracking-wider text-center cursor-default"
                        >
                          Already Subscribed
                        </button>
                      ) : pendingRequest ? (
                        <div className="text-center text-[10px] text-amber-400 bg-amber-500/5 py-2 px-3 border border-amber-500/15 rounded-lg font-mono">
                          Pending: {pendingRequest.paymentMethod} (TrxID: {pendingRequest.transactionId})
                        </div>
                      ) : p.price === 0 ? (
                        <button 
                          disabled
                          className="w-full py-2 bg-white/5 text-gray-400 border border-white/5 rounded-lg text-xs font-semibold uppercase tracking-wider text-center"
                        >
                          Standard Tier
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            setSelectedUpgradePlan(p);
                            setIsUpgradeModalOpen(true);
                          }}
                          className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg text-xs font-semibold uppercase tracking-wider text-center cursor-pointer transition-colors"
                        >
                          Upgrade Plan
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Dynamic Payment Verification Modal */}
      {isUpgradeModalOpen && selectedUpgradePlan && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSubmitUpgradeRequest} className="w-full max-w-sm bg-[#0a1120] border border-white/10 rounded-2xl flex flex-col p-6 shadow-2xl relative my-auto">
            <button 
              type="button" 
              onClick={() => {
                setIsUpgradeModalOpen(false);
                setSelectedUpgradePlan(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl font-bold leading-none cursor-pointer"
            >
              &times;
            </button>

            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono uppercase px-2 py-1 rounded inline-block">
                  Subscribing to: {selectedUpgradePlan.name}
                </div>
                <h3 className="font-display font-bold text-lg text-white mt-2">bKash & Nagad Payment Portal</h3>
                <p className="text-[11px] text-gray-400 mt-1">
                  নিম্নোক্ত নাম্বারে <strong>{selectedUpgradePlan.price} Taka</strong> Send Money সম্পন্ন করার পর নিচের বিবরণ পূরণ করুন।
                </p>
              </div>

              {/* Payment Info Box */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" /> bKash Personal:
                  </span>
                  <span className="font-mono text-white font-bold select-all bg-white/5 px-2 py-0.5 rounded cursor-pointer">
                    01951551000
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> Nagad Personal:
                  </span>
                  <span className="font-mono text-white font-bold select-all bg-white/5 px-2 py-0.5 rounded cursor-pointer">
                    01851551000
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 leading-relaxed text-center pt-2 border-t border-white/5 font-mono">
                  * Send Money কমপ্লিট হওয়ার পরই TrxID সাবমিট করুন।
                </div>
              </div>

              {/* Form Input Items */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Select Payment Operator</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Bkash')}
                      className={`py-2 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                        paymentMethod === 'Bkash'
                          ? 'border-pink-500 bg-pink-500/10 text-pink-400'
                          : 'border-white/5 bg-white/[0.01] text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-pink-500" /> bKash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Nagad')}
                      className={`py-2 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                        paymentMethod === 'Nagad'
                          ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                          : 'border-white/5 bg-white/[0.01] text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-orange-500" /> Nagad
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Sender Mobile Phone</label>
                  <input 
                    type="text" 
                    value={senderNumber}
                    onChange={e => setSenderNumber(e.target.value)}
                    placeholder="যেমন: 01712345678"
                    className="w-full bg-[#050911] border border-white/5 focus:border-cyan-500 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Transaction ID (TrxID)</label>
                  <input 
                    type="text" 
                    value={transactionId}
                    onChange={e => setTransactionId(e.target.value)}
                    placeholder="যেমন: K283J88AS"
                    className="w-full bg-[#050911] border border-white/5 focus:border-cyan-500 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none font-mono uppercase"
                    required
                  />
                </div>
              </div>

              {/* Submit / Action buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsUpgradeModalOpen(false);
                    setSelectedUpgradePlan(null);
                  }}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold text-center cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="flex-1 py-1 px-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-black rounded-xl text-xs font-bold uppercase cursor-pointer transition text-center"
                >
                  {submittingRequest ? "Submitting..." : "Apply Upgrade"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Embedded Terminal Logs Viewer Overlay (Floating) */}
      {logBot && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-4xl bg-[#03070e] border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[90vh] sm:h-[600px] shadow-2xl">
            {/* Log Header */}
            <div className="p-3.5 sm:p-4 bg-[#0a1120] border-b border-white/5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-emerald-400 animate-pulse shrink-0" />
                <div className="min-w-0">
                  <span className="font-display font-bold text-sm text-white truncate block">Uptime logs: {logBot.botName}</span>
                  <span className="block text-[8px] font-mono text-gray-500">ID: {logBot.botId} (Stream Active)</span>
                </div>
              </div>

              {/* Console search */}
              <div className="relative flex-1 md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input 
                  type="text" 
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  placeholder="Filter logs (grep)..."
                  className="w-full bg-[#050911] border border-white/5 rounded-lg py-1.5 pl-9 pr-3 text-[10px] text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Exit Console */}
              <button 
                onClick={() => setLogBot(null)}
                className="text-gray-400 hover:text-white px-2.5 py-1.5 text-[10px] font-mono hover:bg-white/5 rounded border border-white/5 cursor-pointer text-center md:text-right shrink-0 transition"
              >
                [CLOSE CONSOLE]
              </button>
            </div>

            {/* Terminal Window content scroll */}
            <div className="flex-1 p-4 sm:p-6 font-mono text-xs text-emerald-300 overflow-y-auto bg-[#020408] space-y-2 whitespace-pre-wrap leading-relaxed shadow-inner">
              {logContent || "[INFO] Fetching current process status..."}
            </div>

            {/* Terminal interactions footer panel */}
            <div className="p-3.5 sm:p-4 bg-[#0a1120] border-t border-white/5 flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex gap-2">
                <button 
                  onClick={handleClearLogs}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-mono font-bold rounded-lg cursor-pointer transition text-center"
                >
                  Clear stream
                </button>
                <button 
                  onClick={handleDownloadLogs}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-mono font-bold rounded-lg border border-white/5 cursor-pointer flex items-center justify-center gap-1.5 transition whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" /> Download Transcript
                </button>
              </div>

              <div className="text-[9px] text-gray-500 font-mono flex items-center justify-center sm:justify-start gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                SYSTEM HEARTBEAT LIVE STREAM
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Bot settings / Custom Environment Variable Modal editor */}
      {editingBot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={saveBotSettings} className="w-full max-w-lg bg-[#0a1120] border border-white/10 rounded-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-white tracking-wide uppercase">WORKSPACE PARAMETERS EDITOR</h3>
              <button 
                type="button" 
                onClick={() => setEditingBot(null)}
                className="text-gray-400 hover:text-white text-lg font-bold leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Scrollable Body Container */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 max-h-[55vh]">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1.5">Workspace Name</label>
                  <input 
                    type="text" 
                    value={editBotName}
                    onChange={e => setEditBotName(e.target.value)}
                    className="w-full bg-[#050911] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1.5">Telegram Bot Token Credentials</label>
                  <input 
                    type="password" 
                    value={editBotToken}
                    onChange={e => setEditBotToken(e.target.value)}
                    className="w-full bg-[#050911] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1.5">Custom Environment Variables (Flat JSON keys)</label>
                  <textarea 
                    value={editBotEnv}
                    onChange={e => setEditBotEnv(e.target.value)}
                    placeholder='e.g. {"REDIS_URL": "redis://localhost:6379", "SUPPORT_CHAT_ID": "98765432"}'
                    className="w-full bg-[#050911] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none font-mono h-24 resize-none"
                  />
                </div>

                {/* Optional Code Files Edit / Replacement Fields */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-gray-300 font-mono uppercase tracking-wider">Update Code Files (ঐচ্ছিক / Replaces previous file)</h4>
                    <span className="text-[9px] text-gray-500 font-mono">Kept unchanged if left empty</span>
                  </div>

                  {editFileError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] text-red-400 font-mono">
                      {editFileError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {/* bot.py edit upload */}
                    <div className="p-4 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between h-36 bg-[#040810]/50">
                      <div>
                        <div className="text-[10px] font-mono font-bold text-white uppercase flex items-center justify-between">
                          <span>bot.py</span>
                          <span className="text-[8px] px-1 bg-emerald-500/10 text-emerald-400 rounded">Python</span>
                        </div>
                        <p className="text-[8px] text-gray-400 leading-normal mt-1">Upload new code to completely replace original bot.py loop rules.</p>
                      </div>
                      <div>
                        <label className="block py-2 bg-white/5 hover:bg-white/10 text-white rounded text-center text-[10px] font-semibold cursor-pointer border border-white/5 transition">
                          Select bot.py
                          <input type="file" accept=".py" onChange={handleEditBotPyUpload} className="hidden" />
                        </label>
                        {editBotPyFileName && <span className="block text-[8px] text-emerald-400 font-mono mt-1 text-center truncate">{editBotPyFileName} Loaded</span>}
                      </div>
                    </div>

                    {/* requirements.txt edit upload */}
                    <div className="p-4 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between h-36 bg-[#040810]/50">
                      <div>
                        <div className="text-[10px] font-mono font-bold text-white uppercase flex items-center justify-between">
                          <span>requirements.txt</span>
                          <span className="text-[8px] px-1 bg-cyan-500/10 text-cyan-400 rounded">pip</span>
                        </div>
                        <p className="text-[8px] text-gray-400 leading-normal mt-1">Upload new dependency file to update standard pip module lists.</p>
                      </div>
                      <div>
                        <label className="block py-2 bg-white/5 hover:bg-white/10 text-white rounded text-center text-[10px] font-semibold cursor-pointer border border-white/5 transition">
                          Select reqs.txt
                          <input type="file" accept=".txt" onChange={handleEditRequirementsUpload} className="hidden" />
                        </label>
                        {editRequirementsFileName && <span className="block text-[8px] text-cyan-400 font-mono mt-1 text-center truncate">{editRequirementsFileName} Loaded</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 py-2">
                  <input 
                    type="checkbox" 
                    checked={editAutoRestart}
                    onChange={e => setEditAutoRestart(e.target.checked)}
                    id="autoRestartCheck"
                    className="w-4 h-4 accent-emerald-500"
                  />
                  <label htmlFor="autoRestartCheck" className="text-xs text-gray-300 font-semibold cursor-pointer">
                    Activate automatic heartbeats & crash restarts
                  </label>
                </div>
              </div>
            </div>

            {/* Sticky / Fixed Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-white/5 bg-[#0a1120]">
              <button 
                type="button" 
                onClick={() => setEditingBot(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs uppercase rounded-lg cursor-pointer transition-all"
              >
                Commit Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* USER PROFILE MODAL DIAGRAM DETAILED OVERLAY */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a1120] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-fade-in text-gray-100 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 bg-[#080d16] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-white">My Account Portfolio</h3>
                  <span className="block text-[8px] font-mono text-gray-500 tracking-wider">SECURE CLIENT PREFERENCE</span>
                </div>
              </div>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg border border-white/5 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Contents */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Profile Avatar & Title */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-[2px] shadow-lg shadow-emerald-500/10">
                    <div className="w-full h-full bg-[#0a1120] rounded-full flex items-center justify-center text-xl font-extrabold text-white">
                      {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U"}
                    </div>
                  </div>
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#0a1120] rounded-full animate-pulse" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-base text-white">{userProfile.name}</h4>
                  <p className="text-[10px] font-mono text-gray-400 mt-1 uppercase tracking-wider">{userProfile.email}</p>
                </div>
              </div>

              {/* Data Grid Cards */}
              <div className="space-y-3 font-mono">
                {/* Email Address details */}
                <div className="p-3.5 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col justify-between space-y-1">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">User Unique ID (UID)</span>
                  <span className="text-xs text-emerald-300 break-all">{userProfile.uid}</span>
                </div>

                {/* Subscriptions detail */}
                <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold block">Uptime Subscription Tier</span>
                    <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      {userProfile.plan === "free" && "Standard Free Basic Plan"}
                      {userProfile.plan === "premium" && "Developer Premium Tier"}
                      {userProfile.plan === "enterprise" && "Dedicated Enterprise Node"}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-black uppercase tracking-wider shrink-0">
                    {userProfile.plan}
                  </span>
                </div>

                {/* Account status info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.01] border border-white/5 space-y-1">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold block">Security clearance</span>
                    <span className="text-xs font-bold text-rose-400 uppercase">{userProfile.role} Level</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.01] border border-white/5 space-y-1">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold block">Gateway Status</span>
                    <span className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                      {userProfile.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notice guidelines */}
              <p className="text-[10px] text-gray-400 text-center leading-relaxed max-w-sm mx-auto bg-white/[0.02] p-3 rounded-xl border border-white/5">
                ক্লান্তিহীনভাবে পাইথন বট ২৪ ঘণ্টা সচল রাখতে BotHost BD সর্বদা নির্ভরযোগ্য। কোনো তথ্যের পরিবর্তন বা আপগ্রেডের জন্য যোগাযোগ করুন।
              </p>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-[#080d16] border-t border-white/5 flex justify-end shrink-0">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs uppercase rounded-xl cursor-pointer transition shadow-[0_4px_12px_rgba(16,185,129,0.15)] text-center font-display"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer bar */}
      <footer className="py-6 border-t border-white/5 bg-[#080d15] text-center text-xs text-gray-500 font-mono">
        © 2026 BotHost BD Hub. Fully redundant virtualized environments.
      </footer>
    </div>
  );
}
