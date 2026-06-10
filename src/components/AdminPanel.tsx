import React, { useState, useEffect } from "react";
import { secureGetDocs, secureUpdateDoc, secureDeleteDoc, secureAddDoc, secureSetDoc } from "../lib/firestoreUtils";
import { UserProfile, BotMetadata, HostingPlan, Announcement } from "../types";
import { Users, Cpu, Server, Shield, Sparkles, Ban, Trash2, Edit3, Plus, Bell, RefreshCw, MessageCircle, CreditCard, Check, X } from "lucide-react";
import SupportSystem from "./SupportSystem";
import { SubscriptionRequest } from "../types";

interface AdminPanelProps {
  adminUser: UserProfile;
  onExit: () => void;
}

export default function AdminPanel({ adminUser, onExit }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bots, setBots] = useState<BotMetadata[]>([]);
  const [plans, setPlans] = useState<HostingPlan[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [subRequests, setSubRequests] = useState<SubscriptionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "bots" | "plans" | "tickets" | "announcements" | "subscriptions">("overview");

  // Form states for creating announcement
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceMessage, setAnnounceMessage] = useState("");

  // Form states for custom plan creator
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState(0);
  const [planMaxBots, setPlanMaxBots] = useState(1);
  const [planLimits, setPlanLimits] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // Non-blocking custom alert/confirm state to bypass iframe policies
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "alert" | "confirm";
    onConfirm?: () => void;
    onCancel?: () => void;
  } | null>(null);

  function showAlert(title: string, message: string) {
    setDialog({
      isOpen: true,
      title,
      message,
      type: "alert",
      onConfirm: () => setDialog(null)
    });
  }

  function showConfirm(title: string, message: string, onConfirm: () => void) {
    setDialog({
      isOpen: true,
      title,
      message,
      type: "confirm",
      onConfirm: () => {
        setDialog(null);
        onConfirm();
      },
      onCancel: () => setDialog(null)
    });
  }

  useEffect(() => {
    fetchAdminData();
  }, [activeTab]);

  async function fetchAdminData() {
    setLoading(true);
    try {
      if (activeTab === "overview" || activeTab === "users" || activeTab === "subscriptions") {
        const u = await secureGetDocs("users");
        setUsers((u || []) as any);
      }
      if (activeTab === "overview" || activeTab === "bots") {
        const b = await secureGetDocs("bots");
        setBots((b || []) as any);
      }
      if (activeTab === "plans" || activeTab === "overview" || activeTab === "users" || activeTab === "subscriptions") {
        const p = await secureGetDocs("plans");
        setPlans((p || []) as any);
      }
      if (activeTab === "announcements") {
        const a = await secureGetDocs("announcements");
        setAnnouncements((a || []) as any);
      }
      if (activeTab === "overview" || activeTab === "subscriptions") {
        const sr = await secureGetDocs("subscription_requests");
        setSubRequests((sr || []) as any);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Handle plan upgrade for specific users
  async function handleUpgradePlan(user: UserProfile, targetPlan: string) {
    try {
      await secureUpdateDoc("users", user.uid, { plan: targetPlan });
      showAlert("Plan Adjusted", `Successfully adjusted user ${user.name} plan tier to: ${targetPlan}`);
      fetchAdminData();
    } catch (err) {
      showAlert("Adjustment Failed", "Failed to modify subscription tier.");
    }
  }

  // Handle ban / suspend toggle
  async function handleToggleBan(user: UserProfile) {
    const nextStatus = user.status === "banned" ? "active" : "banned";
    try {
      await secureUpdateDoc("users", user.uid, { status: nextStatus });
      showAlert("Status Changed", `User accounts status set to ${nextStatus}.`);
      fetchAdminData();
    } catch (err) {
      showAlert("Operation Failed", "Error modifying user status.");
    }
  }

  // Handle support plan creation or update
  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planName) return;

    try {
      const planPayload = {
        name: planName.trim(),
        price: Number(planPrice),
        maxBots: Number(planMaxBots),
        limits: planLimits.trim()
      };

      if (editingPlanId) {
        await secureUpdateDoc("plans", editingPlanId, planPayload);
        showAlert("Success", "Hosting Plan description modified successfully!");
      } else {
        await secureAddDoc("plans", planPayload);
        showAlert("Success", "Hosting Plan created successfully!");
      }

      setPlanName("");
      setPlanPrice(0);
      setPlanMaxBots(1);
      setPlanLimits("");
      setEditingPlanId(null);
      fetchAdminData();
    } catch (err) {
      showAlert("Error", "Error saving plans configuration.");
    }
  }

  function handleStartEditPlan(p: HostingPlan) {
    if (!p.id) return;
    setEditingPlanId(p.id);
    setPlanName(p.name);
    setPlanPrice(p.price);
    setPlanMaxBots(p.maxBots);
    setPlanLimits(p.limits || "");
  }

  function handleCancelEditPlan() {
    setEditingPlanId(null);
    setPlanName("");
    setPlanPrice(0);
    setPlanMaxBots(1);
    setPlanLimits("");
  }

  // Handle verification and approval of bKash/Nagad payments
  async function handleApproveRequest(req: SubscriptionRequest) {
    showConfirm(
      "Approve Request",
      `Are you sure you want to APPROVE this subscription request for ${req.userName} to ${req.planName}?`,
      async () => {
        try {
          // 1. Upgrade user plan directly with their UID using merge set
          console.log(`Upgrading user ${req.userId} plan to ${req.planName.toLowerCase()}`);
          await secureSetDoc("users", req.userId, { plan: req.planName.toLowerCase() });
          
          // 2. Update status of request to approved
          if (req.id) {
            console.log(`Updating subscription request ${req.id} status to approved`);
            await secureUpdateDoc("subscription_requests", req.id, { status: "approved" });
          } else {
            throw new Error("Subscription request ID is missing.");
          }
          
          showAlert("Payment Approved", `User upgraded to ${req.planName} tier.`);
          fetchAdminData();
        } catch (err: any) {
          console.error("Payment approval error details:", err);
          showAlert("Approval Failed", "Error approving transaction request: " + (err?.message || String(err)));
        }
      }
    );
  }

  async function handleRejectRequest(req: SubscriptionRequest) {
    showConfirm(
      "Reject Request",
      `Are you sure you want to REJECT this subscription request for ${req.userName}?`,
      async () => {
        try {
          if (req.id) {
            console.log(`Rejecting subscription request ${req.id}`);
            await secureUpdateDoc("subscription_requests", req.id, { status: "rejected" });
          } else {
            throw new Error("Subscription request ID is missing.");
          }
          showAlert("Request Rejected", "Request marked as rejected successfully.");
          fetchAdminData();
        } catch (err: any) {
          console.error("Payment rejection error details:", err);
          showAlert("Rejection Failed", "Error rejecting transaction request: " + (err?.message || String(err)));
        }
      }
    );
  }

  // Handle dispatching news
  async function handleCreateAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announceTitle || !announceMessage) return;

    try {
      const freshAnnounce = {
        title: announceTitle.trim(),
        message: announceMessage.trim(),
        createdAt: new Date().toISOString()
      };
      await secureAddDoc("announcements", freshAnnounce);
      setAnnounceTitle("");
      setAnnounceMessage("");
      showAlert("Broadcast Issued", "Notice broadcasted successfully to all panels.");
      fetchAdminData();
    } catch (err) {
      showAlert("Publish Failed", "Announcement publish fail.");
    }
  }

  // API wrappers to control user bots as administrator
  async function handleAdminBotControl(bot: BotMetadata, action: "start" | "stop" | "restart") {
    try {
      const res = await fetch(`/api/bots/${bot.botId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: bot.ownerId, 
          botName: bot.botName,
          origin: window.location.origin
        })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert("Control Action Triggered", data.message || `Bot action ${action} triggered!`);
        fetchAdminData();
      } else {
        showAlert("Control Failed", `Server reply: ${data.error}`);
      }
    } catch (err) {
      showAlert("Connectivity Error", "Hosting cluster connectivity error.");
    }
  }

  // Purge a plan from collection
  async function handleDeletePlan(planId: string) {
    showConfirm(
      "Purge Plan",
      "Are you sure you want to delete this plan configuration from collections?",
      async () => {
        try {
          await secureDeleteDoc("plans", planId);
          fetchAdminData();
        } catch (err) {
          showAlert("Error", "Error purging plan item.");
        }
      }
    );
  }

  const activeBotsCount = bots.filter(b => b.status === "running").length;
  const offlineBotsCount = bots.filter(b => b.status !== "running").length;
  const filteredUsers = users.filter((u) => 
    u.name?.toLowerCase().includes(searchUser.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#080d16] text-gray-100 flex">
      {/* Admin Sidebar Navigation */}
      <div className="w-64 bg-[#0a1120] border-r border-white/5 flex flex-col justify-between hidden md:flex shrink-0">
        <div>
          <div className="p-6 border-b border-white/5 space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span className="font-display font-bold text-base text-white tracking-wider">SECURE ADM PANEL</span>
            </div>
            <span className="block text-[9px] text-emerald-400 font-mono">ROOT HARDWARE ACCESS</span>
          </div>

          <nav className="p-4 space-y-1">
            <button 
              onClick={() => setActiveTab("overview")}
              className={`w-full text-left p-3 rounded-xl text-xs font-semibold tracking-wider flex items-center gap-3 transition-all ${
                activeTab === "overview" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-gray-400 hover:bg-white/[0.01]"
              }`}
            >
              <Cpu className="w-4 h-4" /> CLUSTER OVERVIEW
            </button>
            <button 
              onClick={() => setActiveTab("users")}
              className={`w-full text-left p-3 rounded-xl text-xs font-semibold tracking-wider flex items-center gap-3 transition-all ${
                activeTab === "users" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-gray-400 hover:bg-white/[0.01]"
              }`}
            >
              <Users className="w-4 h-4" /> USER MANAGEMENT
            </button>
            <button 
              onClick={() => setActiveTab("bots")}
              className={`w-full text-left p-3 rounded-xl text-xs font-semibold tracking-wider flex items-center gap-3 transition-all ${
                activeTab === "bots" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-gray-400 hover:bg-white/[0.01]"
              }`}
            >
              <Server className="w-4 h-4" /> BOT METADATA BUILD
            </button>
            <button 
              onClick={() => setActiveTab("plans")}
              className={`w-full text-left p-3 rounded-xl text-xs font-semibold tracking-wider flex items-center gap-3 transition-all ${
                activeTab === "plans" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-gray-400 hover:bg-white/[0.01]"
              }`}
            >
              <Sparkles className="w-4 h-4" /> PLANS MANAGEMENT
            </button>
            <button 
              onClick={() => setActiveTab("subscriptions")}
              className={`w-full text-left p-3 rounded-xl text-xs font-semibold tracking-wider flex items-center justify-between transition-all ${
                activeTab === "subscriptions" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-gray-400 hover:bg-white/[0.01]"
              }`}
            >
              <span className="flex items-center gap-3">
                <CreditCard className="w-4 h-4" /> PAYMENT REQUESTS
              </span>
              {subRequests.filter(r => r.status === "pending").length > 0 && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] px-1.5 py-0.5 rounded-full font-mono animate-pulse">
                  {subRequests.filter(r => r.status === "pending").length} PENDING
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab("tickets")}
              className={`w-full text-left p-3 rounded-xl text-xs font-semibold tracking-wider flex items-center gap-3 transition-all ${
                activeTab === "tickets" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-gray-400 hover:bg-white/[0.01]"
              }`}
            >
              <MessageCircle className="w-4 h-4" /> SUPPORT REPLIES
            </button>
            <button 
              onClick={() => setActiveTab("announcements")}
              className={`w-full text-left p-3 rounded-xl text-xs font-semibold tracking-wider flex items-center gap-3 transition-all ${
                activeTab === "announcements" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "text-gray-400 hover:bg-white/[0.01]"
              }`}
            >
              <Bell className="w-4 h-4" /> BROADCAST NOTICES
            </button>
          </nav>
        </div>

        <div className="p-6 border-t border-white/5 space-y-3">
          <div className="text-[10px] font-mono text-gray-500">
            LOGGED: <span className="text-gray-300 block truncate">{adminUser.email}</span>
          </div>
          <button 
            onClick={onExit}
            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 rounded-lg text-xs font-bold cursor-pointer transition-colors"
          >
            EXIT ADMIN
          </button>
        </div>
      </div>

      {/* Main Viewport Content Panel */}
      <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto max-h-screen">
        {/* Mobile-Only Tabs Header Selector & Exit Button */}
        <div className="md:hidden flex flex-col gap-3 pb-3 border-b border-white/5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="font-display font-bold text-xs text-white tracking-wider">ADMIN NAVIGATION</span>
            </div>
            <button 
              onClick={onExit}
              className="py-1.5 px-3 bg-red-400/10 hover:bg-red-400/20 text-red-400 border border-red-500/15 rounded-lg text-xs font-bold font-mono transition-colors"
            >
              EXIT ADMIN
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button 
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-wider shrink-0 transition-all ${
                activeTab === "overview" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              OVERVIEW
            </button>
            <button 
              onClick={() => setActiveTab("users")}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-wider shrink-0 transition-all ${
                activeTab === "users" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              USERS
            </button>
            <button 
              onClick={() => setActiveTab("bots")}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-wider shrink-0 transition-all ${
                activeTab === "bots" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              BOTS
            </button>
            <button 
              onClick={() => setActiveTab("plans")}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-wider shrink-0 transition-all ${
                activeTab === "plans" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              PLANS
            </button>
            <button 
              onClick={() => setActiveTab("subscriptions")}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-wider shrink-0 transition-all flex items-center gap-1.5 ${
                activeTab === "subscriptions" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              PAYMENTS
              {subRequests.filter(r => r.status === "pending").length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
            <button 
              onClick={() => setActiveTab("tickets")}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-wider shrink-0 transition-all ${
                activeTab === "tickets" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              SUPPORT
            </button>
            <button 
              onClick={() => setActiveTab("announcements")}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-wider shrink-0 transition-all ${
                activeTab === "announcements" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-400 hover:text-white border border-transparent"
              }`}
            >
              NOTICES
            </button>
          </div>
        </div>

        {/* Upper Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-display font-extrabold tracking-tight text-white uppercase">{activeTab} panel</h1>
            <p className="text-xs text-gray-400">Manage hosting structures, subscriptions, user parameters, and process actions.</p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button 
              onClick={fetchAdminData}
              title="Refresh database records"
              className="p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
            </button>
            <button 
              onClick={onExit}
              title="Return to user client dashboard"
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/15 text-red-400 border border-red-500/10 rounded-xl text-xs font-bold font-mono transition flex items-center gap-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> <span>EXIT PANEL</span>
            </button>
          </div>
        </div>

        {/* Tab content conditional blocks */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl glass-card border-white/5 space-y-2">
                <div className="text-xs font-mono uppercase text-gray-400">Total Users</div>
                <div className="text-3xl font-display font-bold text-white">{users.length}</div>
              </div>
              <div className="p-6 rounded-2xl glass-card border-white/5 space-y-2">
                <div className="text-xs font-mono uppercase text-gray-400">Total Bots Map</div>
                <div className="text-3xl font-display font-bold text-white">{bots.length}</div>
              </div>
              <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                <div className="text-xs font-mono uppercase text-emerald-400 font-bold">Active Spawns (Online)</div>
                <div className="text-3xl font-display font-bold text-white">{activeBotsCount}</div>
              </div>
              <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-2">
                <div className="text-xs font-mono uppercase text-red-400 font-bold">Offline Threads</div>
                <div className="text-3xl font-display font-bold text-white">{offlineBotsCount}</div>
              </div>
            </div>

            {/* Quick Metrics Logs */}
            <div className="p-6 rounded-2xl glass-panel space-y-4">
              <h3 className="font-display font-bold text-base text-white">System Host Clusters & Core Health</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-[11px] text-gray-400">
                <div className="space-y-1">
                  <div>CPU CLUSTERS LOAD: <span className="text-emerald-400">2.1%</span></div>
                  <div>RAM METRICS: <span className="text-emerald-400">238MB / 16GB</span></div>
                  <div>NETWORK LEAKS: <span className="text-emerald-400">0% Drop</span></div>
                </div>
                <div className="space-y-1">
                  <div>PROCESS CONTROL DECO: <span className="text-emerald-400">SANDBOXED ENGINE</span></div>
                  <div>ACTIVE PID COUNTS: <span className="text-emerald-400">{activeBotsCount} Live Slots</span></div>
                  <div>PLATFORM BACKEND: <span className="text-emerald-400">NODE.JS + TSX</span></div>
                </div>
                <div className="space-y-1">
                  <div>VIRTUAL MACHINE ADDR: <span className="text-emerald-400">0.0.0.0:3000</span></div>
                  <div>DISK PURGE INTERVALS: <span className="text-emerald-400">SYSTEM BUFFER</span></div>
                  <div>DATABASE SECURITY: <span className="text-emerald-400">ABAC ACTIVE</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Users Management */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text"
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                placeholder="Search user profile names or emails..."
                className="w-full sm:max-w-md bg-[#0b0f19] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="p-6 rounded-2xl glass-panel overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-mono uppercase text-gray-500 tracking-wider">
                    <th className="pb-3 pr-4">User Details</th>
                    <th className="pb-3 pr-4">Role</th>
                    <th className="pb-3 pr-4">Active Plan</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 text-right">Actions Panel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((user, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.01]">
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-white">{user.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{user.email}</div>
                        <div className="text-[9px] text-gray-500 font-mono mt-0.5">UID: {user.uid}</div>
                      </td>
                      <td className="py-4 pr-4 font-mono uppercase">{user.role}</td>
                      <td className="py-4 pr-4 font-mono text-emerald-400 uppercase">{user.plan}</td>
                      <td className="py-4 pr-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          user.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-4 text-right space-x-2">
                        <select 
                          value={user.plan}
                          onChange={(e) => handleUpgradePlan(user, e.target.value)}
                          className="bg-[#0b0f19] border border-white/10 rounded px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="free">Free</option>
                          <option value="premium">Premium</option>
                          <option value="enterprise">Enterprise</option>
                          {plans.filter(p => !["free", "premium", "enterprise"].includes(p.name.toLowerCase())).map((p: any) => (
                            <option key={p.id || p.name} value={p.name.toLowerCase()}>{p.name}</option>
                          ))}
                        </select>

                        <button 
                          onClick={() => handleToggleBan(user)}
                          className={`px-3 py-1 rounded text-[10px] uppercase font-bold cursor-pointer transition-colors ${
                            user.status === "banned" ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          }`}
                        >
                          {user.status === "banned" ? "Unban" : "Ban account"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Bots Collection Management */}
        {activeTab === "bots" && (
          <div className="p-6 rounded-2xl glass-panel overflow-x-auto">
            {bots.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400 font-mono uppercase">
                No telemetry bots currently mapped.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-mono uppercase text-gray-500 tracking-wider">
                    <th className="pb-3 pr-4">Bot Configuration</th>
                    <th className="pb-3 pr-4">Owner UID</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Environments</th>
                    <th className="pb-3 text-right">System Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bots.map((bot, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.01]">
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-white">{bot.botName}</div>
                        <div className="text-[10px] text-gray-400 font-mono truncate max-w-xs">{bot.botId}</div>
                        <div className="text-[9px] text-gray-500 font-mono uppercase mt-0.5">Python {bot.pythonVersion}</div>
                      </td>
                      <td className="py-4 pr-4 font-mono truncate max-w-[120px]" title={bot.ownerId}>{bot.ownerId}</td>
                      <td className="py-4 pr-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          bot.status === "running" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-500"
                        }`}>
                          {bot.status}
                        </span>
                      </td>
                      <td className="py-4 pr-4 font-mono text-gray-400 text-[10px] truncate max-w-xs">
                        {bot.token.substring(0, 8)}...
                      </td>
                      <td className="py-4 text-right space-x-1">
                        {bot.status !== "running" ? (
                          <button 
                            onClick={() => handleAdminBotControl(bot, "start")}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 rounded text-[10px] cursor-pointer"
                          >
                            Spawn
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleAdminBotControl(bot, "stop")}
                            className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/25 text-red-400 rounded text-[10px] cursor-pointer"
                          >
                            Kill Process
                          </button>
                        )}
                        <button 
                          onClick={() => handleAdminBotControl(bot, "restart")}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-[10px] cursor-pointer"
                        >
                          Restart
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Plans Management */}
         {activeTab === "plans" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <form onSubmit={handleCreatePlan} className="lg:col-span-1 p-6 rounded-2xl glass-card space-y-4">
              <h3 className="font-display font-semibold text-white">
                {editingPlanId ? "Edit Plan Setup" : "Create New Plan Setup"}
              </h3>
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Plan Name</label>
                <input 
                  type="text" 
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  placeholder="e.g. Developer Starter"
                  className="w-full bg-[#0b0f19] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Price (Taka/mo)</label>
                  <input 
                    type="number" 
                    value={planPrice}
                    onChange={e => setPlanPrice(Number(e.target.value))}
                    className="w-full bg-[#0b0f19] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Max Bots</label>
                  <input 
                    type="number" 
                    value={planMaxBots}
                    onChange={e => setPlanMaxBots(Number(e.target.value))}
                    className="w-full bg-[#0b0f19] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Limits Description</label>
                <textarea 
                  value={planLimits}
                  onChange={e => setPlanLimits(e.target.value)}
                  placeholder="e.g. 5 Active Bot Slots, Standard Logs Only..."
                  className="w-full bg-[#0b0f19] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none h-24 resize-none"
                />
              </div>
              <div className="space-y-2">
                <button 
                  type="submit"
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-bold font-display text-xs tracking-wider uppercase cursor-pointer transition-colors"
                >
                  {editingPlanId ? "Update Plan Document" : "Create Plan Document"}
                </button>
                {editingPlanId && (
                  <button 
                    type="button"
                    onClick={handleCancelEditPlan}
                    className="w-full py-2 bg-white/5 hover:bg-white/15 text-white rounded-xl font-mono text-xs cursor-pointer transition"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>
            </form>

            {/* List of active plans mapped in database */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-display font-semibold text-white">Current Plans Collection ({plans.length})</h3>
              {plans.length === 0 ? (
                <div className="p-8 rounded-2xl border border-white/5 text-center text-xs text-gray-500 font-mono">
                  No custom plan configurations seeded in plans database. Mapped to default web constants.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((p: any, idx) => (
                    <div key={idx} className="p-6 rounded-2xl glass-panel space-y-3 relative">
                      <div className="absolute top-4 right-4 flex items-center gap-1.5">
                        <button 
                          onClick={() => handleStartEditPlan(p)}
                          className="p-1 rounded bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 cursor-pointer"
                          title="Edit plan properties"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeletePlan(p.id)}
                          className="p-1 rounded bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 cursor-pointer"
                          title="Purge plan from collections"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="font-mono text-emerald-400 text-[10px] font-bold uppercase tracking-wider">{p.name}</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-display font-extrabold text-white">{p.price} Taka</span>
                        <span className="text-xs text-gray-400">/ mo</span>
                      </div>
                      <div className="text-xs text-gray-400">Max active bot workspaces: <span className="text-white font-mono">{p.maxBots}</span></div>
                      <p className="text-[11px] text-gray-500 leading-relaxed truncate">{p.limits}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Support tickets replies */}
        {activeTab === "tickets" && (
          <div className="p-6 rounded-2xl glass-panel">
            <SupportSystem userId={adminUser.uid} userName={adminUser.name} isAdminMode={true} />
          </div>
        )}

        {/* Tab: Broadcast notices */}
        {activeTab === "announcements" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <form onSubmit={handleCreateAnnouncement} className="lg:col-span-1 p-6 rounded-2xl glass-card space-y-4">
              <h3 className="font-display font-bold text-base text-white">Broadcast Announcement</h3>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Send service interruption notifications, cluster maintenance alerts, or performance notice messages directly to users dashboards.
              </p>
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Announcement Title</label>
                <input 
                  type="text" 
                  value={announceTitle}
                  onChange={e => setAnnounceTitle(e.target.value)}
                  placeholder="e.g. Schedule Cluster Node Updates"
                  className="w-full bg-[#0b0f19] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Message Body</label>
                <textarea 
                  value={announceMessage}
                  onChange={e => setAnnounceMessage(e.target.value)}
                  placeholder="Insert complete release notes or upgrade maintenance periods clearly..."
                  className="w-full bg-[#0b0f19] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none h-28 resize-none"
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-display font-bold text-xs uppercase tracking-widest rounded-xl cursor-pointer"
              >
                Dispatch Broadcaster
              </button>
            </form>

            {/* List announcements */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-display font-semibold text-white">Notice Dispatch logs ({announcements.length})</h3>
              {announcements.length === 0 ? (
                <div className="p-8 rounded-2xl border border-white/5 text-center text-xs text-gray-500 font-mono uppercase">
                  No broadcasts issued recently.
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((item, idx) => (
                    <div key={idx} className="p-6 rounded-2xl glass-panel space-y-3 relative">
                      <button 
                        onClick={() => {
                          showConfirm(
                            "Purge Announcement",
                            "Are you sure you want to purge this announcement from the notices board?",
                            async () => {
                              try {
                                await secureDeleteDoc("announcements", (item as any).id);
                                fetchAdminData();
                              } catch (err) {
                                showAlert("Error", "Error purging announcement notice.");
                              }
                            }
                          );
                        }}
                        className="absolute top-4 right-4 text-gray-600 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <h4 className="font-display font-bold text-sm text-white">{item.title}</h4>
                      <p className="text-xs text-gray-300 leading-relaxed">{item.message}</p>
                      <div className="text-[10px] font-mono text-gray-500">Dispatch log: {new Date(item.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Subscription Requests (Pay verification) */}
        {activeTab === "subscriptions" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl glass-card border-white/5 space-y-1">
              <h2 className="text-lg font-display font-bold text-white uppercase flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" /> bKash & Nagad Payment Requests Verification
              </h2>
              <p className="text-xs text-gray-400">
                Verify user transaction IDs for hosting upgrades. Approving requests instantly promotes users' active subscription tiers.
              </p>
            </div>

            <div className="p-6 rounded-2xl glass-panel overflow-x-auto">
              {subRequests.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-500 font-mono">
                  There are no payment or hosting upgrade applications logged in the system.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] font-mono uppercase text-gray-500 tracking-wider">
                      <th className="pb-3 pr-4">User Info</th>
                      <th className="pb-3 pr-4">Requested Plan</th>
                      <th className="pb-3 pr-4">Amount Charged</th>
                      <th className="pb-3 pr-4">Method & Sender</th>
                      <th className="pb-3 pr-4">Transaction ID (TrxID)</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 text-right">Actions Panel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {subRequests.map((req, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.01]">
                        <td className="py-4 pr-4">
                          <div className="font-semibold text-white">{req.userName}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{req.userEmail}</div>
                          <div className="text-[9px] text-gray-500 font-mono mt-0.5">UID: {req.userId}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <span className="font-semibold text-cyan-400 uppercase font-mono">{req.planName}</span>
                        </td>
                        <td className="py-4 pr-4 font-mono text-emerald-400 font-bold">{req.price} Taka</td>
                        <td className="py-4 pr-4 font-mono">
                          <div className="text-xs text-white flex items-center gap-1">
                            <span className={req.paymentMethod === 'Bkash' ? 'text-pink-400 font-bold' : 'text-orange-400 font-bold'}>
                              {req.paymentMethod}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400">Sender: {req.senderNumber}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <span className="font-mono text-white bg-white/5 px-2 py-1 rounded text-[11px] border border-white/5 font-bold select-all">
                            {req.transactionId}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            req.status === 'approved' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : req.status === 'rejected'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-4 text-right space-x-1 whitespace-nowrap">
                          {req.status === 'pending' && (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveRequest(req)}
                                className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold rounded cursor-pointer transition flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req)}
                                className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-[10px] font-bold rounded cursor-pointer transition flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Reject
                              </button>
                            </div>
                          )}
                          {req.status !== 'pending' && (
                            <span className="text-[10px] text-gray-500 font-mono uppercase font-bold">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Non-blocking Custom Dialog Modal Integration */}
      {dialog && dialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0a1120] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="space-y-2">
              <h3 className="text-sm font-display font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 block animate-pulse"></span>
                {dialog.title}
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                {dialog.message}
              </p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              {dialog.type === "confirm" && (
                <button
                  type="button"
                  onClick={dialog.onCancel}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={dialog.onConfirm}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold rounded-lg transition cursor-pointer"
              >
                {dialog.type === "confirm" ? "Proceed" : "Dismiss"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
