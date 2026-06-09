import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { initializeApp as initFirebase } from "firebase/app";
import { initializeFirestore, collection, query, where, getDocs, doc, limit, updateDoc, deleteDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

const firebaseApp = initFirebase(firebaseConfig);
const dbServer = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// In-memory logs registry to hold real-time bot events
const botLogs = new Map<string, string[]>();

function addLog(botId: string, message: string) {
  const currentLogs = botLogs.get(botId) || [];
  currentLogs.push(`[${new Date().toISOString()}] ${message}`);
  if (currentLogs.length > 100) {
    currentLogs.shift();
  }
  botLogs.set(botId, currentLogs);
}

// In-memory chat history for conversational memory
interface ChatMessage {
  role: "user" | "model";
  text: string;
}
const chatHistory = new Map<string, ChatMessage[]>();

// In-memory registry for tracking "running" bot metadata for background loops
interface RunningBotEntry {
  botId: string;
  userId: string;
  startTime: number;
  autoRestart: boolean;
  documentId: string;
}
const runningBots = new Map<string, RunningBotEntry>();

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in this container environment.");
}

const ai = new GoogleGenAI({
  apiKey: geminiApiKey || "MOCK_KEY",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper to query bot credentials & codeText by botId from Firestore using Firebase SDK
async function getBotFromFirestore(botId: string): Promise<{ botId: string; token: string; envVars: string; documentId: string; codeText: string; botName: string; description?: string } | null> {
  try {
    const q = query(collection(dbServer, "bots"), where("botId", "==", botId), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();
    return {
      botId: data.botId || botId,
      token: data.token || "",
      envVars: data.envVars || "{}",
      documentId: docSnap.id,
      codeText: data.codeText || "",
      botName: data.botName || "",
      description: data.description || "",
    };
  } catch (error) {
    console.error(`[getBotFromFirestore SDK] Error:`, error);
    return null;
  }
}

// Helper to query bot configuration by Token (essential for inbound webhook routing) using Firebase SDK
async function getBotByTokenFromFirestore(tokenVal: string): Promise<{ botId: string; documentId: string; codeText: string; botName: string; description?: string } | null> {
  try {
    const q = query(collection(dbServer, "bots"), where("token", "==", tokenVal));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    const docs = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        botId: data.botId || "",
        documentId: docSnap.id,
        codeText: data.codeText || "",
        botName: data.botName || "",
        description: data.description || "",
        status: data.status || "stopped",
        createdAt: data.createdAt ? (data.createdAt.seconds || 0) : 0,
      };
    });

    const runningBotsList = docs.filter((b) => b.status === "running");
    if (runningBotsList.length > 0) {
      runningBotsList.sort((a, b) => b.createdAt - a.createdAt);
      return runningBotsList[0];
    }

    docs.sort((a, b) => b.createdAt - a.createdAt);
    return docs[0];
  } catch (error) {
    console.error(`[getBotByTokenFromFirestore SDK] Error:`, error);
    return null;
  }
}

// Helper to write codeText back to Firestore using Firebase SDK
async function updateBotCodeInFirestore(botId: string, codeText: string): Promise<boolean> {
  try {
    const botDoc = await getBotFromFirestore(botId);
    if (!botDoc) return false;
    const { documentId } = botDoc;
    await updateDoc(doc(dbServer, "bots", documentId), { codeText });
    return true;
  } catch (error) {
    console.error("[updateBotCodeInFirestore SDK] Error:", error);
    return false;
  }
}

// Update Firestore bot status & uptime metrics via Firebase SDK
async function updateBotStatusInFirestoreByDocId(documentId: string, status: string, uptime: number = 0) {
  try {
    await updateDoc(doc(dbServer, "bots", documentId), { status, uptime });
  } catch (error) {
    console.error("[updateBotStatusInFirestoreByDocId SDK] Error:", error);
  }
}

// Delete Firestore bot document via Firebase SDK
async function deleteBotFromFirestoreByDocId(documentId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(dbServer, "bots", documentId));
    return true;
  } catch (error) {
    console.error("[deleteBotFromFirestoreByDocId SDK] Error:", error);
    return false;
  }
}

// In-memory script syntax structural validator
function validateScriptSanity(code: string): { valid: boolean; error?: string } {
  const containsPythonConstruct = code.includes("def ") || code.includes("import ") || code.includes("print(");
  const totalLength = code.length;

  if (totalLength < 10) {
    return { valid: false, error: "The provided script/prompt is too short to construct a dynamic conversational flow." };
  }
  if (code.includes("def ") && !code.includes(":")) {
    return { valid: false, error: "Python indendation/compilation structural warning: Missing expected colon ':' after 'def' statement." };
  }
  return { valid: true };
}

// In-memory pip package requirement validator
function validateRequirements(reqTxt: string): { valid: boolean; error?: string } {
  const lines = reqTxt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    
    const validPattern = /^[a-zA-Z0-9_\-\[\]]+(==|>=|<=|>|<|~=)?[a-zA-Z0-9_\-\.\*]*$/;
    if (!validPattern.test(line)) {
      return {
        valid: false,
        error: `Invalid requirement syntax on line ${i + 1}: "${line}". Setup requires direct pip identifiers.`,
      };
    }
  }
  return { valid: true };
}

// Helper to resolve the correct, public HTTPS webhook URL to register with Telegram
function resolveWebhookUrl(req: express.Request, token: string, bodyOrigin?: string): string {
  const protocol = "https"; // Telegram REQUIRES https
  let host = "";

  // Helper to validate and verify if a host is public and doesn't belong to ai.studio or google.com
  const isHostValid = (h: string) => {
    if (!h) return false;
    const lower = h.toLowerCase();
    return !lower.includes("localhost") && 
           !lower.includes("127.0.0.1") && 
           !lower.includes("ai.studio") && 
           !lower.includes("google.com");
  };

  if (bodyOrigin) {
    try {
      const parsed = new URL(bodyOrigin);
      if (isHostValid(parsed.host)) {
        host = parsed.host;
      }
    } catch (e) {}
  }

  if (!host && req.headers["x-forwarded-host"]) {
    const fHost = req.headers["x-forwarded-host"];
    const fh = Array.isArray(fHost) ? fHost[0] : fHost;
    if (isHostValid(fh)) {
      host = fh;
    }
  }

  if (!host && req.headers["x-original-host"]) {
    const oHost = req.headers["x-original-host"];
    const oh = Array.isArray(oHost) ? oHost[0] : oHost;
    if (isHostValid(oh)) {
      host = oh;
    }
  }

  if (!host && req.headers["referer"]) {
    try {
      const refUrl = new URL(req.headers["referer"] as string);
      if (isHostValid(refUrl.host)) {
        host = refUrl.host;
      }
    } catch (e) {}
  }

  if (!host) {
    const reqHost = req.get("host") || "localhost:3000";
    if (isHostValid(reqHost)) {
      host = reqHost;
    }
  }

  if (!host) {
    // If absolutely no valid public host discovered, fall back to current host
    host = req.get("host") || "localhost:3000";
  }

  // Clean any comma-separated proxies
  host = host.split(",")[0].trim();
  
  let finalUrl = `${protocol}://${host}/webhook/${token}`;
  if (finalUrl.includes("ais-dev-")) {
    finalUrl = finalUrl.replace("ais-dev-", "ais-pre-");
  }
  return finalUrl;
}

// Active Pollers Registry
interface BotPollerState {
  abortController: AbortController;
  lastUpdateId: number;
}
const activePollers = new Map<string, BotPollerState>();

function stopBotPoller(botId: string) {
  const current = activePollers.get(botId);
  if (current) {
    current.abortController.abort();
    activePollers.delete(botId);
  }
}

// Helper to evaluate simple math expressions safely
function evaluateMath(expression: string): string | null {
  try {
    if (!/^[0-9\s+\-*/()]+$/.test(expression)) return null;
    const result = new Function(`return (${expression})`)();
    if (typeof result === "number" && !isNaN(result)) {
      return String(result);
    }
  } catch (e) {}
  return null;
}

// Clean and substitute variables inside matched replies
function formatMatchedReply(reply: string, username: string, chatId: number, originalUserMessage: string): string {
  let formatted = reply;
  
  // Replace typical python template placeholders or variables
  formatted = formatted.replace(/\{?message\.from_user\.username\}?/g, `@${username}`);
  formatted = formatted.replace(/\{?message\.from_user\.first_name\}?/g, username);
  formatted = formatted.replace(/message\.from_user\.username/g, `@${username}`);
  formatted = formatted.replace(/message\.from_user\.first_name/g, username);
  formatted = formatted.replace(/\{?message\.chat\.id\}?/g, String(chatId));
  formatted = formatted.replace(/message\.chat\.id/g, String(chatId));
  formatted = formatted.replace(/\{?username\}?/g, `@${username}`);
  formatted = formatted.replace(/\{?first_name\}?/g, username);

  // If they used 'message.text' or similar inside formatting placeholders, substitute it with the user's message
  formatted = formatted.replace(/\{?message\.text\}?/g, originalUserMessage);
  formatted = formatted.replace(/message\.text/g, originalUserMessage);

  // Clean python f-string prefixes and outer quotes if parsed with them
  if (formatted.startsWith('f"') || formatted.startsWith("f'")) {
    formatted = formatted.substring(2);
    if (formatted.endsWith('"') || formatted.endsWith("'")) {
      formatted = formatted.substring(0, formatted.length - 1);
    }
  } else if (formatted.startsWith('"') || formatted.startsWith("'")) {
    formatted = formatted.substring(1);
    if (formatted.endsWith('"') || formatted.endsWith("'")) {
      formatted = formatted.substring(0, formatted.length - 1);
    }
  }

  // Escape typical raw escaped characters if we extracted them as raw backslashes
  formatted = formatted.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  return formatted;
}

// Parse commands and keyword matches directly from user python bot code 
function parseRulesFromPython(codeText: string): { triggerType: string; values: string[]; reply: string }[] {
  const rules: { triggerType: string; values: string[]; reply: string }[] = [];
  if (!codeText) return rules;

  // Split target by message_handler blocks to keep block-scoped replies synced to triggers
  const blocks = codeText.split(/@bot\.message_handler/);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Separate the function signature/decorator from the function body to avoid parsing decorator args as replies
    let body = block;
    const defIndex = block.indexOf("def ");
    if (defIndex !== -1) {
      body = block.substring(defIndex);
    }

    let replyText = "";
    
    // Grab text from reply_to or send_message inside the function body
    const rxSendStringMatch = /(?:reply_to|send_message|send_msg|send|reply)\s*\([^,]+,\s*(?:f?"""([\s\S]*?)"""|f?'''([\s\S]*?)'''|f?"([^"\\]*(?:\\.[^"\\]*)*)"|f?'([^'\\]*(?:\\.[^'\\]*)*)')/gi;
    const stringMatches = [...body.matchAll(rxSendStringMatch)];
    
    if (stringMatches.length > 0) {
      replyText = stringMatches[0][1] || stringMatches[0][2] || stringMatches[0][3] || stringMatches[0][4] || "";
    } else {
      // Fallback: search for first quoted string block ONLY within the function body (where the replies live)
      // This correctly skips parsing default decorator keywords like 'start' or 'help' as our reply.
      const tripleDouble = body.match(/"""([\s\S]*?)"""/);
      const tripleSingle = body.match(/'''([\s\S]*?)'''/);
      const doubleQuote = body.match(/"([^"\\]*(?:\\.[^"\\]*)*)"/);
      const singleQuote = body.match(/'([^'\\]*(?:\\.[^'\\]*)*)'/);
      
      const matches = [
        { index: tripleDouble && tripleDouble.index !== undefined ? body.indexOf(tripleDouble[0]) : Infinity, text: tripleDouble ? tripleDouble[1] : "" },
        { index: tripleSingle && tripleSingle.index !== undefined ? body.indexOf(tripleSingle[0]) : Infinity, text: tripleSingle ? tripleSingle[1] : "" },
        { index: doubleQuote && doubleQuote.index !== undefined ? body.indexOf(doubleQuote[0]) : Infinity, text: doubleQuote ? doubleQuote[1] : "" },
        { index: singleQuote && singleQuote.index !== undefined ? body.indexOf(singleQuote[0]) : Infinity, text: singleQuote ? singleQuote[1] : "" }
      ];
      
      matches.sort((a, b) => a.index - b.index);
      if (matches[0].index !== Infinity) {
        replyText = matches[0].text;
      }
    }

    if (!replyText) continue;

    // A. Regexp trigger: regexp='pattern' or regexp="pattern"
    const regexpMatch = block.match(/regexp\s*=\s*(?:r)?['"]([^'"]+)['"]/);
    if (regexpMatch) {
      rules.push({ triggerType: "regexp", values: [regexpMatch[1]], reply: replyText });
      continue;
    }

    // B. Lambda eq triggers: func=lambda message: message.text == "hello" (case-insensitive & support optional .lower())
    const eqLambda = block.match(/func\s*=\s*lambda\s+([a-zA-Z0-9_]+)\s*:\s*\1\.text(?:\.lower\(\))?\s*(?:==|===)\s*['"]([^'"]+)['"]/i);
    if (eqLambda) {
      rules.push({ triggerType: "keyword_exact", values: [eqLambda[2].toLowerCase()], reply: replyText });
      continue;
    }

    // C. Lambda in triggers: func=lambda m: "price" in m.text.lower()
    const inLambda = block.match(/func\s*=\s*lambda\s+([a-zA-Z0-9_]+)\s*:\s*['"]([^'"]+)['"]\s+in\s+\1\.text(?:\.lower\(\))?/i);
    if (inLambda) {
      rules.push({ triggerType: "keyword_contains", values: [inLambda[2].toLowerCase()], reply: replyText });
      continue;
    }

    // D. Commands trigger: commands=['start', 'help']
    const cmdMatch = block.match(/commands\s*=\s*\[([^\]]+)\]/);
    if (cmdMatch) {
      const cmds = cmdMatch[1]
        .split(",")
        .map(c => c.replace(/['"\s]/g, ""))
        .filter(Boolean)
        .map(c => c.toLowerCase());
      if (cmds.length > 0) {
        rules.push({ triggerType: "command", values: cmds, reply: replyText });
        continue;
      }
    }

    // Single command e.g. commands='start' or commands="start"
    const singleCmd = block.match(/commands\s*=\s*['"]([^'"]+)['"]/);
    if (singleCmd) {
      rules.push({ triggerType: "command", values: [singleCmd[1].toLowerCase()], reply: replyText });
      continue;
    }

    // E. Match message.text == 'hello' directly
    const eqMatch = block.match(/(?:message|msg|m)\.text(?:\.lower\(\))?\s*(?:==|===)\s*['"]([^'"]+)['"]/i);
    if (eqMatch) {
      rules.push({ triggerType: "keyword_exact", values: [eqMatch[1].toLowerCase()], reply: replyText });
      continue;
    }

    // F. Match 'hello' in message.text directly
    const inMatch = block.match(/['"]([^'"]+)['"]\s+in\s+(?:message|msg|m)\.text(?:\.lower\(\))?/i);
    if (inMatch) {
      rules.push({ triggerType: "keyword_contains", values: [inMatch[1].toLowerCase()], reply: replyText });
      continue;
    }

    // G. Catchall triggers (e.g., func=lambda m: True)
    if (block.includes("func=lambda") && (block.includes("True") || block.includes("true"))) {
      rules.push({ triggerType: "catchall", values: [], reply: replyText });
    }
  }

  // Scan single line manual conditions outside decorators
  const lines = codeText.split("\n");
  for (const line of lines) {
    const ifEq = line.match(/if\s+(?:message|msg|m)\.text(?:\.lower\(\))?\s*(?:==|===)\s*['"]([^'"]+)['"]\s*:\s*(?:bot\.)?(?:reply_to|send_message|send_msg)\s*\([^,]+,\s*(?:f?['"]+([^'"]+)['"]+|f?[']+([^']+)[']+)/i);
    if (ifEq) {
      const reply = ifEq[1] || ifEq[2] || ifEq[3] || "";
      rules.push({ triggerType: "keyword_exact", values: [ifEq[1].toLowerCase()], reply });
    }
    const ifIn = line.match(/if\s+['"]([^'"]+)['"]\s+in\s+(?:message|msg|m)\.text(?:\.lower\(\))?\s*:\s*(?:bot\.)?(?:reply_to|send_message|send_msg)\s*\([^,]+,\s*(?:f?['"]+([^'"]+)['"]+|f?[']+([^']+)[']+)/i);
    if (ifIn) {
      const reply = ifIn[1] || ifIn[2] || ifIn[3] || "";
      rules.push({ triggerType: "keyword_contains", values: [ifIn[1].toLowerCase()], reply });
    }
  }

  return rules;
}

// Parse plaintext matching lines from instructions
function parseRulesFromPlainText(text: string): { triggerType: string; values: string[]; reply: string }[] {
  const rules: { triggerType: string; values: string[]; reply: string }[] = [];
  if (!text) return rules;

  const lines = text.split("\n");
  for (const line of lines) {
    const arrowParts = line.split(/->|:/);
    if (arrowParts.length === 2) {
      const pattern = arrowParts[0].trim().toLowerCase();
      const reply = arrowParts[1].trim();
      if (pattern && reply) {
        if (pattern.startsWith("/")) {
          rules.push({ triggerType: "command", values: [pattern.substring(1)], reply });
        } else {
          rules.push({ triggerType: "keyword_exact", values: [pattern], reply });
        }
      }
    }
    const matchReg = line.match(/(?:if user says|says|says)\s+["']?([^"']+)["']?,\s*(?:reply with|reply|say)\s+["']?([^"']+)["']?/gi);
    if (matchReg) {
      const keyword = matchReg[1].trim().toLowerCase();
      const replyText = matchReg[2].trim();
      rules.push({ triggerType: "keyword_contains", values: [keyword], reply: replyText });
    }
  }
  return rules;
}

// Perform hyper-strict comparison against python-defined decorators and fallback rules
function generateLocalResponse(
  botId: string,
  botName: string,
  description: string,
  codeText: string,
  userMessage: string,
  username: string,
  chatId: number
): string | null {
  const normMsg = userMessage.toLowerCase().trim();

  // Combine rules from Python script code and plaintext behavior description
  const pythonRules = parseRulesFromPython(codeText);
  const textRules = parseRulesFromPlainText(description);
  const allRules = [...pythonRules, ...textRules];

  // 1. Command Matches
  if (normMsg.startsWith("/")) {
    const cmdName = normMsg.split(" ")[0].substring(1);
    const matchedRule = allRules.find(r => r.triggerType === "command" && r.values.includes(cmdName));
    if (matchedRule) {
      return formatMatchedReply(matchedRule.reply, username, chatId, userMessage);
    }
  }

  // 2. Exact word Match (case-insensitive)
  const matchedExact = allRules.find(r => r.triggerType === "keyword_exact" && r.values.includes(normMsg));
  if (matchedExact) {
    return formatMatchedReply(matchedExact.reply, username, chatId, userMessage);
  }

  // 3. Contained keywords matching
  const matchedContains = allRules.find(r => r.triggerType === "keyword_contains" && r.values.some(v => normMsg.includes(v)));
  if (matchedContains) {
    return formatMatchedReply(matchedContains.reply, username, chatId, userMessage);
  }

  // 4. Regexp matching
  const matchedRegexp = allRules.find(r => {
    if (r.triggerType !== "regexp") return false;
    return r.values.some(v => {
      try {
        return new RegExp(v, "i").test(userMessage);
      } catch (err) {
        return false;
      }
    });
  });
  if (matchedRegexp) {
    return formatMatchedReply(matchedRegexp.reply, username, chatId, userMessage);
  }

  // 5. Catchall trigger matching
  const matchedCatchall = allRules.find(r => r.triggerType === "catchall");
  if (matchedCatchall) {
    return formatMatchedReply(matchedCatchall.reply, username, chatId, userMessage);
  }

  // 6. If absolutely no custom conditions match, return null to remain completely silent
  return null;
}

// Global update processor shared between webhook and long pollers
async function processTelegramUpdate(bot: { botId: string; botName: string; description?: string; codeText: string }, token: string, update: any) {
  let activeBotId = bot.botId;
  let activeChatId: number | null = null;

  try {
    const { botId, botName, description, codeText } = bot;

    let chatId: number | null = null;
    let text: string | null = null;
    let username = "User";

    if (update.message) {
      chatId = update.message.chat?.id || null;
      text = update.message.text || null;
      username = update.message.from?.username || update.message.from?.first_name || "User";
    } else if (update.callback_query) {
      chatId = update.callback_query.message?.chat?.id || null;
      text = update.callback_query.data || null;
      username = update.callback_query.from?.username || update.callback_query.from?.first_name || "User";
    }

    if (!chatId || !text) {
      return;
    }
    activeChatId = chatId;

    addLog(botId, `Incoming message from @${username}: "${text}"`);

    // Retrieve conversational memory
    const historyKey = `${botId}_${chatId}`;
    const history = chatHistory.get(historyKey) || [];

    // Compile dynamic instructions incorporating instructions and user script text
    const finalSystemInstruction = `
You are an AI-powered Telegram Bot named "${botName}".
Your creator's defined behavior instructions:
${description || "Be a helpful assistant."}

Custom Script Rules / User Program Instructions:
${codeText || ""}

Please respond directly to the user message in a polite, engaging, and context-aware manner, acting matching the persona above. Deliver raw response text only. Avoid formatting markdown wrappers or JSON.
`;

    // Package conversational history for Gemini SDK
    const contentsPayload = [
      ...history.map((h) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      })),
      { role: "user", parts: [{ text }] },
    ];

    let responseText = "";
    const currentApiKey = process.env.GEMINI_API_KEY;
    const isMock = !currentApiKey || currentApiKey === "MOCK_KEY" || currentApiKey === "";

    // 1. Try matching Python script rules / commands/ keywords FIRST
    const pythonRules = parseRulesFromPython(codeText || "");
    const plaintextRules = parseRulesFromPlainText(description || "");
    const totalRulesCount = pythonRules.length + plaintextRules.length;

    const matchedLocal = generateLocalResponse(botId, botName, description || "", codeText || "", text, username, chatId);

    if (matchedLocal !== null) {
      responseText = matchedLocal;
      addLog(botId, `Matched custom code/text rule perfectly. Response Generated: "${responseText.substring(0, 80)}"`);
    } else {
      // 2. If we have custom rules defined inside botPy script (or behavior description instructions) but nothing matched,
      // the bot must stay absolutely silent (chupchap) and return.
      if (totalRulesCount > 0) {
        addLog(botId, `Input "${text}" does not match any rules in the custom script. Remaining strictly silent (chupchap).`);
        return; // Stay completely quiet, return immediately.
      }

      // 3. Fallback to Gemini AI ONLY if there are absolutely no commands/rules found inside the script (acts as default AI chat)
      if (!isMock) {
        try {
          addLog(botId, `No custom rules/commands defined. Fallback: query Google Gemini AI on "gemini-3.5-flash"...`);
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: contentsPayload,
            config: {
              systemInstruction: finalSystemInstruction,
            },
          });
          responseText = response.text || "";
        } catch (geminiError: any) {
          addLog(botId, `Gemini API query failed: ${geminiError.message || String(geminiError)}`);
        }
      }

      if (!responseText) {
        addLog(botId, `Unmatched message: "${text}". Remaining silent.`);
        return;
      }
    }

    addLog(botId, `Response generated: "${responseText.substring(0, 80)}${responseText.length > 80 ? '...' : ''}"`);

    // Update in-memory session history (max 8 conversation turns to prevent context bloat)
    history.push({ role: "user", text });
    history.push({ role: "model", text: responseText });
    if (history.length > 16) {
      history.splice(0, 2);
    }
    chatHistory.set(historyKey, history);

    // Dispatch reply back to Telegram
    const telegramSendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const sendResponse = await fetch(telegramSendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText,
      }),
    });

    if (sendResponse.ok) {
      addLog(botId, `Successfully sent message reply back to Telegram chat ID ${chatId}.`);
    } else {
      const errorText = await sendResponse.text();
      addLog(botId, `Telegram delivery fail: ${errorText}`);
    }

  } catch (err: any) {
    console.error("[Telegram Processing Error]:", err);
    const errMsg = err.message || String(err);
    if (activeBotId) {
      addLog(activeBotId, `[ERROR SERVICE FAIL]: ${errMsg}`);
    }
    if (activeChatId) {
      try {
        const telegramSendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        await fetch(telegramSendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: activeChatId,
            text: `⚠️ Bot Platform Connection Failed:\n\nDetailed Reason: ${errMsg}\n\nPlease check your server credentials and settings variables.`,
          }),
        });
      } catch (tgErr) {
        console.error("Failed to post back error callback directly to Telegram user chat:", tgErr);
      }
    }
  }
}

async function startBotPoller(botId: string, token: string) {
  stopBotPoller(botId);

  try {
    addLog(botId, "Clearing webhook to enable long-polling mode (Sandbox friendly)...");
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
  } catch (err) {
    console.error(`[stopWebhook] Failed to delete webhook for bot ${botId}:`, err);
  }

  const abortController = new AbortController();
  const { signal } = abortController;
  let lastUpdateId = 0;

  activePollers.set(botId, { abortController, lastUpdateId });

  addLog(botId, "Starting active Long-Polling connection loop with Telegram servers...");

  async function pollLoop() {
    if (signal.aborted) return;

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=10&limit=5`, { signal });
      if (signal.aborted) return;
      
      const data = await response.json();
      if (data.ok && data.result) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          
          const botConfig = await getBotFromFirestore(botId);
          if (botConfig) {
            await processTelegramUpdate(botConfig, token, update);
          } else {
            console.warn(`[Poller] Bot config ${botId} deleted, stopping loop.`);
            stopBotPoller(botId);
            return;
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError" || signal.aborted) {
        return;
      }
      console.error(`[Poller error for ${botId}]:`, err);
    }

    if (!signal.aborted) {
      setTimeout(pollLoop, 1000);
    }
  }

  pollLoop();
}

// API: File submission / workspace validation on creation - Memory-safe
app.post("/api/bots/:botId/files", async (req, res) => {
  const { botId } = req.params;
  const { userId, botName, botPy, requirementsTxt = "", pythonVersion } = req.body;

  if (!userId || !botPy) {
    return res.status(400).json({ error: "Missing required script text or user credentials." });
  }

  if (botPy.length > 5120000 || (requirementsTxt && requirementsTxt.length > 5120000)) {
    return res.status(400).json({ error: "Script sizes must remain under 5MB to preserve cloud resources." });
  }

  const sanity = validateScriptSanity(botPy);
  if (!sanity.valid) {
    return res.status(400).json({ error: sanity.error });
  }

  if (requirementsTxt.trim()) {
    const reqSanity = validateRequirements(requirementsTxt);
    if (!reqSanity.valid) {
      return res.status(400).json({ error: reqSanity.error });
    }
  }

  addLog(botId, `Workspace initialized successfully. Validated basic script syntax for python ${pythonVersion}.`);
  return res.json({ message: "In-memory syntax and size limits validated successfully." });
});

// API: Update script text in existing workspace (writes directly to Firestore)
app.post("/api/bots/:botId/update-files", async (req, res) => {
  const { botId } = req.params;
  const { userId, botPy, requirementsTxt } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required to identify bot parameters." });
  }

  try {
    if (botPy !== undefined && botPy !== null) {
      if (botPy.length > 5120000) {
        return res.status(400).json({ error: "Script exceeds 5MB memory footprint thresholds." });
      }

      const sanity = validateScriptSanity(botPy);
      if (!sanity.valid) {
        return res.status(400).json({ error: `Syntax check failed: ${sanity.error}` });
      }

      const syncSuccess = await updateBotCodeInFirestore(botId, botPy);
      if (!syncSuccess) {
        return res.status(500).json({ error: "Database rejected the script string update." });
      }
      addLog(botId, `Script codeText updated and synchronized inside Firestore Database.`);
    }

    if (requirementsTxt !== undefined && requirementsTxt !== null) {
      addLog(botId, `Requirements loaded: [${requirementsTxt.trim().replace(/\n/g, ", ")}]. In-memory active.`);
    }

    res.json({ message: "Script parsed and committed to database successfully." });
  } catch (error: any) {
    res.status(500).json({ error: `Settings update failure: ${error.message || error}` });
  }
});

// API: Start / Deploy Bot Webhook - Memory-safe
app.post("/api/bots/:botId/start", async (req, res) => {
  const { botId } = req.params;
  const { userId, botName } = req.body;

  try {
    const botConfig = await getBotFromFirestore(botId);
    if (!botConfig || !botConfig.token) {
      return res.status(404).json({ error: "Bot config or Telegram token not found in database." });
    }

    const { token, documentId } = botConfig;

    addLog(botId, `Deploying bot "${botName || botConfig.botName}" in sandbox hosting mode...`);

    // Launch background poller
    await startBotPoller(botId, token);

    await updateBotStatusInFirestoreByDocId(documentId, "running", 100);

    runningBots.set(botId, {
      botId,
      userId,
      startTime: Date.now(),
      autoRestart: true,
      documentId,
    });

    res.json({ message: `Bot ${botName || botConfig.botName} successfully deployed in high-resiliency polling mode.` });
  } catch (error: any) {
    console.error("Start Bot failed:", error);
    res.status(500).json({ error: "Failed to initiate polling on host: " + error.message });
  }
});

// API: Stop Bot Webhook
app.post("/api/bots/:botId/stop", async (req, res) => {
  const { botId } = req.params;

  try {
    const botConfig = await getBotFromFirestore(botId);
    const docId = botConfig?.documentId || botId;

    // Stop active background poller
    stopBotPoller(botId);

    runningBots.delete(botId);
    await updateBotStatusInFirestoreByDocId(docId, "stopped");
    addLog(botId, "Bot stopped successfully. Polling loop terminated.");
    res.json({ message: "Bot stopped successfully." });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to stop bot: " + error.message });
  }
});

// API: Restart Bot Webhook
app.post("/api/bots/:botId/restart", async (req, res) => {
  const { botId } = req.params;
  const { userId, botName } = req.body;

  runningBots.delete(botId);
  stopBotPoller(botId);

  try {
    const botConfig = await getBotFromFirestore(botId);
    if (!botConfig || !botConfig.token) {
      return res.status(404).json({ error: "Bot credential or token not found." });
    }

    const { token, documentId } = botConfig;

    addLog(botId, `Rebooting bot "${botName || botConfig.botName}" process...`);

    // Launch background poller
    await startBotPoller(botId, token);

    await updateBotStatusInFirestoreByDocId(documentId, "running", 100);

    runningBots.set(botId, {
      botId,
      userId,
      startTime: Date.now(),
      autoRestart: true,
      documentId,
    });

    res.json({ message: "Bot restarted successfully." });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to restart bot: " + error.message });
  }
});

// API: Logs Retrieval - Memory based
app.get("/api/bots/:botId/logs", (req, res) => {
  const { botId } = req.params;
  const search = (req.query.search as string || "").toLowerCase();

  const logsArr = botLogs.get(botId) || [];
  let content = logsArr.length === 0 
    ? "[INFO] Listening via webhook. Waiting for first live conversation events..." 
    : logsArr.join("\n");

  if (search) {
    const lines = content.split("\n");
    const filtered = lines.filter((l) => l.toLowerCase().includes(search));
    content = filtered.join("\n") || `[NO MATCHES FOUND FOR "${search}"]`;
  }
  res.json({ logs: content });
});

// API: Clear Logs - Memory based
app.post("/api/bots/:botId/clear-logs", (req, res) => {
  const { botId } = req.params;
  botLogs.set(botId, [`=== [BOT PLATFORM] Memory logs cleared at ${new Date().toISOString()} ===`]);
  res.json({ message: "Workspace sandbox logs cleared successfully." });
});

// API: Delete Bot
app.delete("/api/bots/:botId", async (req, res) => {
  const { botId } = req.params;
  const { userId, documentId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required to purge bot credentials." });
  }

  runningBots.delete(botId);
  botLogs.delete(botId);
  stopBotPoller(botId);

  try {
    const botConfig = await getBotFromFirestore(botId);
    if (botConfig && botConfig.token) {
      await fetch(`https://api.telegram.org/bot${botConfig.token}/deleteWebhook`).catch(() => {});
    }

    let dbDeleted = false;
    if (documentId) {
      dbDeleted = await deleteBotFromFirestoreByDocId(documentId);
    } else if (botConfig && botConfig.documentId) {
      dbDeleted = await deleteBotFromFirestoreByDocId(botConfig.documentId);
    }

    res.json({ message: "Bot record successfully deleted.", dbDeleted });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to completely clear assets: ${error.message || error}` });
  }
});

// API: Inbound Webhook Router from Telegram API Servers - Memory and Deep-Rule powered
app.post("/webhook/:token", async (req, res) => {
  const { token } = req.params;
  const update = req.body;

  // Telegram expects 200 OK immediately inside webhooks to prevent retries
  res.sendStatus(200);

  try {
    const bot = await getBotByTokenFromFirestore(token);
    if (!bot) {
      console.warn(`[Inbound Webhook] Unrecognized token endpoint.`);
      return;
    }

    // Delegate to processTelegramUpdate directly of the resilient local engine
    await processTelegramUpdate(bot, token, update);
  } catch (err: any) {
    console.error("[Inbound Webhook Error]:", err);
  }
});

// Periodic background synchronizer to update uptime markers in database
setInterval(() => {
  runningBots.forEach(async (bot) => {
    const elapsedSeconds = Math.floor((Date.now() - bot.startTime) / 1000);
    await updateBotStatusInFirestoreByDocId(bot.documentId, "running", elapsedSeconds);
  });
}, 30000);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "alive",
    activeWebhooksCount: runningBots.size,
    engine: "In-Memory Long Polling & Resilient Key-Free Local Rule / NLP Engine",
  });
});

// Synchronize and restore active pollers for all bots marked 'running' in Firestore on server boot
async function restoreRunningBots() {
  try {
    const q = query(collection(dbServer, "bots"), where("status", "==", "running"));
    const querySnapshot = await getDocs(q);
    console.log(`[Startup Restore] Discovered ${querySnapshot.size} running bots to resume...`);
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const botId = data.botId;
      const token = data.token;
      if (botId && token) {
        runningBots.set(botId, {
          botId,
          userId: data.ownerId || "system",
          startTime: Date.now(),
          autoRestart: true,
          documentId: docSnap.id,
        });
        startBotPoller(botId, token);
      }
    });
  } catch (error) {
    console.error("[Startup Restore] Failed to restore running bots collection:", error);
  }
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Restore and start active polling for running bots of all tenants
  await restoreRunningBots();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BotHost Server initialized on http://localhost:${PORT}`);
  });
}

startServer();
