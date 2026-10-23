# Polaris Discord Bot

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/Discord.py-2.x-red.svg" alt="Discord.py">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/github/repo-size/ChristopherJoshy/Polaris-Bot?color=orange" alt="Repo Size">
  <img src="https://img.shields.io/github/last-commit/ChristopherJoshy/Polaris-Bot?color=yellow" alt="Last Commit">
</p>

A Discord bot for snowball combat with RPG progression, gambling, and a friendly Santa chat.

---

## Quick Stats

| Metric | Value |
|--------|-------|
| **Combat System** | Turn-based snowball fights with critical hits & fumbles |
| **Progression** | 50 levels with 8 unique weapons |
| **Currency** | Icicles - earned through combat, gambling, and daily rewards |
| **Features** | Shop system, achievements, leaderboards, Santa AI chat |
| **Min Bet** | 5 Icicles for gambling |

---

## What is Polaris?

Polaris turns your Discord server into a snowball arena. Players throw snowballs at each other, earn Icicles (currency), level up to unlock better weapons, and compete on leaderboards.

---

## Screenshots

*Coming soon - add your screenshots here!*

---

## Commands

| Command | Description |
|---------|-------------|
| `/throw @user` | Attack another player |
| `/stats` | View your profile |
| `/stats @user` | View someone else's profile |
| `/inventory` | See your weapons and equip them |
| `/shop` | Buy healing items, buffs, and gear |
| `/gamble` | Play slots or challenge someone to coin flip |
| `/daily` | Claim daily Icicles reward |
| `/leaderboard` | See top players |
| `/help` | Full guide with all features |
| `@Polaris [message]` | Chat with Santa |

---

## Combat

Use `/throw @user` to attack. Each throw has a chance to:

| Outcome | Chance | Effect |
|---------|--------|--------|
| Hit | 75% | Normal damage |
| Critical | 5% | Double damage |
| Miss | 15% | No damage |
| Fumble | 5% | Hit yourself |

When you hit someone, you earn:
- **2-5 Icicles** per hit
- **XP equal to damage dealt**

When you knock someone out (reduce to 0 HP), you earn:
- **+25 bonus Icicles**
- **Kill added to your stats**

The victim respawns with full HP.

---

## Weapons

Weapons unlock as you level up. Higher level = more damage.

| Level | Weapon | Damage Range |
|-------|--------|--------------|
| 1 | Snowball | 5-12 |
| 3 | Packed Snow | 10-18 |
| 6 | Ice Ball | 14-24 |
| 10 | Ice Bomb | 18-30 |
| 15 | Avalanche | 25-40 |
| 20 | Blizzard Ball | 32-50 |
| 30 | Permafrost | 40-60 |
| 50 | Absolute Zero | 50-75 |

Use `/inventory` to view unlocked weapons and equip them.

---

## Leveling Up

You gain XP from combat damage. The XP needed for each level is `level * 100`.

When you level up, you may unlock:
- New weapons
- Icicle rewards (50-2500 depending on level)
- Free items at milestones (shield at Lv5, cannon at Lv15, etc.)

---

## Shop

Use `/shop` to buy items. All items cost Icicles.

### Healing

| Item | Cost | Effect |
|------|------|--------|
| Hot Cocoa | 10 | +25 HP |
| Healing Surge | 25 | +50 HP |
| Full Restore | 50 | Restore to max HP |

### Buffs

| Item | Cost | Effect |
|------|------|--------|
| Energy Drink | 30 | +50% damage on next hit |
| XP Boost | 40 | 2x XP for 5 hits |
| Lucky Charm | 35 | +10% crit chance for 5 hits |

### Gear

| Item | Cost | Effect |
|------|------|--------|
| Frost Shield | 40 | Blocks 1 incoming attack |
| Ice Armor | 75 | -25% damage taken for 5 hits |
| Cannon | 80 | +8 damage for 10 hits |
| Ice Fortress | 100 | Permanently +15 max HP |

---

## Gambling

Use `/gamble` to access gambling features. Minimum bet is 5 Icicles.

### Slot Machine

Solo game. Bet your Icicles and spin.

| Result | Payout |
|--------|--------|
| No match | Lose bet |
| 2 matching | 1.5x bet |
| 3 matching | 3x bet |
| 3 stars | 5x bet |
| 3 diamonds | 10x bet (JACKPOT) |

### Coin Flip

1v1 game. Challenge another player by entering their user ID.

Both players bet the same amount. A coin is flipped and the winner takes the entire pot. The loser loses their bet.

---

## Daily Rewards

Use `/daily` every day to claim free Icicles. Coming back on consecutive days builds your streak for bigger rewards.

| Streak | Reward |
|--------|--------|
| Day 1 | 15 Icicles |
| Day 2 | 30 Icicles |
| Day 3 | 50 Icicles + bonus |
| Day 7 | 150 Icicles + mystery box |
| Day 14 | 350 Icicles + rare item |
| Day 30 | 750 Icicles + legendary |

Missing a day resets your streak to 1.

---

## Achievements

Unlock achievements for bonus Icicles:

| Achievement | Requirement | Reward |
|-------------|-------------|--------|
| First Blood | Get your first knockout | 50 |
| Daily Warrior | 7-day login streak | 500 |
| Big Spender | Spend 1000 Icicles | 200 |
| High Roller | Win 500+ from slots | 250 |
| Lucky Flip | Win 10 coin flips | 200 |
| Survivor | Survive with 1 HP | 100 |

---

## Santa Chat

Mention the bot (`@Polaris`) followed by a message to chat with Santa. Responses are concise and cheerful.

---

## Setup

### Requirements

- Python 3.10+
- Discord Bot Token
- Gemini API Key (for Santa chat)

### Installation

```bash
# Clone the repository
git clone https://github.com/ChristopherJoshy/Polaris-Bot.git
cd Polaris-Bot

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Create a `.env` file in the project root:

```env
DISCORD_TOKEN=your_discord_bot_token
GEMINI_API_KEY=your_gemini_api_key
```

### Running the Bot

```bash
python bot.py
```

---

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Ideas for Contributions

- Add new weapons and items
- Implement additional mini-games
- Create new achievement types
- Improve the Santa AI responses
- Add localization support
- Design new visual elements

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built with ❤️ by [Christopher Joshy](https://github.com/ChristopherJoshy)
