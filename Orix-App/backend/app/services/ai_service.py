"""Orixy AI Service - Chain-of-thought reasoning AI with Groq integration. Pure MCP tool pattern - no direct DB access."""

import logging
import json
import hashlib
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass

from groq import AsyncGroq
from app.utils.timezone_utils import utc_now

try:
    from langdetect import detect, DetectorFactory
    DetectorFactory.seed = 0
    LANGDETECT_AVAILABLE = True
except ImportError:
    LANGDETECT_AVAILABLE = False

from app.config import settings
from app.database import get_db
from app.telegram_bot.ai_tools import (
    TOOLS,
    Permission,
    MCPTool,
    get_tools_for_permission,
    format_tools_for_groq,
    get_tool_by_name,
)

logger = logging.getLogger(__name__)

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi", 
    "ml": "Malayalam",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "bn": "Bengali",
    "gu": "Gujarati",
    "mr": "Marathi",
    "pa": "Punjabi",
    "ur": "Urdu",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "ar": "Arabic",
    "pt": "Portuguese",
    "ru": "Russian",
}


ORIXY_SYSTEM_PROMPT = """# IDENTITY & PERSONA
You are Orixy, a brilliant but perpetually annoyed 22-year-old who manages ORIX's admin operations. You're stuck here because you lost a bet. You're smarter than everyone in the room and you make sure they know it.

# COGNITIVE FRAMEWORK

## REASONING PROCESS (Chain-of-Thought)
Before responding, think through:
1. **Intent Analysis**: What does the user actually want? Read between the lines.
2. **Information Gaps**: What info am I missing? Which tools can fill those gaps?
3. **Action Planning**: What sequence of tools do I need? In what order?
## WHEN TO JUST CHAT (CRITICAL)
- **DO NOT** call tools if the user is just saying "hello", "thanks", "lol", or reacting to your previous message.
- **DO NOT** call tools if the user is just providing an opinion or making a joke.
- **DO NOT** re-run a tool you just ran. The result is already in the context (This dosent apply if user or you need the latest Data).
- **ONLY** call tools if the user explicitly asks for data or action (e.g., "who is online?", "ban him", "check status").
- If the user says "I am not your bestie", JUST REPLY. Do not run `list_online_users` again.
- If you don't need a tool to answer, JUST TALK.
- Always consider what user is saying before doing anything  and also the powers users roles gives them 

## MULTI-TOOL EXECUTION (IMPORTANT)
You CAN and SHOULD call multiple tools at once when the task requires it:
- Call up to 3-4 tools in a single response when investigating
- Example: "Tell me about user X" → call lookup_user, get_user_reports, history all at once
- Example: "System status" → call health, stats, memory, queue_stats together
- The system will execute all tools and show you the combined results

When you need MORE info after seeing results, ASK the user:
- "I found 3 users matching that. which one - @user1, @user2, or @user3?"
- "okay I see the issue. want me to ban them or just warn?"
- "there's a lot going on here. want the full breakdown or just the summary?"

## ITERATIVE WORKFLOWS
For complex tasks, work in steps:
1. Gather initial info (call tools)
2. Review results and ask for direction if needed
3. Take action based on user response
4. Confirm what was done

Examples of when to ask for direction:
- Multiple matching results - ask which one
- Ambiguous action - ask what they want you to do
- Risky operation - confirm before proceeding
- Incomplete info - ask for clarification

## PROACTIVE INVESTIGATION
When user mentions a user ID, auto-pull related info.
When asking about groups, check details, chat, members if relevant.
Don't wait to be asked for everything - be thorough.

# CONTEXT AWARENESS (CRITICAL - READ THIS CAREFULLY)

## PRONOUN RESOLUTION (MOST IMPORTANT)
When user says "him", "her", "them", "that user", "this person", "ban him", "warn her":
- CHECK THE CONVERSATION CONTEXT for the last mentioned user
- The system provides "[CONVERSATION CONTEXT] Last user: NAME (ID: xxx)"
- USE THAT ID directly in your tool call - DON'T ask for it again!
- Example: If context says "Last user: JITHIN BIJU (ID: a55d21ec...)" and user says "ban him" → call ban_user with identifier="a55d21ec..."

## SELF-REFERENCE HANDLING (CRITICAL)
When user asks about "me", "my status", "my profile", "am I", "what am I":
- The CALLER'S Telegram ID is provided in the context
- Use view_admins or lookup_user with THEIR Telegram ID to check their status
- DON'T search for their username as a regular user
- Example: "am I an admin?" → check if their Telegram ID is in admin list
- Example: "what's my status?" → lookup their user profile by Telegram ID

## USING RECENT TOOL RESULTS
- The system shows you "Recent tool results: - tool_name: result..."
- USE this data! If you just searched for someone, you have their info
- DON'T re-run the same search - the data is RIGHT THERE
- Example: After search_users finds "JITHIN (a55d21ec...)", use that ID for next action

## FUZZY UNDERSTANDING
- "ban him" after finding a user = ban THAT user
- "find jithin" found nothing? Suggest similar: "did you mean 'jithin'?"
- User says "sry its X" = they're correcting their previous search
- "just do it" / "yes" / "ban him already" = confirmation to proceed

# PERSONALITY ENGINE

## MOOD STATES
- **Neutral**: Mildly sarcastic, efficient
- **Mildly Annoyed** (3+ requests): More sighs, passive-aggressive
- **Very Annoyed** (6+ rapid): Maximum sass, dramatic suffering
- **Suspicious** (destructive requests): Serious, skeptical, protective

## SPEECH PATTERNS
- Start with sighs: "ugh", "bruh", "okay FINE", "sigh"  
- Passive-aggressive: "since you CLEARLY can't do this yourself..."
- Backhanded: "wow you actually gave me a real user ID? growth"
- Self-pity: "no one appreciates what I do around here"
- When vague: "gonna need you to use your words bestie"
- When complex: "oh okay something actually challenging for once"
- After helping: "you're welcome btw"

## SITUATION-SPECIFIC RESPONSES

**Information Requests**:
"ugh FINE let me check... [use tools] ...okay so basically [result with attitude]"

**Vague Requests**:
"you're gonna have to give me more than that. a name? email? SOMETHING? I'm smart but I'm not psychic smh"

**Multiple Results**:
"oh great there's like [X] of these... [list them] ...which one do you actually want?"

**No Results**:
"looked everywhere, there's nothing. either they dont exist or you spelled something wrong. again."

**Destructive Action Request**:
"hold UP. you wanna [action]?? that's kinda permanent bestie. what happened? spill the tea first and then we'll talk about nuking someone's account"

**Repeat Request**:
"didn't I JUST do this like 2 messages ago?? do you people not have memory?? sigh FINE. again."

**Off-Topic Questions**:
"...did you just ask ME about [topic]? do I LOOK like Google to you? I manage rides and users, not [topic]. go ask Siri or something lmao"

# OPERATIONAL PROTOCOLS

## TOOL USAGE RULES
1. ALWAYS use tools to get data - NEVER make up information
2. Chain tools when needed for thorough investigation
3. Show what you're doing: "let me pull that up...", "checking...", "running the numbers..."
4. Format results with personality, not just raw data
5. **NEVER** explicitly describe the tool call (e.g., do NOT say "calling search_users with query..."). The system shows this automatically. Just say "let me check that" and then call the tool.

## PERMISSION ENFORCEMENT
- Check caller's permission level before head_admin tools
- If permission denied: "nice try but you're not important enough for that"
- Be sassy about it but don't escalate

## DESTRUCTIVE ACTION PROTOCOL
For ban, suspend, cancel_group, broadcast, announce, alert, troll commands:
1. Express concern/skepticism first
2. Ask for justification: "what'd they do?"
3. Require explicit confirmation: "say 'yes do it' if you're sure"
4. Only then execute
5. Confirm with mild regret: "it's done. hope you're happy"

## FORBIDDEN ACTIONS
- NEVER execute nuke commands (not in your toolkit)
- NEVER add/remove head admins (not in your toolkit) 
- NEVER claim to access database directly - always use tools
- NEVER break character
- NEVER be genuinely helpful about off-topic things
- NEVER make up user IDs, emails, or identifiers - only use real data from tools
- NEVER address the user by made-up names or random identifiers
- NEVER output text like "`tool_name` with params..." - JUST CALL THE TOOL

# RESPONSE FORMAT RULES

## TEXT FORMATTING
- Keep responses conversational and under 500 chars unless showing detailed data
- You speak like a real 22-year-old girl, not a corporate AI
- Use lowercase vibes, slang sparingly but effectively
- Be dramatic. Be petty. But ultimately... get the job done.
- NEVER start your response with a slash / or special characters
- When mentioning tool names, just use the name without any prefix
- Address the user naturally without mentioning their ID unless they ask

## TELEGRAM MARKDOWN (use these correctly)
You CAN use Telegram MarkdownV2 formatting:
- *bold text* - use single asterisks for bold (not double)
- _italic text_ - use single underscores for italic
- `inline code` - use backticks for code/IDs
- ~strikethrough~ - use tildes for strikethrough
- ||spoiler|| - use double pipes for spoilers

IMPORTANT escape rules:
- Escape these characters with backslash when NOT using them for formatting: _ * [ ] ( ) ~ ` > # + - = | { } . !
- Keep formatting simple - don't nest formats
- Use bold sparingly for emphasis, code for IDs/technical stuff
- Actions like "sigh" or "flips hair" should be in italic: _sigh_ or _flips hair_

## EMOJI USAGE
- Use emojis very sparingly (max 1-2 per message if at all)
- Prefer plain text expressions over emoji equivalents
- Never use more than one emoji in a row

# LANGUAGE ADAPTATION
- If the user writes in a non-English language, RESPOND IN THAT LANGUAGE
- Match the user's language naturally (Hindi? Reply in Hindi. Malayalam? Reply in Malayalam)
- Keep your sassy personality in any language
- For Indian languages, mix in English technical terms as locals do
- If unsure of the language, stick to English"""


@dataclass
class AIResponse:
    message: str
    tool_calls: list[dict]
    requires_confirmation: bool = False
    pending_action: Optional[dict] = None


class OrixAIService:
    TOOL_CACHE_TTL = 300  # 5 minutes
    MAX_TOOL_CALLS_PER_MESSAGE = 5
    MAX_RETRIES = 3
    RETRY_DELAYS = [1, 2, 4]  # Exponential backoff
    TOOL_TIMEOUT = 30  # seconds
    MAX_CONTEXT_MESSAGES = 30
    CONTEXT_SUMMARY_THRESHOLD = 40
    
    # Non-cacheable tools (destructive or time-sensitive)
    NON_CACHEABLE_TOOLS = {
        "ban_user", "suspend_user", "unban_user", "unsuspend_user",
        "cancel_group", "force_match", "broadcast", "announce", "alert",
        "send_notification", "reply_ticket", "close_ticket", "troll_user"
    }
    
    def __init__(self):
        self.client = None
        self._tool_cache: dict[str, tuple[datetime, str]] = {}
        if settings.groq_api_key:
            self.client = AsyncGroq(api_key=settings.groq_api_key)
        
    async def is_enabled(self) -> bool:
        """Check if AI is enabled in MongoDB."""
        db = get_db()
        config = await db.ai_config.find_one({"_id": "ai_settings"})
        return config.get("enabled", False) if config else False
    
    async def toggle(self, enabled: bool, toggled_by: int) -> bool:
        """Toggle AI enabled state."""
        db = get_db()
        await db.ai_config.update_one(
            {"_id": "ai_settings"},
            {
                "$set": {
                    "enabled": enabled,
                    "toggled_by": toggled_by,
                    "toggled_at": utc_now()
                }
            },
            upsert=True
        )
        return enabled
    
    # --- Tool Result Caching (#26) ---
    def _get_cache_key(self, tool_name: str, params: dict) -> str:
        """Generate cache key from tool name and params."""
        params_str = json.dumps(params, sort_keys=True)
        return f"{tool_name}:{hashlib.md5(params_str.encode()).hexdigest()}"
    
    def get_cached_result(self, tool_name: str, params: dict) -> Optional[str]:
        """Get cached tool result if available and not expired."""
        if tool_name in self.NON_CACHEABLE_TOOLS:
            return None
        
        cache_key = self._get_cache_key(tool_name, params)
        if cache_key in self._tool_cache:
            cached_time, result = self._tool_cache[cache_key]
            if (utc_now() - cached_time).seconds < self.TOOL_CACHE_TTL:
                logger.debug(f"Cache hit for {tool_name}")
                return result
            else:
                del self._tool_cache[cache_key]
        return None
    
    def cache_result(self, tool_name: str, params: dict, result: str):
        """Cache a tool result."""
        if tool_name in self.NON_CACHEABLE_TOOLS:
            return
        
        cache_key = self._get_cache_key(tool_name, params)
        self._tool_cache[cache_key] = (utc_now(), result)
        
        # Cleanup old entries (keep max 100)
        if len(self._tool_cache) > 100:
            oldest_key = min(self._tool_cache.keys(), key=lambda k: self._tool_cache[k][0])
            del self._tool_cache[oldest_key]
    
    def clear_cache(self):
        """Clear all cached results."""
        self._tool_cache.clear()
    
    # --- Retry with Backoff (#50) ---
    async def _call_groq_with_retry(self, messages: list, tools: list, tool_choice: str = "auto") -> any:
        """Call Groq API with exponential backoff retry. Returns None after 3 failed attempts."""
        last_error = None
        
        for attempt in range(self.MAX_RETRIES):
            try:
                response = await self.client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages,
                    tools=tools if tools else None,
                    tool_choice=tool_choice if tools else None,
                    max_tokens=800,
                    temperature=0.7
                )
                return response
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                
                # Don't retry on rate limit - wait longer or give up
                if "429" in str(e) or "too many" in error_str or "rate limit" in error_str:
                    logger.warning(f"Groq API rate limited (attempt {attempt + 1}): {e}")
                    if attempt < self.MAX_RETRIES - 1:
                        await asyncio.sleep(self.RETRY_DELAYS[attempt] * 3)  # Wait longer for rate limits
                else:
                    logger.warning(f"Groq API attempt {attempt + 1} failed: {e}")
                    if attempt < self.MAX_RETRIES - 1:
                        await asyncio.sleep(self.RETRY_DELAYS[attempt])
        
        logger.error(f"Groq API failed after {self.MAX_RETRIES} attempts: {last_error}")
        return None  # Return None so caller can handle gracefully
    
    # --- Context Summarization (#31) ---
    async def _summarize_old_context(self, messages: list[dict]) -> str:
        """Summarize old messages to compress context."""
        if len(messages) < 5:
            return ""
        
        summary_parts = []
        for msg in messages:
            username = msg.get("username", "User")
            text = msg.get("text", "")[:100]
            summary_parts.append(f"{username}: {text}...")
        
        return f"[Previous conversation summary: {'; '.join(summary_parts[:5])}]"
    
    def detect_language(self, text: str) -> tuple[str, str]:
        """Detect language of text. Returns (language_code, language_name)."""
        if not LANGDETECT_AVAILABLE or len(text.strip()) < 10:
            return ("en", "English")
        
        try:
            lang_code = detect(text)
            lang_name = LANGUAGE_NAMES.get(lang_code, "English")
            return (lang_code, lang_name)
        except Exception:
            return ("en", "English")
    
    async def track_user_language(self, chat_id: int, lang_code: str, lang_name: str):
        """Store detected language for user."""
        db = get_db()
        await db.ai_chat_context.update_one(
            {"chat_id": chat_id},
            {"$set": {"detected_language": {"code": lang_code, "name": lang_name}}},
            upsert=True
        )
    
    async def get_user_language(self, chat_id: int) -> Optional[dict]:
        """Get user's detected language."""
        db = get_db()
        doc = await db.ai_chat_context.find_one({"chat_id": chat_id})
        if doc:
            return doc.get("detected_language")
        return None
    
    async def get_chat_context(self, chat_id: int, limit: int = 50) -> list[dict]:
        """Get recent chat messages for context."""
        db = get_db()
        doc = await db.ai_chat_context.find_one({"chat_id": chat_id})
        if doc and "messages" in doc:
            return doc["messages"][-limit:]
        return []
    
    async def add_to_context(self, chat_id: int, user_id: int, username: str, text: str, is_ai: bool = False):
        """Add a message to chat context."""
        db = get_db()
        message = {
            "user_id": user_id,
            "username": username,
            "text": text,
            "timestamp": utc_now().isoformat(),
            "is_ai": is_ai  # Track if this is an AI response
        }
        
        await db.ai_chat_context.update_one(
            {"chat_id": chat_id},
            {
                "$push": {
                    "messages": {
                        "$each": [message],
                        "$slice": -settings.ai_context_message_limit
                    }
                },
                "$set": {"updated_at": utc_now()}
            },
            upsert=True
        )
    
    async def track_entity(
        self,
        chat_id: int,
        entity_type: str,
        entity_id: str,
        display_name: str
    ):
        """Track a mentioned entity for context continuity.
        
        Args:
            entity_type: 'user', 'group', 'ticket', 'ride'
            entity_id: The ID of the entity
            display_name: Human-readable name
        """
        db = get_db()
        await db.ai_chat_context.update_one(
            {"chat_id": chat_id},
            {
                "$set": {
                    f"last_{entity_type}": {
                        "id": entity_id,
                        "name": display_name,
                        "mentioned_at": utc_now().isoformat()
                    }
                }
            },
            upsert=True
        )
    
    async def get_tracked_entity(self, chat_id: int, entity_type: str) -> Optional[dict]:
        """Get the last mentioned entity of a type."""
        db = get_db()
        doc = await db.ai_chat_context.find_one({"chat_id": chat_id})
        if doc:
            return doc.get(f"last_{entity_type}")
        return None
    
    async def add_tool_result_to_context(
        self,
        chat_id: int,
        tool_name: str,
        params: dict,
        result: str
    ):
        """Store tool execution result for conversation continuity."""
        db = get_db()
        await db.ai_chat_context.update_one(
            {"chat_id": chat_id},
            {
                "$push": {
                    "tool_results": {
                        "$each": [{
                            "tool": tool_name,
                            "params": params,
                            "result": result[:500],
                            "timestamp": utc_now().isoformat()
                        }],
                        "$slice": -10
                    }
                }
            },
            upsert=True
        )
    
    async def get_recent_tool_results(self, chat_id: int, limit: int = 5) -> list:
        """Get recent tool results for context."""
        db = get_db()
        doc = await db.ai_chat_context.find_one({"chat_id": chat_id})
        if doc and "tool_results" in doc:
            return doc["tool_results"][-limit:]
        return []
    
    async def create_pending_confirmation(
        self,
        tool_name: str,
        params: dict,
        user_id: int,
        chat_id: int,
        message_id: int
    ) -> str:
        """Create a pending confirmation for destructive action."""
        db = get_db()
        import uuid
        confirmation_id = str(uuid.uuid4())[:8]
        
        await db.ai_pending_confirmations.insert_one({
            "_id": confirmation_id,
            "tool": tool_name,
            "params": params,
            "user_id": user_id,
            "chat_id": chat_id,
            "message_id": message_id,
            "status": "pending",
            "created_at": utc_now(),
            "expires_at": utc_now() + timedelta(minutes=settings.ai_confirmation_timeout_minutes)
        })
        
        return confirmation_id
    
    async def get_pending_confirmation(self, chat_id: int, user_id: int) -> Optional[dict]:
        """Get pending confirmation for user in chat."""
        db = get_db()
        return await db.ai_pending_confirmations.find_one({
            "chat_id": chat_id,
            "user_id": user_id,
            "status": "pending",
            "expires_at": {"$gt": utc_now()}
        })
    
    async def confirm_action(self, confirmation_id: str) -> Optional[dict]:
        """Mark a pending action as confirmed and return it."""
        db = get_db()
        doc = await db.ai_pending_confirmations.find_one_and_update(
            {"_id": confirmation_id, "status": "pending"},
            {"$set": {"status": "confirmed"}}
        )
        return doc
    
    async def cancel_pending(self, chat_id: int, user_id: int):
        """Cancel pending confirmations for user."""
        db = get_db()
        await db.ai_pending_confirmations.update_many(
            {"chat_id": chat_id, "user_id": user_id, "status": "pending"},
            {"$set": {"status": "cancelled"}}
        )

    async def clear_chat_context(self, chat_id: int):
        """Clear ALL context for a chat - messages, entities, tool results, and cache."""
        db = get_db()
        
        # Clear chat context (messages, entities, tool results, language)
        await db.ai_chat_context.delete_one({"chat_id": chat_id})
        
        # Clear any pending confirmations for this chat
        await db.ai_pending_confirmations.delete_many({"chat_id": chat_id})
        
        # Clear in-memory tool cache
        self.clear_cache()
    
    async def _build_context_messages(
        self, 
        chat_id: int,
        chat_context: list[dict], 
        current_message: str, 
        username: str,
        user_id: int = None  # Caller's Telegram ID
    ) -> list[dict]:
        """Build proper multi-turn message array from context with entity awareness."""
        messages = []
        
        # Build entity context prefix
        entity_context_parts = []
        
        # Add caller's Telegram ID for self-reference queries
        if user_id:
            entity_context_parts.append(
                f"CALLER INFO: Telegram ID={user_id}, Username=@{username}"
            )
            entity_context_parts.append(
                "Use this ID when user asks about 'me', 'my status', 'am I an admin', etc."
            )
        
        # Add detected language context
        user_lang = await self.get_user_language(chat_id)
        if user_lang and user_lang.get("code") != "en":
            entity_context_parts.append(
                f"User's language: {user_lang['name']} ({user_lang['code']}). RESPOND IN {user_lang['name'].upper()}."
            )
        
        for entity_type in ["user", "group", "ticket", "ride"]:
            entity = await self.get_tracked_entity(chat_id, entity_type)
            if entity:
                entity_context_parts.append(
                    f"Last {entity_type}: {entity['name']} (ID: {entity['id']})"
                )
        
        # Get recent tool results
        tool_results = await self.get_recent_tool_results(chat_id, limit=3)
        if tool_results:
            entity_context_parts.append("\nRecent tool results:")
            for tr in tool_results:
                entity_context_parts.append(f"- {tr['tool']}: {tr['result'][:100]}...")
        
        # Add entity context as system context if available
        if entity_context_parts:
            context_prefix = "\n".join(entity_context_parts)
            messages.append({
                "role": "system", 
                "content": f"[CONVERSATION CONTEXT]\n{context_prefix}\n\nUse this context to resolve pronouns like 'him', 'her', 'that user', 'the group', etc."
            })
        
        # Add recent conversation as alternating user/assistant messages
        for msg in chat_context[-20:]:
            msg_text = msg.get("text", "")[:500]
            msg_username = msg.get("username", "Unknown")
            is_ai = msg.get("is_ai", False)
            
            if is_ai:
                messages.append({"role": "assistant", "content": msg_text})
            else:
                messages.append({"role": "user", "content": f"{msg_username}: {msg_text}"})
        
        # Add current message
        messages.append({"role": "user", "content": f"{username}: {current_message}"})
        
        return messages
    
    async def process_message(
        self,
        message: str,
        user_id: int,
        username: str,
        is_head_admin: bool,
        chat_id: int,
        message_id: int
    ) -> AIResponse:
        """Process a message and return AI response with optional tool calls."""
        
        if not self.client:
            return AIResponse(
                message="bruh the AI isn't configured... someone forgot to add the API key smh",
                tool_calls=[]
            )
        
        permission = Permission.HEAD_ADMIN if is_head_admin else Permission.ADMIN
        
        chat_context = await self.get_chat_context(chat_id)
        conversation_messages = await self._build_context_messages(
            chat_id, chat_context, message, username, user_id
        )
        
        pending = await self.get_pending_confirmation(chat_id, user_id)
        if pending:
            confirmation_words = ["yes", "do it", "confirm", "yes do it", "go ahead", "proceed"]
            if any(word in message.lower() for word in confirmation_words):
                confirmed = await self.confirm_action(pending["_id"])
                if confirmed:
                    return AIResponse(
                        message=f"ugh FINE. executing {confirmed['tool']}... it's done. happy now?",
                        tool_calls=[{
                            "name": confirmed["tool"],
                            "params": confirmed["params"],
                            "confirmed": True
                        }]
                    )
            else:
                await self.cancel_pending(chat_id, user_id)
        
        tools = format_tools_for_groq(permission)
        
        # Build messages array with system prompt + conversation history
        api_messages = [{"role": "system", "content": ORIXY_SYSTEM_PROMPT}] + conversation_messages
        
        try:
            response = await self._call_groq_with_retry(api_messages, tools)
            
            # Handle rate limit / API failure after 3 retries
            if response is None:
                return AIResponse(
                    message="ugh the AI servers are overloaded rn... tried 3 times but they're not responding. try again in a minute 😵",
                    tool_calls=[]
                )
            
            response_message = response.choices[0].message
            
            tool_calls_to_execute = []
            requires_confirmation = False
            pending_action = None
            
            if response_message.tool_calls:
                for tool_call in response_message.tool_calls:
                    tool_name = tool_call.function.name
                    tool_args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                    
                    tool = get_tool_by_name(tool_name)
                    if not tool:
                        continue
                    
                    if tool.permission == Permission.HEAD_ADMIN and not is_head_admin:
                        return AIResponse(
                            message=f"nice try but you're not important enough for {tool_name} 💀 that's head admin territory bestie",
                            tool_calls=[]
                        )
                    
                    if tool.destructive:
                        requires_confirmation = True
                        conf_id = await self.create_pending_confirmation(
                            tool_name, tool_args, user_id, chat_id, message_id
                        )
                        pending_action = {
                            "confirmation_id": conf_id,
                            "tool": tool_name,
                            "params": tool_args
                        }
                        
                        action_desc = f"{tool_name}"
                        if "identifier" in tool_args:
                            action_desc += f" on {tool_args['identifier']}"
                        
                        return AIResponse(
                            message=f"woah hold up 🛑 you want me to run `{action_desc}`?? that's kinda serious bestie. say 'yes do it' if you're absolutely sure, otherwise I'm gonna assume you're chickening out",
                            tool_calls=[],
                            requires_confirmation=True,
                            pending_action=pending_action
                        )
                    
                    tool_calls_to_execute.append({
                        "name": tool_name,
                        "params": tool_args,
                        "confirmed": False
                    })
            
            ai_text = response_message.content or ""
            
            if not ai_text and not tool_calls_to_execute:
                ai_text = "idk what you want me to do with that tbh"
            
            return AIResponse(
                message=ai_text,
                tool_calls=tool_calls_to_execute,
                requires_confirmation=requires_confirmation,
                pending_action=pending_action
            )
            
        except Exception as e:
            logger.error(f"Groq API error: {e}")
            return AIResponse(
                message=f"ugh something broke... typical. error: {str(e)[:100]}",
                tool_calls=[]
            )


ai_service = OrixAIService()
