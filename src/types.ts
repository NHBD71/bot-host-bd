export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  plan: string;
  status: 'active' | 'suspended' | 'banned';
  createdAt: string;
}

export interface BotMetadata {
  botId: string;
  ownerId: string;
  botName: string;
  token: string;
  description?: string;
  status: 'running' | 'stopped' | 'offline' | 'build_failed';
  uptime: number;
  pythonVersion: '3.10' | '3.11' | '3.12';
  createdAt: string;
  autoRestart?: boolean;
  envVars?: string; // JSON string or text pairs
  codeText?: string;
}

export interface HostingPlan {
  id?: string;
  name: string;
  price: number;
  maxBots: number;
  limits: string;
}

export interface SubscriptionRequest {
  id?: string;
  requestId: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: string;
  planName: string;
  price: number;
  paymentMethod: 'Bkash' | 'Nagad';
  senderNumber: string;
  transactionId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface TicketReply {
  authorId: string;
  authorName: string;
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  ticketId: string;
  userId: string;
  subject: string;
  message: string;
  status: 'open' | 'replied' | 'closed';
  createdAt: string;
  replies?: TicketReply[];
}

export interface Announcement {
  id?: string;
  title: string;
  message: string;
  createdAt: string;
}
