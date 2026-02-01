# WhatsApp Bridge for Claude Code

A Claude Code plugin that enables bidirectional WhatsApp messaging. Let Claude send you messages, wait for your replies, and keep you updated on long-running tasks.

## Features

- **Send messages** to any WhatsApp contact
- **Wait for replies** with configurable timeouts
- **List chats** and message history
- **QR code authentication** - scan once, stay connected
- **Auto-reconnect** on connection loss

## Installation

### From GitHub

```bash
# In Claude Code
/plugin install olavl/whatsapp-bridge-mcp
```

### Local Development

```bash
# Clone the repo
git clone https://github.com/olavl/whatsapp-bridge-mcp.git
cd whatsapp-bridge-mcp

# Install in Claude Code
/plugin install ./
```

## Setup

1. **Install the plugin** (see above)

2. **Authenticate with WhatsApp:**
   - Use the `show_qr_code` tool in Claude Code
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices > Link a Device
   - Scan the QR code displayed in your terminal

3. **Optional: Set default recipient**
   Add to your environment:
   ```bash
   export WHATSAPP_DEFAULT_RECIPIENT="+1234567890"
   ```

## Tools

| Tool | Description |
|------|-------------|
| `send_message` | Send a message to a contact |
| `wait_for_reply` | Wait for user's response |
| `send_and_wait` | Send and wait in one step |
| `list_chats` | List recent conversations |
| `get_messages` | Get messages from a chat |
| `get_auth_status` | Check connection status |
| `show_qr_code` | Display auth QR code |

## Usage Examples

**Send a notification:**
```
Claude: I'll notify you when the build is done.
[Uses send_message: "Build completed successfully! Ready for review."]
```

**Get user input:**
```
Claude: I need to know which database to use.
[Uses send_and_wait: "Should I use PostgreSQL or MySQL for this project?"]
User replies: "PostgreSQL"
Claude: Got it, I'll set up PostgreSQL.
```

**Check status:**
```
Claude: Let me check if WhatsApp is connected.
[Uses get_auth_status]
```

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `WHATSAPP_AUTH_DIR` | Directory for auth credentials | `~/.whatsapp-bridge` |
| `WHATSAPP_DEFAULT_RECIPIENT` | Default phone number to message | (none) |

## Combining with call-me Plugin

This plugin works great alongside the [call-me](https://github.com/ZeframLou/call-me) plugin:

- **WhatsApp**: Async updates, simple questions, progress reports
- **Phone calls**: Complex discussions, urgent decisions, real-time conversations

Claude can intelligently choose the right channel based on context.

## Requirements

- [Bun](https://bun.sh) runtime
- WhatsApp account
- Phone with WhatsApp for QR code scanning

## How It Works

The plugin uses [Baileys](https://github.com/WhiskeySockets/Baileys), an open-source WhatsApp Web API library. It:

1. Connects to WhatsApp Web servers
2. Authenticates via QR code (one-time)
3. Maintains a persistent session
4. Exposes messaging via MCP tools

Your credentials are stored locally in `~/.whatsapp-bridge/` and never leave your machine.

## Troubleshooting

**QR code not showing:**
- Run `show_qr_code` tool
- Check terminal output (not the chat)

**Connection lost:**
- The plugin auto-reconnects up to 5 times
- If logged out on phone, scan QR again

**Messages not received:**
- Ensure phone has internet connection
- WhatsApp must stay installed on phone

## License

MIT
