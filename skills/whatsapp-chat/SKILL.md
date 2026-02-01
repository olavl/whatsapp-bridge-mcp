# WhatsApp Chat Skill

## Description
Send and receive WhatsApp messages directly from Claude Code. Use this to communicate with users asynchronously, report progress, or get input without requiring them to be at their computer.

## When to Use This Skill

**Use when:**
- You've **completed a significant task** and want to notify the user
- You need **non-urgent input** that can wait for a response
- You want to **share progress updates** on long-running tasks
- You need a **quick yes/no decision** or simple clarification
- You want to **send files or screenshots** for review
- The user has stepped away and you need to reach them

**Do NOT use for:**
- Complex discussions requiring back-and-forth (use phone call instead)
- Time-sensitive decisions where you can't wait
- Sensitive information (credentials, secrets, etc.)
- Very long messages (keep it concise for mobile)

## Tools

### `send_message`
Send a WhatsApp message to a contact.

**Parameters:**
- `recipient` (string): Phone number (with country code, e.g., "+1234567890") or contact name
- `message` (string): The message to send

**Returns:**
- Confirmation with message ID and timestamp

### `wait_for_reply`
Wait for the user to reply to a previous message.

**Parameters:**
- `chat_id` (string, optional): Specific chat to wait for (defaults to last message recipient)
- `timeout_seconds` (number, optional): How long to wait (default: 300 = 5 minutes)

**Returns:**
- The user's reply message text

### `send_and_wait`
Send a message and wait for the user's reply in one step.

**Parameters:**
- `recipient` (string): Phone number or contact name
- `message` (string): The message to send
- `timeout_seconds` (number, optional): How long to wait for reply (default: 300)

**Returns:**
- The user's reply message text

### `list_chats`
List recent WhatsApp chats.

**Parameters:**
- `limit` (number, optional): Maximum chats to return (default: 20)

**Returns:**
- List of chats with ID, name, last message preview, and timestamp

### `get_messages`
Get recent messages from a specific chat.

**Parameters:**
- `chat_id` (string): The chat ID to get messages from
- `limit` (number, optional): Maximum messages to return (default: 10)

**Returns:**
- List of messages with sender, text, and timestamp

### `get_auth_status`
Check WhatsApp connection status.

**Returns:**
- Connection status (connected/disconnected)
- Phone number if connected
- Last activity timestamp

### `show_qr_code`
Display QR code for WhatsApp authentication (first-time setup).

**Returns:**
- QR code displayed in terminal for scanning

## Example Usage

**Simple notification:**
```
1. send_message: recipient="+1234567890", message="Hey! I finished implementing the auth system. Ready for review when you have a moment."
```

**Getting input:**
```
1. send_and_wait: recipient="+1234567890", message="I'm working on the database schema. Should I use PostgreSQL or MySQL?", timeout_seconds=600
2. User replies: "PostgreSQL"
3. Continue with PostgreSQL implementation
```

**Progress update:**
```
1. send_message: "Starting the migration - this will take a few minutes..."
2. [Perform migration]
3. send_message: "Migration complete! 1,234 records processed successfully."
```

## Best Practices

1. **Keep messages concise** - Users read on mobile, be brief
2. **Include context** - Remind them what you're working on
3. **Offer clear choices** - "Should I do A or B?" not open-ended questions
4. **Set appropriate timeouts** - 5 minutes for quick questions, longer for complex decisions
5. **Don't spam** - Batch updates when possible
6. **Use send_and_wait for decisions** - Don't send a message and forget to wait for the reply
