#!/bin/bash
# Check for pending WhatsApp messages

PENDING_FILE="$HOME/.whatsapp-bridge/pending_messages.json"

if [ -f "$PENDING_FILE" ]; then
  # Read and check if there are messages
  content=$(cat "$PENDING_FILE" 2>/dev/null)
  if [ -n "$content" ] && [ "$content" != "[]" ]; then
    # Parse and format messages
    echo "URGENT: You have new WhatsApp messages waiting!"
    echo ""
    echo "$content" | jq -r '.[] | "[" + .time + "] " + .sender + ": " + .text' 2>/dev/null || echo "$content"
    echo ""
    echo "Use check_inbox tool to read and respond to them."

    # Clear the file after notifying
    echo "[]" > "$PENDING_FILE"
  fi
fi
