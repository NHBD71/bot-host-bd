import React, { useState, useEffect } from "react";
import { secureAddDoc, secureGetDocs, secureUpdateDoc } from "../lib/firestoreUtils";
import { SupportTicket, TicketReply } from "../types";
import { MessageSquare, Calendar, HelpCircle, Check, CircleAlert, CornerDownRight, X, Send } from "lucide-react";
import { auth } from "../firebase";

interface SupportSystemProps {
  userId: string;
  userName: string;
  isAdminMode?: boolean;
}

export default function SupportSystem({ userId, userName, isAdminMode = false }: SupportSystemProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);

  useEffect(() => {
    fetchTickets();
  }, [userId, isAdminMode]);

  async function fetchTickets() {
    setLoading(true);
    try {
      // Admins view all tickets, users only view their own
      const filters = isAdminMode ? [] : [{ field: "userId", operator: "==", value: userId }];
      const results = await secureGetDocs("tickets", filters as any);
      
      // Sort newest first
      const sorted = (results || []).sort((a: any, b: any) => {
        return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
      });
      setTickets(sorted as any);
      
      // If we have an active ticket open, update its selection state
      if (activeTicket) {
        const updated = sorted.find((t: any) => t.ticketId === activeTicket.ticketId);
        if (updated) {
          setActiveTicket(updated as any);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setLoading(true);
    const newId = `ticket-${Math.random().toString(36).substring(2, 11)}`;
    const ticketData: SupportTicket = {
      ticketId: newId,
      userId,
      subject: subject.trim(),
      message: message.trim(),
      status: "open",
      createdAt: new Date().toISOString(),
      replies: []
    };

    try {
      await secureAddDoc("tickets", ticketData);
      setSubject("");
      setMessage("");
      fetchTickets();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTicket || !replyMessage.trim()) return;

    setLoading(true);
    const newReply: TicketReply = {
      authorId: auth.currentUser?.uid || userId,
      authorName: isAdminMode ? "SUPPORT REPRESENTATIVE (ADMIN)" : userName,
      message: replyMessage.trim(),
      createdAt: new Date().toISOString()
    };

    const updatedReplies = [...(activeTicket.replies || []), newReply];

    try {
      // Look up document ID in Firestore matching ticketId
      // To bypass and find the target doc, let's look up docs in ticket collection
      const docsSnapshot = await secureGetDocs("tickets", [{ field: "ticketId", operator: "==", value: activeTicket.ticketId }]);
      if (docsSnapshot && docsSnapshot.length > 0) {
        const firestoreId = (docsSnapshot[0] as any).id;
        await secureUpdateDoc("tickets", firestoreId, {
          replies: updatedReplies,
          status: isAdminMode ? "replied" : "open"
        });
        setReplyMessage("");
        await fetchTickets();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseTicket(ticket: SupportTicket) {
    if (!confirm("Are you sure you want to close this ticket?")) return;
    setLoading(true);
    try {
      const docsSnapshot = await secureGetDocs("tickets", [{ field: "ticketId", operator: "==", value: ticket.ticketId }]);
      if (docsSnapshot && docsSnapshot.length > 0) {
        const firestoreId = (docsSnapshot[0] as any).id;
        await secureUpdateDoc("tickets", firestoreId, { status: "closed" });
        await fetchTickets();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Ticket List Panel */}
      <div className="lg:col-span-1 space-y-6">
        {/* Support Admin & Developer Profile Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0c1322] to-[#060a12] border border-emerald-500/10 shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-white/5 pb-3.5">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-full border border-emerald-500/25 flex items-center justify-center font-bold text-emerald-400 font-display">
              NV
            </div>
            <div>
              <span className="block text-[9px] text-[#86EFAC] font-mono uppercase tracking-wider font-extrabold">Support Admin & Dev</span>
              <span className="block font-display font-bold text-white text-base leading-tight">NOOBXVAU</span>
            </div>
          </div>
          
          <p className="text-xs text-gray-400 leading-relaxed font-sans">
            যেকোনো সমস্যার তাত্ক্ষণিক সমাধানের জন্য, পেমেন্ট অ্যাপ্রুভ বা কাস্টম বট হোস্ট কোড ভেরিফিকেশনের জন্য সরাসরি নিচে দেওয়া লিঙ্কে আমাদের টেলিগ্রামে নক করুন।
          </p>

          <div className="p-3 rounded-xl bg-white/[0.01] border border-white/5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-500 font-mono">Telegram ID:</span>
              <span className="font-mono text-emerald-400 font-bold select-all">@noobxvau</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-gray-500 font-mono">Availability:</span>
              <span className="text-gray-300 font-semibold font-mono">24/7 Virtual Support</span>
            </div>
          </div>

          <a 
            href="https://t.me/noobxvau"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 shadow-[0_4px_12px_rgba(16,185,129,0.15)] hover:shadow-[0_4px_20px_rgba(16,185,129,0.3)] text-center block"
          >
            Contact on Telegram &rarr;
          </a>
        </div>

        <div className="p-6 rounded-2xl glass-card border-white/5 space-y-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            {!isAdminMode ? "Submit Support Ticket" : "Ticket Dispatcher Center"}
          </h2>
          
          {!isAdminMode ? (
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-[11px] text-gray-400 font-mono mb-1 uppercase">Ticket Subject</label>
                <input 
                  type="text" 
                  value={subject} 
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Bot.py auto-restart loop error"
                  className="w-full bg-[#080c14] border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 font-mono mb-1 uppercase">Issue Message Details</label>
                <textarea 
                  value={message} 
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe standard exceptions, Python environment version errors, or Token authorization issues..."
                  className="w-full bg-[#080c14] border border-white/5 hover:border-white/10 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white h-28 focus:outline-none resize-none"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-black font-display font-semibold text-xs tracking-wider uppercase rounded-xl cursor-pointer"
              >
                Launch Ticket
              </button>
            </form>
          ) : (
            <p className="text-xs text-gray-400 leading-relaxed">
              Admins are authorized to view and reply to user support pipelines across BotHost clusters directly. Click a ticket column on the right to respond.
            </p>
          )}
        </div>
      </div>

      {/* Ticket conversations timeline */}
      <div className="lg:col-span-2 space-y-6">
        <div className="p-6 rounded-2xl glass-panel min-h-[500px] flex flex-col justify-between">
          {!activeTicket ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-24 space-y-3">
              <HelpCircle className="w-12 h-12 text-gray-600 animate-pulse" />
              <div className="font-display font-bold text-white text-base">No Tickets Selected</div>
              <p className="text-xs text-gray-400 max-w-sm">
                Select a ticket below or launch a new conversation from the side pipeline controller view.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full justify-between flex-1">
              {/* Header Details */}
              <div className="border-b border-white/5 pb-4 mb-4 flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-gray-500">ID: {activeTicket.ticketId}</span>
                    <span className={`px-2 py-0.5 text-[9px] font-mono rounded font-bold uppercase ${
                      activeTicket.status === "open" ? "bg-amber-400/10 text-amber-400 border border-amber-400/20" :
                      activeTicket.status === "replied" ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" :
                      "bg-gray-500/10 text-gray-400 border border-white/10"
                    }`}>
                      {activeTicket.status}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-white mt-1">{activeTicket.subject}</h3>
                </div>
                {activeTicket.status !== "closed" && (
                  <button 
                    onClick={() => handleCloseTicket(activeTicket)}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Close Ticket
                  </button>
                )}
              </div>

              {/* Chat timeline scroll list */}
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[350px] pr-2 mb-4">
                {/* Initial message */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex justify-between text-[10px] font-mono text-gray-400">
                    <span className="font-sans font-bold text-white uppercase">User Query</span>
                    <span>{new Date(activeTicket.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed font-sans">{activeTicket.message}</p>
                </div>

                {/* Timeline responses */}
                {activeTicket.replies?.map((rep, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border space-y-1 ${
                    rep.authorId === userId ? "bg-white/[0.02] border-white/5" : "bg-emerald-500/5 border-emerald-500/10"
                  }`}>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className={`font-sans font-bold uppercase select-none ${rep.authorId === userId ? "text-white" : "text-emerald-400"}`}>
                        {rep.authorName}
                      </span>
                      <span className="text-gray-500">{new Date(rep.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed font-sans">{rep.message}</p>
                  </div>
                ))}
              </div>

              {/* Reply submission bar */}
              {activeTicket.status !== "closed" ? (
                <form onSubmit={handleAddReply} className="border-t border-white/5 pt-4 flex gap-3">
                  <input 
                    type="text" 
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    placeholder="Provide troubleshooting help or clarify exceptions..."
                    className="flex-1 bg-[#080c14] border border-white/5 focus:border-emerald-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none"
                    required
                  />
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-6 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-black rounded-xl font-bold flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="p-4 rounded-xl bg-gray-500/5 border border-white/5 text-center text-xs text-gray-400 uppercase font-mono tracking-widest leading-relaxed">
                  This conversation timeline has been archived because the issue was closed.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Existing tickets list list */}
        <div className="space-y-3">
          <h4 className="text-xs font-mono font-bold uppercase text-gray-400 tracking-wider">Tickets History</h4>
          {tickets.length === 0 ? (
            <div className="p-6 rounded-xl border border-white/5 text-center text-xs text-gray-500 font-mono uppercase">
              No previous tickets filed.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tickets.map((ticket, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveTicket(ticket)}
                  className={`p-4 rounded-xl text-left border cursor-pointer w-full transition-all duration-200 ${
                    activeTicket?.ticketId === ticket.ticketId 
                      ? "bg-emerald-500/5 border-emerald-500/30" 
                      : "bg-[#0b0f19] border-white/5 hover:bg-white/[0.01]"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-[9px] text-gray-500">ID: {ticket.ticketId}</span>
                    <span className={`px-2 py-0.2 text-[8px] font-mono rounded font-medium uppercase ${
                      ticket.status === "open" ? "bg-amber-400/10 text-amber-400" :
                      ticket.status === "replied" ? "bg-emerald-400/10 text-emerald-400" :
                      "bg-gray-500/10 text-gray-400"
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                  <h5 className="font-display font-semibold text-xs text-white truncate">{ticket.subject}</h5>
                  <p className="text-[10px] text-gray-400 mt-1 truncate">{ticket.message}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
