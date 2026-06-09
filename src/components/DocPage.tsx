import React from "react";
import { Server, Terminal, Book, Code, Sparkles, BookOpen } from "lucide-react";

export default function DocPage() {
  const codeSample = `import os
import sys
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

# 1. Enable logging (all prints stdout go straight to BotHost BD live stream console)
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# 2. Retrieve secure token supplied in Web Environment panel
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")

if not BOT_TOKEN:
    print("[ERROR] No Telegram token supplied. Exiting...", file=sys.stderr)
    sys.exit(1)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_name = update.effective_user.first_name
    await update.message.reply_text(f"Hello {user_name}! I am hosted on BotHost BD. Complete uptime guaranteed!")

if __name__ == '__main__':
    print("[INFO] Launching Bot Host application client...")
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    
    start_handler = CommandHandler('start', start)
    app.add_handler(start_handler)
    
    print("[RUNNING] Listening for Telegram updates...")
    app.run_polling()`;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center">
          <BookOpen className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white">BotHost BD Documentation</h1>
          <p className="text-sm text-gray-400">Everything you need to successfully structure and deploy python Telegram bots instantly on sandboxed VPS cores.</p>
        </div>
      </div>

      <div className="p-6 rounded-2xl glass-card border-white/5 space-y-4">
        <h2 className="text-lg font-display font-semibold text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          File Upload Rules & Policies
        </h2>
        <p className="text-xs text-gray-300 leading-relaxed">
          To maintain secure, streamlined high-resource clusters, our servers enforce strict security filtering on upload:
        </p>
        <ul className="list-disc list-inside space-y-2 text-xs text-gray-400 font-mono">
          <li>Allowed Files: Exactly <span className="text-white">bot.py</span> (main executor script) and <span className="text-white font-sans">requirements.txt</span> (pip dependencies).</li>
          <li>Rejected File Types: <span className="text-rose-400 font-sans">zip, exe, bat, sh, apk, php, js, html, rar, 7z</span> are strictly blocked.</li>
          <li>Scale Limit: Maximum file size must be less than <span className="text-emerald-400 font-sans">5MB</span>.</li>
          <li>Safety Gate: Our compiler runs python syntax parsers before building to filter indentation and logic errors.</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-display font-semibold text-white flex items-center gap-2">
          <Code className="w-5 h-5 text-emerald-400" />
          Recommended Python Structure
        </h2>
        <p className="text-xs text-gray-300">
          The code block below demonstrates how to configure your hosted python file to stream stdout cleanly directly to your browser panel:
        </p>
        
        <div className="relative">
          <div className="absolute top-3 right-3 bg-white/5 font-mono text-[9px] text-gray-500 px-2 py-1 rounded">
            python 3.12
          </div>
          <pre className="bg-[#070b13] border border-white/5 rounded-2xl p-6 font-mono text-xs text-emerald-300/90 overflow-x-auto leading-relaxed whitespace-pre shadow-inner">
            {codeSample}
          </pre>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
        <h3 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          System Environment Variables
        </h3>
        <p className="text-xs text-gray-300 leading-relaxed">
          Custom keys configured in the <span className="text-white font-semibold">Bot Settings</span> panel will be loaded straight into your python context using <span className="text-emerald-400 font-mono">os.environ["KEY_NAME"]</span> on boot. The Telegram Bot Token is loaded into <span className="text-emerald-400 font-mono">os.environ["TELEGRAM_BOT_TOKEN"]</span> automatically.
        </p>
      </div>
    </div>
  );
}
