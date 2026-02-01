/**
 * WhatsApp Manager - Baileys integration for WhatsApp Web
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeInMemoryStore,
  type WASocket,
  type ConnectionState,
  type WAMessage,
  type BaileysEventMap,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
}

export interface Message {
  id: string;
  chatId: string;
  sender: string;
  senderName?: string;
  text: string;
  timestamp: number;
  fromMe: boolean;
}

export interface AuthStatus {
  connected: boolean;
  phoneNumber?: string;
  lastActivity?: number;
}

interface PendingReply {
  chatId: string;
  resolve: (message: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class WhatsAppManager {
  private sock: WASocket | null = null;
  private store = makeInMemoryStore({});
  private authDir: string;
  private pendingReplies = new Map<string, PendingReply>();
  private currentQR: string | null = null;
  private connected = false;
  private phoneNumber: string | null = null;
  private lastActivity: number | null = null;
  private lastSentChatId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(authDir?: string) {
    const defaultDir = join(homedir(), '.whatsapp-bridge');
    this.authDir = authDir?.replace('~', homedir()) || defaultDir;
  }

  async connect(): Promise<void> {
    // Ensure auth directory exists
    if (!existsSync(this.authDir)) {
      await mkdir(this.authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['WhatsApp Bridge', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    // Bind store to socket events
    this.store.bind(this.sock.ev);

    // Handle connection updates
    this.sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
      this.handleConnectionUpdate(update);
    });

    // Save credentials on update
    this.sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    this.sock.ev.on('messages.upsert', (m: BaileysEventMap['messages.upsert']) => {
      this.handleMessagesUpsert(m);
    });

    // Wait for connection or QR code
    await this.waitForConnection(30000);
  }

  private handleConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.currentQR = qr;
      console.error('[WhatsApp] QR code available - use show_qr_code tool to display');
    }

    if (connection === 'close') {
      this.connected = false;
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.error(`[WhatsApp] Connection closed. Status: ${statusCode}`);

      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.error(`[WhatsApp] Reconnecting... (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), 3000);
      } else if (statusCode === DisconnectReason.loggedOut) {
        console.error('[WhatsApp] Logged out - need to scan QR code again');
      }
    }

    if (connection === 'open') {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.currentQR = null;
      this.lastActivity = Date.now();

      // Get phone number from socket
      const user = this.sock?.user;
      if (user) {
        this.phoneNumber = user.id.split(':')[0];
        console.error(`[WhatsApp] Connected as +${this.phoneNumber}`);
      }
    }
  }

  private handleMessagesUpsert(m: BaileysEventMap['messages.upsert']): void {
    const { messages, type } = m;

    for (const msg of messages) {
      // Skip non-notify messages and messages from self
      if (type !== 'notify' || msg.key.fromMe) continue;

      const chatId = msg.key.remoteJid;
      if (!chatId) continue;

      this.lastActivity = Date.now();

      // Check if we're waiting for a reply from this chat
      const pending = this.pendingReplies.get(chatId);
      if (pending) {
        const text = this.extractMessageText(msg);
        if (text) {
          clearTimeout(pending.timeout);
          this.pendingReplies.delete(chatId);
          pending.resolve(text);
        }
      }

      // Also check if we're waiting for any reply (using last sent chat)
      if (this.lastSentChatId && chatId === this.lastSentChatId) {
        const anyPending = this.pendingReplies.get('__any__');
        if (anyPending) {
          const text = this.extractMessageText(msg);
          if (text) {
            clearTimeout(anyPending.timeout);
            this.pendingReplies.delete('__any__');
            anyPending.resolve(text);
          }
        }
      }
    }
  }

  private extractMessageText(msg: WAMessage): string | null {
    const content = msg.message;
    if (!content) return null;

    if (content.conversation) return content.conversation;
    if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
    if (content.imageMessage?.caption) return content.imageMessage.caption;
    if (content.videoMessage?.caption) return content.videoMessage.caption;
    if (content.documentMessage?.caption) return content.documentMessage.caption;

    return null;
  }

  private async waitForConnection(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.connected) return;
      if (this.currentQR) {
        // QR available but not scanned yet - that's okay, we'll wait
        console.error('[WhatsApp] Waiting for QR code scan...');
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!this.connected && this.currentQR) {
      // Not connected but QR is available - acceptable state
      console.error('[WhatsApp] Ready for QR scan');
      return;
    }

    if (!this.connected) {
      throw new Error('WhatsApp connection timeout');
    }
  }

  async sendMessage(recipient: string, message: string): Promise<{ messageId: string; timestamp: number }> {
    if (!this.sock) throw new Error('WhatsApp not connected');

    // Normalize phone number to JID format
    const jid = this.normalizeRecipient(recipient);

    const result = await this.sock.sendMessage(jid, { text: message });

    this.lastSentChatId = jid;
    this.lastActivity = Date.now();

    return {
      messageId: result?.key.id || 'unknown',
      timestamp: Date.now(),
    };
  }

  async waitForReply(chatId?: string, timeoutMs: number = 300000): Promise<string> {
    const targetChatId = chatId || this.lastSentChatId;

    if (!targetChatId) {
      throw new Error('No chat specified and no recent message sent');
    }

    // Use special key for "any" reply if no specific chat
    const waitKey = chatId ? this.normalizeRecipient(chatId) : '__any__';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReplies.delete(waitKey);
        reject(new Error(`Timeout waiting for reply after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);

      this.pendingReplies.set(waitKey, {
        chatId: targetChatId,
        resolve,
        reject,
        timeout,
      });
    });
  }

  async sendAndWait(
    recipient: string,
    message: string,
    timeoutMs: number = 300000
  ): Promise<string> {
    await this.sendMessage(recipient, message);
    return this.waitForReply(recipient, timeoutMs);
  }

  async listChats(limit: number = 20): Promise<Chat[]> {
    if (!this.sock) throw new Error('WhatsApp not connected');

    const chats = this.store.chats.all();

    return chats
      .slice(0, limit)
      .map(chat => ({
        id: chat.id,
        name: chat.name || chat.id.split('@')[0],
        lastMessage: undefined, // Would need message history
        lastMessageTime: chat.conversationTimestamp
          ? Number(chat.conversationTimestamp) * 1000
          : undefined,
        unreadCount: chat.unreadCount || 0,
      }));
  }

  async getMessages(chatId: string, limit: number = 10): Promise<Message[]> {
    if (!this.sock) throw new Error('WhatsApp not connected');

    const jid = this.normalizeRecipient(chatId);
    const messages = this.store.messages[jid];

    if (!messages) return [];

    const result: Message[] = [];
    const allMessages = messages.array.slice(-limit);

    for (const msg of allMessages) {
      const text = this.extractMessageText(msg);
      if (text) {
        result.push({
          id: msg.key.id || 'unknown',
          chatId: jid,
          sender: msg.key.participant || msg.key.remoteJid || 'unknown',
          senderName: msg.pushName,
          text,
          timestamp: Number(msg.messageTimestamp) * 1000,
          fromMe: msg.key.fromMe || false,
        });
      }
    }

    return result;
  }

  getAuthStatus(): AuthStatus {
    return {
      connected: this.connected,
      phoneNumber: this.phoneNumber || undefined,
      lastActivity: this.lastActivity || undefined,
    };
  }

  showQRCode(): string | null {
    if (this.currentQR) {
      qrcode.generate(this.currentQR, { small: true });
      return this.currentQR;
    }

    if (this.connected) {
      return 'Already connected - no QR code needed';
    }

    return null;
  }

  private normalizeRecipient(recipient: string): string {
    // Already a JID
    if (recipient.includes('@')) return recipient;

    // Phone number - normalize and convert to JID
    const cleaned = recipient.replace(/[^0-9]/g, '');
    return `${cleaned}@s.whatsapp.net`;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
      this.connected = false;
    }
  }
}
