import React, { useState } from "react";
import { Server, Zap, Shield, Cpu, Terminal, RefreshCw, BarChart2, MessageSquare, ChevronDown, Check, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export default function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const stats = [
    { value: "48,291+", label: "Bots Deployed" },
    { value: "99.99%", label: "Uptime Guaranteed" },
    { value: "3.2M", label: "Monthly API Calls" },
    { value: "< 14ms", label: "Average Response Time" }
  ];

  const features = [
    {
      icon: <Terminal className="w-6 h-6 text-emerald-400" />,
      title: "Isolated Execution Environment",
      desc: "Each Telegram bot runs inside its own secure, sandboxed process on our optimized high-speed VPS cluster."
    },
    {
      icon: <RefreshCw className="w-6 h-6 text-cyan-400" />,
      title: "Crash Auto-Restart Engine",
      desc: "Active heartbeat monitors watch your bots. If a bot crashes due to script errors, we instantly reboot it."
    },
    {
      icon: <Cpu className="w-6 h-6 text-purple-400" />,
      title: "Multi-Version Python Support",
      desc: "Deploy files using Python 3.10, 3.11, or 3.12 syntax seamlessly without needing manual environment configuration."
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-400" />,
      title: "Real-time Live Streaming Logs",
      desc: "Stream live logging outputs, search historical stack traces, clear console buffers, and download transcripts immediately."
    },
    {
      icon: <Shield className="w-6 h-6 text-emerald-400" />,
      title: "Secure Encrypted Secrets",
      desc: "Your Telegram tokens and environment variables are encrypted at rest with multi-layer access filters."
    },
    {
      icon: <BarChart2 className="w-6 h-6 text-rose-400" />,
      title: "Dynamic Resource Metrics",
      desc: "View historical memory footprints, processing rates, active polling cycles, and performance load stats."
    }
  ];

  const plans = [
    {
      name: "FREE PLAN",
      price: "$0",
      period: "forever",
      desc: "Perfect for testing scripts & simple projects",
      bots: "1 Active Bot",
      specs: ["Basic Shared Resources", "Uptime Monitoring", "Standard Console Logs", "Community Support"],
      btn: "Deploy Free",
      popular: false
    },
    {
      name: "PREMIUM PLAN",
      price: "$9",
      period: "per month",
      desc: "Built for active developers & public channels",
      bots: "10 Active Bots",
      specs: ["Increased Dedicated CPU & Ram", "Intelligent Auto-Restart", "Live Real-Time Log Buffers", "Priority Support Ticket Priority", "Custom Env Variables"],
      btn: "Get Premium",
      popular: true
    },
    {
      name: "ENTERPRISE PLAN",
      price: "$29",
      period: "per month",
      desc: "For production scale automated customer care integrations",
      bots: "Unlimited Bots",
      specs: ["Dedicated VM Allocation", "Max Resource Limits Enabled", "Full Priority Support VIP", "Direct SSH Terminal Access Logs", "Dedicated Static IP"],
      btn: "Go Enterprise",
      popular: false
    }
  ];

  const faqs = [
    {
      q: "How does the bot hosting environment isolate execution?",
      a: "Our node backend orchestrates individual Python child processes with isolated working directories and environment-level configuration sets. This sandboxing keeps every bot completely isolated from other workflows, maintaining flawless security and high-efficiency load balancing."
    },
    {
      q: "Which file formats are permitted for upload?",
      a: "For security, we accept exactly two files: 'bot.py' (primary python script) and 'requirements.txt' (containing standard pip packages). Uploading executables, shell scripts, zip, or web code is strictly prohibited."
    },
    {
      q: "How does the crash recovery monitor respond to runtime errors?",
      a: "Once automatic restart is enabled for a bot, our dashboard system listens to standard process exit events. If the script shuts down unexpectedly or experiences a socket drop, we wait exactly 5 seconds to prevent rate-limit bans, and launch the process back into memory automatically!"
    },
    {
      q: "Can I manage multiple environment variables for my python scripts?",
      a: "Yes! In your bot configuration view, you can enter custom environment variables in key-value formatting. These will be securely loaded into the sys.env scope during the boot sequence."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      {/* Navbar Grid Layout */}
      <header className="sticky top-0 z-50 bg-[#080d16]/90 backdrop-blur-md border-b border-white/5 py-3.5 px-4 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center">
            <Server className="w-4.5 h-4.5 md:w-5 md:h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <span className="font-display font-bold text-base md:text-xl tracking-wide bg-gradient-to-r from-white via-gray-200 to-emerald-400 bg-clip-text text-transparent block">BotHost BD</span>
            <span className="block text-[8px] md:text-[9px] text-[#86EFAC] font-mono tracking-wider uppercase font-semibold">PREMIUM HOSTING</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={onLogin} id="nav-login-btn" className="text-xs sm:text-sm font-medium text-gray-300 hover:text-white transition-colors duration-200 px-3 py-1.5 cursor-pointer">
            Sign In
          </button>
          <button onClick={onGetStarted} id="nav-register-btn" className="px-3 md:px-4 py-2 text-[11px] sm:text-xs font-semibold tracking-wider font-display rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-300 cursor-pointer">
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 px-6 md:px-12 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(16,185,129,0.1),transparent_50%)]" />
        
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-semibold text-emerald-400 tracking-wider">Python Telegram Host Core Live</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-display font-extrabold tracking-tight text-white mb-6 leading-[1.1]"
          >
            Host Your Telegram <br />
            <span className="text-emerald-400 bg-clip-text">Bots Easily</span>
          </motion.h1>

          <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Deploy, manage, monitor and control your Telegram bots from one dashboard. Pure Python environment with complete security, real-time log streaming, and maximum performance.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={onGetStarted}
              id="hero-get-started"
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-display font-semibold rounded-xl text-sm transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer group"
            >
              Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a 
              href="#pricing-grid"
              id="hero-view-pricing"
              className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-display font-semibold rounded-xl text-xs tracking-wider transition-all duration-300 flex items-center justify-center"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-12 bg-white/[0.01] border-y border-white/5 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {stats.map((stat, idx) => (
              <div key={idx} className="p-4 border-r border-white/5 last:border-0">
                <div className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">{stat.value}</div>
                <div className="text-xs text-gray-400 mt-2 tracking-wide font-mono uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features bento container */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">Engineered for Automated Performance</h2>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto">Everything you need to launch, manage, and scale secure Python Telegram bots 24/7 without terminal fatigue.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => (
            <div key={idx} className="p-8 rounded-2xl glass-card transition-all duration-300 hover:border-emerald-500/20 hover:-translate-y-1">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl border border-emerald-500/10 flex items-center justify-center mb-6">
                {feat.icon}
              </div>
              <h3 className="text-lg font-display font-bold text-white mb-2">{feat.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing table is id pricing-grid */}
      <section id="pricing-grid" className="py-24 bg-white/[0.01] border-y border-white/5 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">Flexible Developer Pricing</h2>
            <p className="text-gray-400 mt-3">Start free, unlock more host slots as your integrations grow.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {plans.map((p, idx) => (
              <div key={idx} className={`rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 relative ${
                p.popular ? "bg-[#0f1b2c] border-2 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.15)]" : "glass-card border-white/5"
              }`}>
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-black text-[10px] font-bold tracking-widest uppercase rounded-full">
                    Most Popular
                  </span>
                )}
                <div>
                  <div className="text-xs font-mono tracking-widest text-emerald-400 uppercase mb-2">{p.name}</div>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl md:text-5xl font-display font-extrabold text-white">{p.price}</span>
                    <span className="text-xs text-gray-400">/ {p.period}</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-6 leading-relaxed">{p.desc}</p>
                  
                  <div className="h-px bg-white/5 my-6" />
                  
                  <div className="font-display font-semibold text-white mb-4">{p.bots}</div>
                  <ul className="space-y-3 mb-8">
                    {p.specs.map((spec, sIdx) => (
                      <li key={sIdx} className="flex items-start gap-3 text-sm text-gray-300">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button 
                  onClick={onGetStarted}
                  id={`plan-${p.name.toLowerCase().split(' ')[0]}`}
                  className={`w-full py-3.5 rounded-xl font-display font-semibold transition-all duration-200 cursor-pointer ${
                    p.popular 
                      ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg" 
                      : "bg-white/5 hover:bg-white/10 text-white border border-white/15"
                  }`}
                >
                  {p.btn}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-24 px-6 md:px-12 max-w-4xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">Frequently Asked Questions</h2>
          <p className="text-gray-400 mt-4">Transparent host platform architectures simplified.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.01] overflow-hidden">
              <button 
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full text-left p-6 flex justify-between items-center bg-transparent cursor-pointer transition-colors hover:bg-white/[0.02]"
              >
                <span className="font-display font-semibold text-white pr-4">{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-emerald-400 transition-transform duration-200 ${activeFaq === idx ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {activeFaq === idx && (
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6 pt-0 border-t border-white/5 text-sm text-gray-400 leading-relaxed">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* Footer view */}
      <footer className="py-12 border-t border-white/5 bg-[#080b13] px-6 text-center">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-emerald-400" />
            <span className="font-display font-bold text-lg text-white">BotHost BD</span>
          </div>
          <div className="text-xs text-gray-500 font-mono">
            © 2026 BotHost BD. All rights secure. High-Performance Sandboxed VPS Solutions.
          </div>
          <div className="flex gap-6 text-xs text-gray-400">
            <a href="#pricing-grid" className="hover:text-emerald-400 transition-colors">Pricing</a>
            <a href="#features" className="hover:text-emerald-400 transition-colors">Infrastructure</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">Faqs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
