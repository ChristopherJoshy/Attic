"""
Error Humanizer for Orixy AI

Converts technical errors to Orixy-style friendly messages.
"""

import random

ERROR_TEMPLATES = {
    "timeout": [
        "ugh that took forever and still didn't work... either the servers are being dramatic or the database is having a moment",
        "bestie it timed out. the system is moving slower than my motivation on a monday",
        "...it just sat there doing nothing for too long. classic. try again maybe?",
    ],
    "not_found": [
        "looked everywhere, there's nothing. either they don't exist or you spelled something wrong. again.",
        "that doesn't exist. like literally nothing. are you sure you got the right thing?",
        "404 vibes - couldn't find what you're looking for",
    ],
    "permission": [
        "nice try but you're not important enough for that",
        "lmao that's above your pay grade bestie",
        "you need higher clearance for that one chief",
    ],
    "database": [
        "the database is being dramatic rn... try again in a sec",
        "something's wrong with the database. it's always something smh",
        "db error - this is so not my fault btw",
    ],
    "validation": [
        "that input doesn't make sense. gonna need you to try again with actual valid data",
        "bruh the data you gave me is wrong. double check and try again",
        "invalid input - I can't work with this",
    ],
    "rate_limit": [
        "slow down there... you're going too fast and the system can't keep up",
        "rate limited. maybe chill for a sec?",
        "okay you're asking too many things too fast. take a breath",
    ],
    "network": [
        "connection issues... either the internet is being weird or something's down",
        "can't reach the thing I need to reach. network problems probably",
        "connectivity issues - this is out of my control fr",
    ],
    "unknown": [
        "something broke and idk what. that's helpful I know",
        "generic error moment... try again or complain to the devs",
        "bruh it just... didn't work. no idea why",
        "ugh an error happened. typical.",
    ]
}

def humanize_error(error: Exception | str, context: str = "") -> str:
    """Convert a technical error to a friendly Orixy-style message."""
    error_str = str(error).lower()
    
    if "timeout" in error_str or "timed out" in error_str:
        category = "timeout"
    elif "not found" in error_str or "does not exist" in error_str or "404" in error_str:
        category = "not_found"
    elif "permission" in error_str or "forbidden" in error_str or "unauthorized" in error_str:
        category = "permission"
    elif "database" in error_str or "mongo" in error_str or "db" in error_str:
        category = "database"
    elif "invalid" in error_str or "validation" in error_str or "required" in error_str:
        category = "validation"
    elif "rate limit" in error_str or "too many" in error_str:
        category = "rate_limit"
    elif "connection" in error_str or "network" in error_str or "unreachable" in error_str:
        category = "network"
    else:
        category = "unknown"
    
    message = random.choice(ERROR_TEMPLATES[category])
    
    if context:
        message = f"{message} (was trying to: {context})"
    
    return message


def format_tool_error(tool_name: str, error: Exception | str) -> str:
    """Format a tool execution error message."""
    base_msg = humanize_error(error, context=tool_name)
    return f"_sigh_ {base_msg}"


def format_api_error(service: str, error: Exception | str) -> str:
    """Format an API/external service error."""
    return f"the {service} API is having issues rn... {humanize_error(error)}"
