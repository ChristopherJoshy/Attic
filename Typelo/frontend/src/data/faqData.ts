/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * FAQ Data - Comprehensive 100+ Q&A for SEO and user information.
 * Used by FAQ page for both display and FAQPage JSON-LD schema.
 */

export interface FAQItem {
    question: string
    answer: string
    category: string
}

export const faqData: FAQItem[] = [
    // ============= GETTING STARTED (10) =============
    {
        category: "Getting Started",
        question: "What is Typelo?",
        answer: "Typelo is a real-time 1v1 competitive typing game where players compete head-to-head in typing races. The fastest and most accurate typist wins, with an ELO-based ranking system matching players of similar skill levels."
    },
    {
        category: "Getting Started",
        question: "How do I create a Typelo account?",
        answer: "Click the Sign In button on the homepage and authenticate with your Google account. Account creation is instant and free, requiring no additional registration steps."
    },
    {
        category: "Getting Started",
        question: "Is Typelo free to play?",
        answer: "Yes, Typelo is completely free. There are no paywalls, subscription fees, or pay-to-win mechanics. All core gameplay features are accessible to every player."
    },
    {
        category: "Getting Started",
        question: "What do I need to play Typelo?",
        answer: "You need a modern web browser (Chrome, Firefox, Safari, or Edge), a keyboard, and an internet connection. No downloads or installations are required."
    },
    {
        category: "Getting Started",
        question: "Can I play Typelo on mobile devices?",
        answer: "Yes, Typelo is fully responsive and works on mobile devices and tablets. However, for the best competitive experience, a physical keyboard is recommended."
    },
    {
        category: "Getting Started",
        question: "How do I start my first match?",
        answer: "After signing in, click the PLAY button on the dashboard. You will be matched with an opponent of similar skill level within seconds."
    },
    {
        category: "Getting Started",
        question: "What is the recommended browser for Typelo?",
        answer: "Chrome and Firefox provide the best experience. Both browsers fully support all Typelo features and offer optimal performance for real-time gameplay."
    },
    {
        category: "Getting Started",
        question: "Do I need to verify my email to play?",
        answer: "No email verification is required. When you sign in with Google, your account is ready immediately. You can start playing within seconds of your first visit."
    },
    {
        category: "Getting Started",
        question: "Can I play Typelo offline?",
        answer: "No, Typelo requires an internet connection for matchmaking and real-time gameplay. The game communicates with servers to ensure fair, synchronized matches."
    },
    {
        category: "Getting Started",
        question: "Is there a tutorial for new players?",
        answer: "Typelo uses intuitive gameplay that requires no tutorial. Simply type the words shown on screen as quickly and accurately as possible. Training mode is available for practice."
    },

    // ============= GAMEPLAY MECHANICS (15) =============
    {
        category: "Gameplay",
        question: "How does a Typelo match work?",
        answer: "Both players see the same text and race to type it correctly. Progress is shown in real-time. The player who finishes first or has more correct characters when time expires wins."
    },
    {
        category: "Gameplay",
        question: "What happens if I make a typing mistake?",
        answer: "Mistakes are highlighted in red. You can continue typing, but errors affect your accuracy score. High accuracy improves your overall performance rating."
    },
    {
        category: "Gameplay",
        question: "How long does a typical match last?",
        answer: "Most matches last between 30 seconds and 2 minutes, depending on the text length and players' typing speeds. Matches are designed to be quick and exciting."
    },
    {
        category: "Gameplay",
        question: "What is WPM in Typelo?",
        answer: "WPM stands for Words Per Minute, the standard measure of typing speed. Typelo calculates your WPM based on correct characters typed divided by time elapsed."
    },
    {
        category: "Gameplay",
        question: "How is accuracy calculated?",
        answer: "Accuracy is the percentage of correctly typed characters compared to total keystrokes. A 95% accuracy means 95 out of every 100 keystrokes were correct."
    },
    {
        category: "Gameplay",
        question: "Can I see my opponent's progress during a match?",
        answer: "Yes, you can see your opponent's cursor position and progress in real-time. This adds competitive pressure and strategic awareness to each match."
    },
    {
        category: "Gameplay",
        question: "What types of text are used in matches?",
        answer: "Typelo uses common English words and phrases. The text is randomly generated for each match to ensure fair competition and prevent memorization."
    },
    {
        category: "Gameplay",
        question: "Is there a countdown before matches start?",
        answer: "Yes, both players see a brief countdown timer before the match begins. This ensures both players start at exactly the same moment for fair competition."
    },
    {
        category: "Gameplay",
        question: "What happens if my opponent disconnects?",
        answer: "If an opponent disconnects during a match, you are awarded the win. The match result is recorded and your ELO is adjusted accordingly."
    },
    {
        category: "Gameplay",
        question: "Can I pause a match?",
        answer: "No, matches cannot be paused. This ensures fair competition and prevents players from gaining unfair advantages through deliberate delays."
    },
    {
        category: "Gameplay",
        question: "How do I know when I win?",
        answer: "The results screen shows immediately after a match ends. You will see your final WPM, accuracy, ELO change, and whether you won or lost."
    },
    {
        category: "Gameplay",
        question: "What is the maximum WPM possible?",
        answer: "There is no artificial limit. Professional typists can exceed 150 WPM. The system accurately tracks and displays any typing speed achieved."
    },
    {
        category: "Gameplay",
        question: "Does capitalization matter in matches?",
        answer: "Yes, you must match the exact capitalization shown in the text. Incorrect capitalization counts as an error and affects your accuracy score."
    },
    {
        category: "Gameplay",
        question: "Are special characters included in match text?",
        answer: "Match text primarily uses letters, numbers, and common punctuation. Special characters are rare to keep gameplay accessible across all keyboard layouts."
    },
    {
        category: "Gameplay",
        question: "Can I use keyboard shortcuts during matches?",
        answer: "Standard typing is required. Keyboard shortcuts like copy-paste are disabled during matches to ensure fair competition based on actual typing skill."
    },

    // ============= RANKING & ELO (15) =============
    {
        category: "Ranking",
        question: "How does Typelo ranking work?",
        answer: "Typelo uses an ELO-based system similar to chess. Win against higher-ranked opponents to gain more points. Lose to lower-ranked players to lose more points."
    },
    {
        category: "Ranking",
        question: "What is ELO?",
        answer: "ELO is a skill rating system originally designed for chess. In Typelo, it measures your competitive typing ability and determines your matchmaking."
    },
    {
        category: "Ranking",
        question: "What is my starting ELO?",
        answer: "New players start with 1000 ELO. This provides a baseline for the matchmaking system to calibrate your true skill level over your first matches."
    },
    {
        category: "Ranking",
        question: "How much ELO do I gain per win?",
        answer: "ELO gains depend on opponent strength. Beating a higher-rated player yields more points. Typical gains range from 10 to 30 ELO per match."
    },
    {
        category: "Ranking",
        question: "Can I lose ELO in training mode?",
        answer: "No, training mode matches do not affect your ELO. Training is specifically designed for practice without competitive consequences."
    },
    {
        category: "Ranking",
        question: "What are the rank tiers in Typelo?",
        answer: "Typelo features multiple rank tiers from Unranked through Bronze, Silver, Gold, Platinum, and higher. Each tier represents a range of ELO values."
    },
    {
        category: "Ranking",
        question: "How do I rank up?",
        answer: "Win matches to increase your ELO. When your ELO crosses a tier threshold, you automatically advance to the next rank tier."
    },
    {
        category: "Ranking",
        question: "Can I be demoted to a lower rank?",
        answer: "Yes, if your ELO falls below your current tier threshold, you will be demoted. There is typically a small buffer to prevent rapid rank oscillation."
    },
    {
        category: "Ranking",
        question: "Is there a leaderboard?",
        answer: "Yes, Typelo features a global leaderboard showing top players by ELO. You can view rankings and see where you stand among all players."
    },
    {
        category: "Ranking",
        question: "How often is the leaderboard updated?",
        answer: "The leaderboard updates in real-time. Your position changes immediately after each ranked match you complete."
    },
    {
        category: "Ranking",
        question: "Does match speed affect ELO gain?",
        answer: "No, only win/loss outcome determines ELO change. Whether you win by a large or small margin, the ELO adjustment is the same."
    },
    {
        category: "Ranking",
        question: "What happens to my rank if I stop playing?",
        answer: "Your ELO and rank are preserved. There is no decay for inactivity. Return anytime and continue from where you left off."
    },
    {
        category: "Ranking",
        question: "Can I see my opponent's rank before a match?",
        answer: "You see your opponent's display name and can view their profile after the match. During matchmaking, you are paired with similarly skilled players."
    },
    {
        category: "Ranking",
        question: "Is there a ranked season system?",
        answer: "Currently, Typelo uses a continuous ranking system without seasons. Your ELO represents your all-time competitive standing."
    },
    {
        category: "Ranking",
        question: "How do I check my match history?",
        answer: "Access your match history through your profile on the dashboard. View past matches, opponents, WPM, accuracy, and ELO changes."
    },

    // ============= FRIENDS & SOCIAL (10) =============
    {
        category: "Friends",
        question: "Can I play Typelo with friends?",
        answer: "Yes, Friends Mode lets you compete directly with friends. Add friends through the app and challenge them to casual matches that do not affect ELO."
    },
    {
        category: "Friends",
        question: "How do I add friends on Typelo?",
        answer: "Open the Friends menu from the dashboard. You can send friend requests using their username or share your invite link directly."
    },
    {
        category: "Friends",
        question: "Do friend matches affect my ranking?",
        answer: "No, matches in Friends Mode are casual and do not impact your ELO or competitive rank. They are purely for fun and practice."
    },
    {
        category: "Friends",
        question: "How many friends can I add?",
        answer: "There is no limit on the number of friends you can add. Build your network and enjoy competitive matches with as many friends as you like."
    },
    {
        category: "Friends",
        question: "Can I see when my friends are online?",
        answer: "Yes, the friends list shows online status. You can see which friends are currently available for matches."
    },
    {
        category: "Friends",
        question: "How do I remove a friend?",
        answer: "Open the Friends menu, find the friend you want to remove, and select the remove option. This action is reversible by sending a new request."
    },
    {
        category: "Friends",
        question: "Can I block other players?",
        answer: "Currently, the block feature is not available. If you experience issues with another player, avoid accepting their friend requests."
    },
    {
        category: "Friends",
        question: "Is there voice chat during friend matches?",
        answer: "No, Typelo does not include voice chat. Use external communication apps like Discord if you want to talk during matches."
    },
    {
        category: "Friends",
        question: "Can spectators watch friend matches?",
        answer: "Spectator mode is not currently available. Only the two matched players can participate in and view the match."
    },
    {
        category: "Friends",
        question: "How do referral rewards work?",
        answer: "Share your referral link with friends. When they sign up and complete matches, both of you receive coin bonuses as rewards."
    },

    // ============= TECHNICAL & PLATFORM (10) =============
    {
        category: "Technical",
        question: "What platforms does Typelo support?",
        answer: "Typelo works on any device with a modern web browser. It is fully responsive for desktop, laptop, tablet, and mobile. A PWA version is available for installation."
    },
    {
        category: "Technical",
        question: "What is the PWA version of Typelo?",
        answer: "The Progressive Web App allows you to install Typelo on your device for app-like access. It works offline-capable for some features and provides faster load times."
    },
    {
        category: "Technical",
        question: "How do I install the Typelo PWA?",
        answer: "In your browser, look for an install option in the address bar or menu. On mobile, use Add to Home Screen. The app will appear like a native application."
    },
    {
        category: "Technical",
        question: "Does Typelo work on Chromebook?",
        answer: "Yes, Typelo works perfectly on Chromebooks through the Chrome browser. All features are fully supported on Chrome OS."
    },
    {
        category: "Technical",
        question: "Is there a Typelo desktop app?",
        answer: "The PWA serves as the desktop app. Install it through your browser for a dedicated window experience without browser UI elements."
    },
    {
        category: "Technical",
        question: "Does Typelo require Flash or Java?",
        answer: "No, Typelo uses modern web technologies only. No plugins, Flash, Java, or additional software installations are needed."
    },
    {
        category: "Technical",
        question: "What internet speed is required?",
        answer: "Any broadband connection is sufficient. Typelo uses minimal bandwidth for real-time updates, typically under 100KB per match."
    },
    {
        category: "Technical",
        question: "Is my data encrypted?",
        answer: "Yes, all connections use HTTPS encryption. Your gameplay data and account information are transmitted securely."
    },
    {
        category: "Technical",
        question: "Does Typelo use cookies?",
        answer: "Typelo uses essential cookies for authentication and session management. No third-party advertising cookies are used."
    },
    {
        category: "Technical",
        question: "Is Typelo open source?",
        answer: "The Typelo codebase is maintained privately. The game is developed by chris and hosted on modern cloud infrastructure."
    },

    // ============= ACCOUNT & SETTINGS (10) =============
    {
        category: "Account",
        question: "How do I change my display name?",
        answer: "Your display name is taken from your Google account. To change it, update your Google account profile name and it will reflect in Typelo."
    },
    {
        category: "Account",
        question: "Can I link multiple accounts?",
        answer: "Currently, each Google account creates a separate Typelo account. There is no option to merge or link multiple accounts."
    },
    {
        category: "Account",
        question: "How do I delete my account?",
        answer: "To request account deletion, contact support through the provided channels. Your data will be permanently removed upon request."
    },
    {
        category: "Account",
        question: "Can I hide my profile from others?",
        answer: "Profile privacy options are currently limited. Your username and rank are visible on leaderboards if you place highly."
    },
    {
        category: "Account",
        question: "What data does Typelo store?",
        answer: "Typelo stores your account ID, match history, ELO, friends list, and cosmetic inventory. No sensitive personal data beyond Google profile info is stored."
    },
    {
        category: "Account",
        question: "How do I sign out of Typelo?",
        answer: "Click your profile icon in the navigation area and select Sign Out. You will be returned to the login screen."
    },
    {
        category: "Account",
        question: "Can I transfer my progress to another account?",
        answer: "Account progress cannot be transferred between Google accounts. Your ELO, match history, and items are tied to your original account."
    },
    {
        category: "Account",
        question: "Is two-factor authentication available?",
        answer: "Typelo relies on Google Sign-In security. Enable 2FA on your Google account for additional protection when accessing Typelo."
    },
    {
        category: "Account",
        question: "What happens if I lose access to my Google account?",
        answer: "Your Typelo account is linked to your Google account. Recover your Google account through Google's recovery process to regain Typelo access."
    },
    {
        category: "Account",
        question: "Can I use Typelo on multiple devices?",
        answer: "Yes, sign in with the same Google account on any device. Your progress, ELO, and inventory sync automatically across all devices."
    },

    // ============= PERFORMANCE TIPS (15) =============
    {
        category: "Performance",
        question: "How can I improve my typing speed?",
        answer: "Practice regularly in Training Mode. Focus on accuracy first, then gradually increase speed. Consistent daily practice yields the best improvement."
    },
    {
        category: "Performance",
        question: "What is the best keyboard for competitive typing?",
        answer: "Mechanical keyboards with linear or tactile switches are popular among fast typists. However, any keyboard you are comfortable with works well."
    },
    {
        category: "Performance",
        question: "Should I look at the keyboard while typing?",
        answer: "Touch typing (without looking) is faster and more accurate. Practice keeping your eyes on the screen and using muscle memory for key positions."
    },
    {
        category: "Performance",
        question: "How do I reduce typing errors?",
        answer: "Focus on rhythm and consistency rather than pure speed. Slow down slightly if your accuracy drops. Accuracy often matters more than raw speed."
    },
    {
        category: "Performance",
        question: "What is the ideal typing posture?",
        answer: "Sit upright with your wrists straight and hovering slightly above the keyboard. Avoid resting your palms or bending your wrists sharply."
    },
    {
        category: "Performance",
        question: "How often should I practice?",
        answer: "Even 15-30 minutes of daily practice produces significant improvement. Consistency is more important than long occasional sessions."
    },
    {
        category: "Performance",
        question: "What WPM is considered fast?",
        answer: "40-60 WPM is average. 60-80 WPM is above average. 80-100 WPM is fast. Over 100 WPM is considered expert level."
    },
    {
        category: "Performance",
        question: "Does keyboard layout affect speed?",
        answer: "QWERTY is most common. Alternative layouts like Dvorak can improve speed for some typists, but require significant relearning time."
    },
    {
        category: "Performance",
        question: "How do I handle difficult words?",
        answer: "Stay calm and maintain rhythm. Panicking causes more errors. If you make a mistake, continue forward rather than trying to fix it immediately."
    },
    {
        category: "Performance",
        question: "Is there a warm-up routine I should follow?",
        answer: "Start with a few Training Mode matches before ranked play. This helps your fingers warm up and gets you into the typing zone."
    },
    {
        category: "Performance",
        question: "Can finger strength affect typing?",
        answer: "Finger endurance matters more than strength. Regular typing practice builds the necessary stamina for sustained fast typing."
    },
    {
        category: "Performance",
        question: "How do I avoid fatigue during long sessions?",
        answer: "Take short breaks every 20-30 minutes. Stretch your fingers and wrists. Stay hydrated and maintain good posture throughout."
    },
    {
        category: "Performance",
        question: "Should I use all ten fingers?",
        answer: "Ten-finger touch typing is the most efficient. Each finger has designated keys. If you use fewer fingers, consider learning proper technique."
    },
    {
        category: "Performance",
        question: "What are the most common typing mistakes?",
        answer: "Common errors include adjacent key presses, doubled letters, and skipped letters. Awareness of your personal error patterns helps you improve."
    },
    {
        category: "Performance",
        question: "Does monitor position affect typing?",
        answer: "Position your monitor at eye level to avoid neck strain. This helps maintain focus during matches and reduces physical discomfort."
    },

    // ============= TROUBLESHOOTING (15) =============
    {
        category: "Troubleshooting",
        question: "Why is my screen stuck on connecting?",
        answer: "Check your internet connection and refresh the page. If the issue persists, the server may be temporarily unavailable. Try again in a few minutes."
    },
    {
        category: "Troubleshooting",
        question: "Why can I not find a match?",
        answer: "During low-traffic periods, matchmaking may take longer. Wait a bit longer or try Training Mode while waiting for more players."
    },
    {
        category: "Troubleshooting",
        question: "My keyboard input is lagging, what should I do?",
        answer: "Close unnecessary browser tabs and applications. Disable browser extensions temporarily. Ensure you are not on a heavily congested network."
    },
    {
        category: "Troubleshooting",
        question: "Why did I lose ELO even though I had higher WPM?",
        answer: "Victory is determined by completing the text first, not just WPM. Your opponent may have finished the text before you despite lower speed."
    },
    {
        category: "Troubleshooting",
        question: "The game is not responding to my keypresses, what should I do?",
        answer: "Click inside the typing area to ensure it has focus. If the issue continues, refresh the page and rejoin the queue."
    },
    {
        category: "Troubleshooting",
        question: "Why is my profile picture not showing?",
        answer: "Your profile picture is pulled from your Google account. If it is not appearing, check your Google account settings and reload Typelo."
    },
    {
        category: "Troubleshooting",
        question: "I was disconnected mid-match, what happens?",
        answer: "The match is recorded as a loss if you disconnect. Ensure a stable internet connection before queuing for ranked matches."
    },
    {
        category: "Troubleshooting",
        question: "Why is the text blurry or hard to read?",
        answer: "Check your browser zoom level (should be 100%). If using a high-DPI display, ensure your browser is configured for crisp text rendering."
    },
    {
        category: "Troubleshooting",
        question: "Can I report bugs or issues?",
        answer: "Yes, report bugs through the developer contact links available on the login page. Include details about your browser and the issue observed."
    },
    {
        category: "Troubleshooting",
        question: "Why is the site loading slowly?",
        answer: "Initial load may take a moment on slower connections. Subsequent visits are faster due to caching. Check your internet speed if problems persist."
    },
    {
        category: "Troubleshooting",
        question: "My match ended abruptly, why?",
        answer: "Matches end when one player completes all text or when the opponent disconnects. Review the results screen for specific match details."
    },
    {
        category: "Troubleshooting",
        question: "Why am I getting matched with much higher or lower ranked players?",
        answer: "During low-traffic periods, matchmaking range expands to reduce wait times. Peak hours provide closer skill-based matching."
    },
    {
        category: "Troubleshooting",
        question: "The sounds are not playing, how do I fix this?",
        answer: "Check your browser audio settings and system volume. Ensure the browser tab is not muted. Some browsers require user interaction before playing audio."
    },
    {
        category: "Troubleshooting",
        question: "Why does my rank not match my ELO?",
        answer: "Rank tiers have specific ELO thresholds. If you are near a threshold, a few wins or losses can change your rank. Check the ranks modal for details."
    },
    {
        category: "Troubleshooting",
        question: "How do I clear my Typelo cache?",
        answer: "In browser settings, clear cookies and site data for typelo.tech. This resets cached data. You will need to sign in again afterward."
    }
]

export const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqData.map(item => ({
        "@type": "Question",
        "name": item.question,
        "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer
        }
    }))
}
