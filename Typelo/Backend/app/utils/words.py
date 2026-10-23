#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Word generation utility - Provides word lists for typing tests.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# generate_word_list: Generates a list of words based on difficulty/mode.
# calculate_text_length: Helper to calculate character count of a word list.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# EASY_WORDS: List of common, short words.
# MEDIUM_WORDS: List of intermediate length/frequency words.
# HARD_WORDS: List of long or complex words.
# PROGRAMMING_WORDS: List of code-related terms.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# random: Random selection.
# typing: Type hints.
# collections.deque: Usage for tracking recently used words.

import random
from typing import List

# Common words sorted by difficulty (length and frequency)
EASY_WORDS = [
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "I",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
    "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
    "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
    "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
    "than", "then", "now", "look", "only", "come", "its", "over", "think", "also"
]

MEDIUM_WORDS = [
    "after", "work", "first", "well", "way", "even", "new", "want", "because", "any",
    "these", "give", "day", "most", "us", "great", "between", "need", "feel", "high",
    "really", "something", "school", "still", "system", "every", "right", "program", "next", "question",
    "during", "play", "government", "small", "number", "again", "world", "area", "course", "company",
    "under", "problem", "hand", "place", "case", "week", "point", "group", "different", "home",
    "country", "away", "moment", "child", "part", "believe", "each", "life", "always", "those",
    "before", "back", "never", "through", "study", "must", "old", "public", "percent", "market",
    "level", "night", "state", "another", "turn", "follow", "social", "whether", "possible", "policy"
]

HARD_WORDS = [
    "government", "president", "important", "something", "different", "business", "everything", "community", "national",
    "information", "question", "experience", "technology", "management", "environment", "international", "education", "organization", "professional",
    "relationship", "performance", "significant", "opportunity", "development", "understanding", "particular", "administration", "responsibility", "communication",
    "especially", "available", "throughout", "individual", "themselves", "production", "commercial", "political", "university", "activities",
    "traditional", "population", "competition", "successful", "additional", "completely", "background", "established", "appropriate", "equipment",
    "perspective", "appreciate", "consequence", "circumstance", "accommodate", "collaborate", "demonstrate", "extraordinary", "sophisticated", "comprehensive"
]

PROGRAMMING_WORDS = [
    "function", "variable", "constant", "return", "class", "object", "method", "string", "integer", "boolean",
    "array", "loop", "while", "import", "export", "async", "await", "promise", "callback", "interface",
    "abstract", "extends", "implements", "static", "public", "private", "protected", "readonly", "generic", "template",
    "module", "package", "library", "framework", "component", "service", "controller", "model", "view", "router",
    "database", "query", "schema", "index", "table", "column", "record", "field", "primary", "foreign",
    "request", "response", "header", "body", "status", "endpoint", "parameter", "argument", "expression", "statement"
]


def generate_word_list(count: int = 50, difficulty: str = "mixed") -> List[str]:
    """
    Generate a list of words for a typing challenge.
    
    Args:
        count: Number of words to generate
        difficulty: "easy", "medium", "hard", "programming", or "mixed"
    
    Returns:
        List of words
    """
    if difficulty == "easy":
        pool = EASY_WORDS
    elif difficulty == "medium":
        pool = MEDIUM_WORDS
    elif difficulty == "hard":
        pool = HARD_WORDS
    elif difficulty == "programming":
        pool = PROGRAMMING_WORDS
    else:
        # Mixed difficulty - weighted distribution
        pool = []
        pool.extend(EASY_WORDS * 3)      # 3x weight for easy
        pool.extend(MEDIUM_WORDS * 2)     # 2x weight for medium
        pool.extend(HARD_WORDS)           # 1x weight for hard
        pool.extend(PROGRAMMING_WORDS)    # 1x weight for programming
    
    # Generate words with some variation
    # Use deque for FIFO ordering (set.pop() removes arbitrary elements)
    from collections import deque
    words = []
    used_recently: deque = deque(maxlen=10)
    
    for i in range(count):
        # Increase difficulty as match progresses
        progress = i / count
        
        if difficulty == "mixed":
            if progress < 0.3:
                # First 30%: mostly easy
                word_pool = EASY_WORDS + MEDIUM_WORDS[:20]
            elif progress < 0.6:
                # 30-60%: medium
                word_pool = MEDIUM_WORDS + HARD_WORDS[:20]
            else:
                # 60-100%: harder
                word_pool = MEDIUM_WORDS[20:] + HARD_WORDS + PROGRAMMING_WORDS[:20]
        else:
            word_pool = pool
        
        # Avoid repeating words too close together
        available = [w for w in word_pool if w not in used_recently]
        if not available:
            available = word_pool
        
        word = random.choice(available)
        words.append(word)
        
        # Track last 10 words to avoid immediate repetition (deque auto-removes oldest)
        used_recently.append(word)
    
    return words


def calculate_text_length(words: List[str]) -> int:
    """Calculate total character count including spaces"""
    return sum(len(w) for w in words) + len(words) - 1
