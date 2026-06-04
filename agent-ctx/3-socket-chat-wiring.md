# Task 3: Wire Socket.IO Real-time Chat to Frontend Chat Screen

## Summary
Wired the existing Zustand chat store WebSocket functions (connectSocket, emitTyping, typingUsers, isSocketConnected) into the chat screen UI components.

## Changes Made

### File: `src/components/ecommerce/chat-screen.tsx`

1. **ChatScreen component** — Added `connectSocket` to the store destructure and a `useEffect` that calls `connectSocket()` on mount, ensuring the WebSocket connection is established when the user navigates to the chat screen.

2. **ChatRoomView component** — Added `emitTyping`, `typingUsers`, `isSocketConnected` to the store destructure.

3. **handleInputChange** — New `useCallback` that updates the message state and emits a typing event (`emitTyping(room.id, value.length > 0)`). Wired to the Input's `onChange` handler instead of the previous direct `setMessage` call.

4. **handleSend** — Updated to call `emitTyping(room.id, false)` after sending a message, signaling that the user has stopped typing.

5. **Typing indicator** — Added animated bouncing dots + "Mengetik..." text before `messagesEndRef` in the messages area. Only visible when OTHER users (not the current user) are typing in the current room.

6. **Socket connection status** — Updated the header "Online" text to dynamically show:
   - Green "Online" when `isSocketConnected` is true
   - Amber "Connecting..." when `isSocketConnected` is false

## Verification
- `bun run lint` passes with 0 errors, 0 warnings
- Dev server running cleanly
