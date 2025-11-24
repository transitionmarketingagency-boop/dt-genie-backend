# Design Guidelines: Marketing Agency Chatbot Widget

## Design Approach
**Reference-Based Approach**: Drawing inspiration from modern chat interfaces like Intercom, Drift, and modern messaging apps, combined with clean marketing aesthetic.

**Justification**: This is a utility-focused chat widget that must feel professional, trustworthy, and non-intrusive while maintaining the futuristic, expert brand voice of Digital Transition Marketing.

---

## Core Design Elements

### A. Typography
- **Primary Font**: Inter or DM Sans (Google Fonts)
- **Chat Messages**: 14px regular weight for readability
- **Widget Header**: 16px semi-bold
- **Button Text**: 14px medium weight
- **User Input**: 14px regular
- **Timestamps**: 11px regular, subtle opacity

### B. Layout System
**Spacing Primitives**: Use Tailwind units of 2, 3, 4, 6, and 8 consistently
- Chat window padding: p-4
- Message bubbles: p-3, mb-2
- Icon button: p-3
- Input field: p-3
- Header: p-4

**Chat Window Dimensions**:
- Width: 380px (desktop), 100% with max 420px (tablet), full-width minus 16px margins (mobile)
- Max height: 600px with scrollable message area
- Positioned: 24px from bottom-right corner

### C. Component Library

**1. Floating Chat Button**
- Size: 60px × 60px circle
- Shadow: Large, soft shadow (0 8px 24px rgba(0,0,0,0.12))
- Icon: Message bubble or chat icon (24px, centered)
- Position: Fixed bottom-right, 24px from edges
- Animation: Subtle pulse effect on initial load (once), gentle scale on hover

**2. Chat Window**
- Border radius: 16px (modern, friendly)
- Shadow: Extra-large elevated shadow (0 16px 48px rgba(0,0,0,0.15))
- Header section: Includes agency name/title, minimize/close button
- Message area: Scrollable, gradient fade at top when scrolled
- Input area: Sticky bottom with send button

**3. Message Bubbles**
- User messages: Align right, rounded corners (16px with 4px on bottom-right)
- AI messages: Align left, rounded corners (16px with 4px on bottom-left)
- Padding: 12px horizontal, 10px vertical
- Max-width: 75% of chat window
- Avatar indicators: Small 28px circle for AI (optional for user)

**4. Input Field**
- Single-line text input with auto-expand on focus
- Rounded corners: 24px (pill-shaped)
- Border: 1px solid with subtle styling
- Send button: Integrated right-side, 36px circle, arrow/send icon
- Placeholder: "Type your message..."

**5. Header Components**
- Agency branding/title on left
- Action buttons on right (minimize, close)
- Online status indicator: Small green dot (6px) with "Online" text
- Divider line below (1px, subtle)

**6. Welcome State**
- Greeting message: Auto-displayed on first open
- Suggested prompts: 2-3 bubble buttons with common questions
- Prompt buttons: Rounded (20px), light styling, hover effect

**7. Typing Indicator**
- Three animated dots in AI message bubble
- Dots: 6px each, subtle bounce animation
- Appears in AI message position

**8. Lead Capture Form** (when triggered)
- Inline form fields within chat flow
- Name input + Email input with labels
- Submit button: Full-width, rounded (12px)
- Validation states with inline error messages

### D. Animations
**Sparingly Applied**:
- Chat window: Slide up + fade in (300ms ease-out) on open
- Chat window: Slide down + fade out (200ms ease-in) on close
- Messages: Subtle fade in + slight slide up (200ms) as they appear
- Typing indicator: Continuous dot bounce (600ms loop)
- Floating button: Single pulse on page load (1200ms, once)
- No hover animations except subtle scale (1.02) on interactive elements

### E. Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation: Tab through inputs, Enter to send
- Focus states: Clear 2px outline offset by 2px
- Screen reader announcements for new messages
- High contrast mode support
- Minimum touch target: 44px for mobile

---

## Widget Embedding Specifications

**Positioning Strategy**:
- Fixed position, z-index: 9999
- Responsive breakpoints: Desktop (>768px), Mobile (≤768px)
- Mobile: Full-width chat window with slight margins
- Collision avoidance: Consider cookie banners (position 100px from bottom if detected)

**Performance**:
- Lazy load chat window (only button loads initially)
- Debounce typing events (300ms)
- Limit message history display (last 50 messages)

**Cross-Site Compatibility**:
- No global CSS pollution (all styles scoped or prefixed)
- Shadow DOM consideration for true isolation (optional)
- Works on light/dark website backgrounds

---

## Brand-Specific Elements

**Digital Transition Marketing Voice**:
- Modern, professional aesthetic
- Subtle futuristic touches (clean lines, smooth animations)
- Trust indicators: "Powered by AI" badge, response time estimate
- No busy or cluttered design - emphasize white space
- Professional sans-serif typography throughout

**Visual Hierarchy**:
1. Chat button (primary attention)
2. Latest AI message (conversation focus)
3. Input field (call-to-action)
4. Historical messages (context)
5. Header/branding (persistent identity)

---

## Images
No images required for this widget. Icon-only design with:
- Chat bubble icon for floating button
- Send/arrow icon for message submission
- Close/minimize icons for window controls
- Small logo/avatar for AI assistant (optional, 28px circle)

All icons from Heroicons (outline style for consistency).