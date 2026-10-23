import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    BINANCE_API_KEY = os.getenv("BINANCE_API_KEY", "").strip()
    BINANCE_SECRET_KEY = os.getenv("BINANCE_SECRET_KEY", "").strip()
    TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "").strip()
    TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()

    TRADING_PAIR = "BTC/USDT"
    TESTNET_URL = "https://testnet.binance.vision"

    RSI_PERIOD = 7
    STOCH_RSI_PERIOD = 7
    STOCH_RSI_K = 3
    STOCH_RSI_D = 3
    RSI_OVERSOLD = 25
    RSI_OVERBOUGHT = 75

    TAKE_PROFIT_PERCENT = 0.1
    STOP_LOSS_PERCENT = 0.5

    MM_GAMMA = 0.1
    MM_A = 140
    MM_K = 1.05
    MM_TIME_HORIZON = 60
    MM_MIN_SPREAD_BPS = 5
    MM_MAX_INVENTORY_RATIO = 0.6
    MM_DUMP_RATIO = 0.8
    MM_OFI_WEIGHT = 0.4
    MM_TRADE_RATE_SPIKE = 2.0
    MM_SPREAD_WIDEN_FACTOR = 1.5

    TRADE_INTERVAL_SECONDS = 0.5
    STATUS_REPORT_INTERVAL = 60
