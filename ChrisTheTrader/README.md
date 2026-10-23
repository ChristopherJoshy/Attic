# ChrisTheTrader

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square&logo=python)
![CCXT](https://img.shields.io/badge/CCXT-4.4.0+-orange?style=flat-square)
![Telegram](https://img.shields.io/badge/Telegram-Bot-blue?style=flat-square&logo=telegram)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

A sophisticated cryptocurrency trading bot for Binance that combines technical analysis indicators with the Avellaneda-Stoikov market making strategy. Features real-time Telegram notifications and comprehensive trade tracking.

## Overview

ChrisTheTrader is an automated BTC/USDT trading bot that executes trades based on a combination of RSI-based entry signals and the Avellaneda-Stoikov market making algorithm. The bot runs on the Binance testnet for testing purposes and can be easily configured for live trading.

## Features

### Trading Strategy
- **RSI-based Entry Signals**: Uses Relative Strength Index (7-period) with oversold/overbought thresholds
- **Stochastic RSI**: Confirms entry signals with Stochastic RSI validation
- **Avellaneda-Stoikov Market Making**: Dynamic spread calculation based on inventory risk
- **Order Flow Imbalance (OFI)**: Analyzes order book to detect buying/selling pressure
- **Trade Rate Analysis**: Monitors trading activity to adjust spreads during high volatility
- **Take Profit & Stop Loss**: Automated exit strategies with dynamic TP/SL percentages

### Bot Controls
- **Telegram Integration**: Full control via Telegram commands
- **Real-time Notifications**: Minute-by-minute trading reports
- **Trade Logging**: SQLite database for persistent trade history
- **Position Management**: Track open positions with P&L calculations
- **Manual Override**: Commands to close positions immediately

### Technical Features
- **Async Architecture**: Built with asyncio for non-blocking operations
- **CCXT Integration**: Unified exchange API across multiple platforms
- **Configurable Parameters**: Easy tuning via config.py or environment variables
- **Error Handling**: Robust exception handling with automatic recovery

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Python 3.10+ |
| Exchange API | [CCXT](https://ccxt.com/) |
| Telegram Bot | [python-telegram-bot](https://python-telegram-bot.org/) |
| Data Analysis | [pandas](https://pandas.pydata.org/), [NumPy](https://numpy.org/) |
| Configuration | python-dotenv |
| Database | SQLite (built-in) |

## Installation

### Prerequisites

- Python 3.10 or higher
- A Telegram account
- A Binance account (for testnet or live trading)

### Step 1: Clone the Repository

```bash
git clone https://github.com/ChrisTheTrader/ChrisTheTrader.git
cd ChrisTheTrader
```

### Step 2: Create a Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Binance API Credentials
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key

# Telegram Bot Credentials
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### Step 5: Get Telegram Bot Token

1. Open Telegram and search for @BotFather
2. Send `/newbot` to create a new bot
3. Follow the instructions and save your bot token
4. Start a chat with your bot and send a message
5. Get your chat ID using @userinfobot or the API

## Configuration

All trading parameters can be adjusted in `config.py`:

### Technical Indicators

| Parameter | Default | Description |
|-----------|---------|-------------|
| `RSI_PERIOD` | 7 | RSI calculation period |
| `STOCH_RSI_PERIOD` | 7 | Stochastic RSI period |
| `STOCH_RSI_K` | 3 | Stochastic RSI %K |
| `STOCH_RSI_D` | 3 | Stochastic RSI %D |
| `RSI_OVERSOLD` | 25 | RSI oversold threshold |
| `RSI_OVERBOUGHT` | 75 | RSI overbought threshold |

### Risk Management

| Parameter | Default | Description |
|-----------|---------|-------------|
| `TAKE_PROFIT_PERCENT` | 0.1% | Take profit percentage |
| `STOP_LOSS_PERCENT` | 0.5% | Stop loss percentage |

### Avellaneda-Stoikov Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MM_GAMMA` | 0.1 | Risk aversion parameter |
| `MM_A` | 140 | Order intensity |
| `MM_K` | 1.05 | Spread multiplier |
| `MM_TIME_HORIZON` | 60 | Time horizon in minutes |
| `MM_MIN_SPREAD_BPS` | 5 | Minimum spread in bps |
| `MM_MAX_INVENTORY_RATIO` | 0.6 | Max inventory ratio before dump |
| `MM_DUMP_RATIO` | 0.8 | Inventory ratio to trigger dump |
| `MM_OFI_WEIGHT` | 0.4 | Order flow imbalance weight |
| `MM_TRADE_RATE_SPIKE` | 2.0 | Trade rate spike multiplier |
| `MM_SPREAD_WIDEN_FACTOR` | 1.5 | Spread widening factor |

## Usage

### Starting the Bot

```bash
python main.py
```

The bot will:
1. Connect to Binance testnet
2. Initialize the Telegram bot
3. Display your account balance
4. Wait for the `/start` command

### Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the trading bot |
| `/stop` | Pause the trading bot |
| `/status` | Quick status overview |
| `/balance` | Show current balance |
| `/trades` | Show recent trades |
| `/reports` | Full statistics report |
| `/sellall` | Close all BTC positions |
| `/help` | Show available commands |

### Sample Telegram Output

```
┏━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🟢 BOT ONLINE          ┃
┣━━━━━━━━━━━━━━━━━━━━━━━┋
┃ Pair: BTC/USDT        
┃ Start Bal: $10,000.00
┃ Reports: Every minute  
┗━━━━━━━━━━━━━━━━━━━━━━━┛
```

## Strategy Explanation

### Entry Signal

The bot enters a long position when:
1. RSI is below oversold threshold (25) or showing recovery
2. Price momentum is positive (> -0.05%)
3. Order Flow Imbalance indicates buying pressure (OFI > -0.3)
4. Spread is favorable (< 6 bps)
5. Sufficient USDT balance available

### Exit Signals

The bot exits positions based on:
- **Take Profit**: When profit exceeds dynamic TP percentage
- **Stop Loss**: When loss exceeds dynamic SL percentage
- **Time-based**: After holding for 6 minutes with minimal loss
- **Inventory Dump**: When BTC inventory ratio exceeds 80%

### Avellaneda-Stoikov Implementation

The strategy calculates dynamic bid/ask spreads using:
```
reservation_price = S - q * γ * σ² * τ
spread = (2/γ) * ln(1 + γ/A)
```

Where:
- `S` = Current price
- `q` = Current inventory
- `γ` = Risk aversion
- `σ` = Volatility
- `τ` = Time to maturity
- `A` = Order arrival rate

### Dynamic Adjustments

- **OFI Integration**: Adjusts reservation price based on order flow
- **Trade Rate Spike**: Widens spread during high activity periods
- **Inventory Risk**: Automatically dumps positions when over-exposed

## Project Structure

```
ChrisTheTrader/
├── bot.py           # Telegram bot integration
├── config.py        # Configuration and parameters
├── exchange.py      # Binance exchange wrapper
├── main.py          # Main trading bot logic
├── strategy.py      # Trading strategy implementation
├── requirements.txt # Python dependencies
└── .env             # Environment variables (create from .env.example)
```

## Database Schema

Trades are stored in `trades.db`:

```sql
CREATE TABLE trades (
    id INTEGER PRIMARY KEY,
    time TEXT,
    type TEXT,       -- BUY or SELL
    price REAL,
    qty REAL,
    pnl REAL,        -- Profit/Loss
    dur INTEGER      -- Duration in seconds
);
```

## Safety Notes

> **Warning**: This bot trades with real money. Use at your own risk.
> 
> - Always test on testnet first
> - Start with small amounts
> - Monitor the bot initially
> - Set appropriate stop losses
> - Never invest more than you can afford to lose

## License

MIT License

Copyright (c) 2024 ChrisTheTrader

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Credits

- [CCXT](https://ccxt.com/) - Unified cryptocurrency exchange library
- [python-telegram-bot](https://python-telegram-bot.org/) - Telegram Bot API
- [pandas](https://pandas.pydata.org/) - Data analysis
- [Avellaneda & Stoikov](https://arxiv.org/abs/1105.3115) - Market making strategy
