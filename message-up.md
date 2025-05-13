
# TaskZenith Messaging & Chat - Upgrades Roadmap

This document outlines potential enhancements and advanced features for the messaging and chat system within TaskZenith, aiming to improve communication, collaboration, and user experience.

## 1. Core Messaging Enhancements

These features focus on improving the fundamental chat experience.

*   **Real-time Indicators:**
    *   **Typing Indicators:** Show when another user in a private or group chat is actively typing a message.
    *   **Online/Offline Status:** Display a visual indicator (e.g., a green dot) next to user avatars or names to show if they are currently active in the app.
    *   **Read Receipts:** Provide visual confirmation (e.g., double ticks, seen by avatars) that messages have been read by recipients in private chats and optionally in group chats.
*   **Rich Content & Interaction:**
    *   **Rich Text Formatting:** Allow basic markdown or a simple WYSIWYG editor for bold, italics, strikethrough, inline code, and code blocks in messages.
    *   **Emoji Support:** Native emoji picker and rendering within messages.
    *   **File Attachments:** Ability to securely upload and share images, documents, and other common file types directly in chats. Include previews for images.
    *   **Message Reactions:** Allow users to react to messages with a predefined set of emojis (e.g., 👍, ❤️, 😂, 🎉).
    *   **Message Threads/Replies:** Enable users to reply directly to specific messages, creating threaded conversations for better organization in busy chats.
*   **Chat Management & Usability:**
    *   **Search Within Chats:** Robust search functionality to find past messages within a specific conversation or across all conversations (respecting privacy).
    *   **Notifications:**
        *   **In-App Notifications:** Visual cues for new messages (badges, highlights).
        *   **Push Notifications (Optional):** Browser/Desktop notifications for new messages when the app is not in focus, with user-configurable preferences.
    *   **Mute Conversations:** Allow users to mute notifications for specific chats (private or group) without leaving them.
    *   **Delete Messages:**
        *   Sender can delete their own messages (option for "delete for me" or "delete for everyone" within a time limit).
        *   Admins in group chats might have moderation capabilities.
    *   **User Profiles in Chat:** Clickable user avatars/names to show a mini-profile or link to their main profile page.
    *   **Copy Message Text:** Easy way to copy the text content of a message.
    *   **Timestamp Improvements:** Display timestamps more clearly, perhaps grouping messages by day.

## 2. Group Chat Enhancements

Specific improvements for group conversations.

*   **Group Chat Management (for creators/admins):**
    *   **Add/Remove Members:** Ability for group admins or creators to manage group membership.
    *   **Rename Group Chat:** Allow changing the name of a group chat.
    *   **Set Group Avatar/Icon:** Option to upload a custom image for the group.
    *   **Leave Group:** Allow members to leave a group chat.
    *   **Promote/Demote Admins:** (If implementing roles within groups).
*   **@Mentions:**
    *   Allow users to type `@username` to mention and notify specific users within a group chat.
    *   Highlight mentions for the mentioned user.

## 3. Advanced Messaging & Collaboration Upgrades

More complex features that significantly expand chat capabilities.

*   **Real-time Audio/Video Calls (WebRTC):**
    *   **One-on-One Calls:** Initiate private voice and video calls between two users.
    *   **Group Calls:** Support for multi-party voice and video calls within group chats.
    *   **Basic Call Controls:** Mute/unmute audio, enable/disable video, end call.
*   **Screen Sharing:**
    *   Allow users to share their screen (entire screen, specific application window, or browser tab) during video calls.
*   **Polls Within Chats:**
    *   Ability to create simple polls directly within a chat to quickly gather opinions or make decisions.
*   **Scheduled Messages:**
    *   Allow users to compose a message and schedule it to be sent at a future date/time.
*   **Integration with TaskZenith Tasks:**
    *   **Create Task from Message:** Option to quickly convert a chat message into a new task on a selected board.
    *   **Link Chat to Task:** Associate a chat conversation or specific messages with a task for context.
    *   **Task Update Notifications in Chat:** (Optional) Post automated messages to relevant chats when linked tasks are updated (e.g., completed, due soon).
*   **AI-Powered Chat Assistance (Leveraging Jack):**
    *   **Message Summaries:** Jack could summarize long conversations or unread messages.
    *   **Draft Replies:** Jack could suggest quick replies based on message context (user-initiated).
    *   **Action Item Detection:** Jack could identify potential action items discussed in chat and suggest creating tasks.
*   **End-to-End Encryption (E2EE) for Private Chats:**
    *   Implement E2EE for private one-on-one conversations to ensure maximum privacy, where only the participants can decrypt messages. (This is a significant technical undertaking).
*   **Channel-Based Communication (for larger organizations):**
    *   Similar to Slack/Teams, allow creation of public or private channels within an organization for topic-based discussions, rather than just direct user/group chats. This would be a major structural change.
*   **Message Pinning:**
    *   Allow users in a group (or admins) to pin important messages to the top of the chat for easy reference.
*   **User Status & Presence Customization:**
    *   Beyond online/offline, allow users to set custom statuses (e.g., "In a meeting," "Focusing," "On vacation") with optional automatic clearing.
    *   "Do Not Disturb" mode.
*   **Chatbots & External Service Integrations:**
    *   Framework to allow integrating simple chatbots or notifications from external services (e.g., CI/CD updates, monitoring alerts) into specific chats or channels.
*   **Export Chat History:**
    *   Allow users to export their chat history for a specific conversation (e.g., as a text file or JSON).
*   **Enhanced Accessibility:**
    *   Ensure chat interface is fully keyboard navigable.
    *   ARIA attributes for screen reader compatibility for all chat elements and messages.
    *   Options for adjusting font size or contrast within the chat interface.
*   **"Forward Message" Functionality:**
    *   Ability to forward a message from one chat to another (with clear indication that it's a forwarded message).

These upgrades are designed to make TaskZenith's chat a powerful and integral part of the collaborative workflow, moving beyond simple text messaging to a comprehensive communication hub.
