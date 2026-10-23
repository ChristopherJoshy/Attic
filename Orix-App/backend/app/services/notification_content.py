"""
Orix Notification Content

Professional yet witty notification messages. No emojis.
Multiple variants for each notification type.
"""

import random
from typing import List


def pick(messages: List[str]) -> str:
    """Pick a random message from a list."""
    return random.choice(messages)


# =============================================================================
# MATCHMAKING - While searching for rides
# =============================================================================
MATCHMAKING_SEARCHING = [
    "Looking for your ride crew...",
    "Scanning the campus for fellow travelers.",
    "Checking schedules and routes. Sit tight.",
    "Our algorithm is doing its thing.",
    "Finding people heading your way.",
    "Cross-referencing timings. Almost there.",
    "Searching for your commute companions.",
    "Matching routes and schedules...",
    "Good things take a moment. Still searching.",
    "Working on it. Quality matches incoming.",
    "Sifting through the database. Hold on.",
    "Your future ride buddies are out there somewhere.",
]

MATCHMAKING_STILL_SEARCHING = [
    "Still looking. The perfect match takes time.",
    "Patience. Rome wasn't built in a day, and neither are great ride groups.",
    "No luck yet, but we're persistent like that.",
    "The search continues. We don't give up easily.",
    "Hang tight. Our servers are working overtime for you.",
    "Still on it. These things can't be rushed.",
    "We're thorough. That's why it takes a moment.",
]


# =============================================================================
# MATCH FOUND - When a group is formed
# =============================================================================
MATCH_FOUND_TITLES = [
    "We Found Your People",
    "Match Made",
    "Your Crew Awaits",
    "Group Formed",
    "Success",
]

MATCH_FOUND_BODIES = [
    "Your commute just got company.",
    "Pack your bags. You've got travel buddies.",
    "Looks like you won't be traveling alone.",
    "Your ride group is ready. Check the details.",
    "The stars aligned. Or rather, the routes did.",
]


# =============================================================================
# GROUP CONFIRMED - When all members confirm
# =============================================================================
GROUP_CONFIRMED_TITLES = [
    "All Set",
    "The Gang's All Here",
    "Confirmed",
    "Ready to Roll",
    "It's Official",
]

GROUP_CONFIRMED_BODIES = [
    "Everyone's in. Check your group for details.",
    "All members confirmed. This is happening.",
    "Your ride squad is locked in.",
    "Consider this official. You're all going together.",
    "Confirmation complete. Now just show up on time.",
]


# =============================================================================
# READINESS CONFIRMED - When user confirms readiness
# =============================================================================
READINESS_CONFIRMED_TITLES = [
    "You're In!",
    "Spot Locked",
    "Ready to Ride",
    "Got It",
    "Confirmed",
]

READINESS_CONFIRMED_BODIES = [
    "Your spot is secured. Now we just need the others.",
    "Thanks for confirming. Waiting on the rest of the crew.",
    "One down, {remaining} to go.",
    "You're locked in! Checking on the others.",
    "See you soon!",
]


# =============================================================================
# READINESS REQUEST - Asking user to confirm
# =============================================================================
READINESS_REQUEST_TITLES = [
    "Your Move",
    "Confirm Your Spot",
    "Action Required",
    "Waiting on You",
    "Quick Confirmation Needed",
]

READINESS_REQUEST_BODIES = [
    "Hit confirm to lock in your spot. Clock's ticking.",
    "Your group is waiting. Confirm within {minutes} minutes.",
    "Everyone else is ready. Your turn.",
    "Just one tap to seal the deal. {minutes} minutes left.",
    "The group won't wait forever. Confirm now.",
]


# =============================================================================
# GROUP CANCELLED
# =============================================================================
GROUP_CANCELLED_TITLES = [
    "Ride Cancelled",
    "Plans Changed",
    "Group Dissolved",
]

GROUP_CANCELLED_BODIES = [
    "Unfortunately, this ride isn't happening. Try again?",
    "The group fell through. Better luck next time.",
    "This one didn't work out. Create a new request anytime.",
]


# =============================================================================
# MATCH EXPIRED - No match found in time
# =============================================================================
MATCH_EXPIRED_TITLES = [
    "No Match This Time",
    "Request Expired",
    "Time's Up",
]

MATCH_EXPIRED_BODIES = [
    "We couldn't find anyone. Try different times or routes.",
    "No luck this round. Maybe try again later?",
    "Your request timed out. The search continues when you're ready.",
]


# =============================================================================
# NEW MEMBER JOINED
# =============================================================================
MEMBER_JOINED_TITLES = [
    "New Addition",
    "Someone Joined",
    "Group Update",
]

MEMBER_JOINED_BODIES = [
    "{name} joined your ride group.",
    "Say hello to {name}. They're part of the crew now.",
    "{name} is now in your group.",
]


# =============================================================================
# CHAT MESSAGE
# =============================================================================
CHAT_MESSAGE_TITLES = [
    "New Message",
    "Message from {sender}",
    "{sender} says...",
]


# =============================================================================
# RIDE STARTING SOON
# =============================================================================
RIDE_REMINDER_TITLES = [
    "Heads Up",
    "Ride Soon",
    "Almost Time",
    "Get Ready",
]

RIDE_REMINDER_BODIES = [
    "Your ride starts in {minutes} minutes. Be ready.",
    "T-minus {minutes} minutes. Don't be late.",
    "{minutes} minutes until departure. Just a heads up.",
    "Clock's ticking. Ride in {minutes} minutes.",
    "Quick reminder: {minutes} minutes to go.",
]


# =============================================================================
# GROUP FOUND (after merging/matching)
# =============================================================================
GROUP_FOUND_TITLES = [
    "Group Located",
    "You're Matched",
    "Found One",
]

GROUP_FOUND_BODIES = [
    "You've been added to a ride group.",
    "We found a group heading your way.",
    "Match successful. Check your group.",
]


# =============================================================================
# RIDE COMPLETED - When ride is done and rating needed
# =============================================================================
RIDE_COMPLETED_TITLES = [
    "How Was Your Ride?",
    "Rate Your Ride",
    "Quick Feedback",
    "Share Your Experience",
]

RIDE_COMPLETED_BODIES = [
    "Help other students by rating your ride partners.",
    "Your feedback helps build trust in the community.",
    "Rate your ride buddies and earn points.",
    "Give us 30 seconds to rate your ride group.",
    "How was the experience? Let others know!",
]


# =============================================================================
# ACCOUNT ACTIONS (professional, no jokes)
# =============================================================================
SUSPENSION_TITLE = "Account Suspended"
SUSPENSION_BODY = "Your account has been suspended for {hours} hours. Reason: {reason}"

BAN_TITLE = "Account Permanently Banned"
BAN_BODY = "Your account has been banned. Reason: {reason}"


# =============================================================================
# PROMOTIONS - Witty money-saving quips with funny titles
# =============================================================================
PROMO_TITLES = [
    "Big Brain Move 🧠",
    "Money Hack 💰",
    "Wallet Wisdom 💡",
    "Pro Tip 🎯",
    "Smart Move 📈",
    "Budget Boss 👑",
    "Savings Alert 🔔",
    "Street Smart 🛣️",
    "Quick Math 🧮",
    "Life Hack ⚡",
]

PROMO_VERSES = [
    "Split the fare, not your budget.",
    "Your wallet will thank you later.",
    "More money for coffee, less on commutes.",
    "Saving money is cool. You're cool.",
    "Every shared ride is money in the bank.",
    "College is expensive. Your commute doesn't have to be.",
    "Future you will appreciate present you saving on rides.",
    "Math: Shared ride equals less expense. Simple.",
    "Fun fact: sharing rides leaves more room for fun.",
    "Travel smart. That's it. That's the advice.",
    "The best things in life are shared. Including rides.",
    "Solo rides are so last semester.",
    "Group rides: better for the planet, better for your pocket.",
    "Save now, splurge later. Priorities.",
    "Ride sharing: because broke students stick together.",
]
