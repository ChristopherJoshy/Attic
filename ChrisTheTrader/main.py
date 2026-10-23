import asyncio
from config import Config
from exchange import Exchange
from strategy import Strategy
from bot import TelegramBot
import traceback
from datetime import datetime


class TradingBot:
    def __init__(self):
        self.config = Config()
        self.exchange = Exchange(
            self.config.BINANCE_API_KEY,
            self.config.BINANCE_SECRET_KEY,
            self.config.TESTNET_URL,
        )
        self.strategy = Strategy(
            self.config.RSI_PERIOD,
            self.config.STOCH_RSI_PERIOD,
            self.config.STOCH_RSI_K,
            self.config.STOCH_RSI_D,
            self.config.RSI_OVERSOLD,
            self.config.RSI_OVERBOUGHT,
            self.config.TAKE_PROFIT_PERCENT,
            self.config.STOP_LOSS_PERCENT,
            self.config.MM_GAMMA,
            self.config.MM_A,
            self.config.MM_K,
            self.config.MM_TIME_HORIZON,
            self.config.MM_MIN_SPREAD_BPS,
            self.config.MM_MAX_INVENTORY_RATIO,
            self.config.MM_DUMP_RATIO,
            self.config.MM_OFI_WEIGHT,
            self.config.MM_TRADE_RATE_SPIKE,
            self.config.MM_SPREAD_WIDEN_FACTOR,
        )
        self.telegram_bot = TelegramBot(
            self.config.TELEGRAM_TOKEN, self.config.TELEGRAM_CHAT_ID
        )
        self.position_quantity = 0.0
        self.cycle_count = 0

    def log(self, msg):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

    async def initialize(self):
        self.log("Connecting to Binance testnet...")
        await asyncio.to_thread(self.exchange.initialize)
        self.log("Loading market info for BTC/USDT...")
        await asyncio.to_thread(
            self.exchange.load_market_info, self.config.TRADING_PAIR
        )
        self.log("Initializing Telegram bot...")
        await self.telegram_bot.initialize()
        self.telegram_bot.exchange = self.exchange
        balance = await asyncio.to_thread(self.exchange.get_balance)
        usdt = balance.get("USDT", {}).get("free", 0.0)
        btc = balance.get("BTC", {}).get("free", 0.0)
        price = await asyncio.to_thread(self.exchange.get_current_price)
        total_equity = usdt + (btc * price)
        self.telegram_bot.update_stats({"start_bal": total_equity, "bal": total_equity})
        self.telegram_bot.minute_data["start_bal"] = total_equity
        self.log(
            f"Connected! Balance: ${total_equity:.2f} (USDT:{usdt:.2f} BTC:{btc:.6f})"
        )

    async def execute_trade(self, signal, reason, target_price=None):
        if not self.telegram_bot.is_running:
            return
        try:
            balance = await asyncio.to_thread(self.exchange.get_balance)
            price = await asyncio.to_thread(self.exchange.get_current_price)
            btc = balance.get("BTC", {}).get("free", 0.0)
            usdt = balance.get("USDT", {}).get("free", 0.0)

            if signal == "BUY" and usdt > 10:
                order_price = target_price if target_price else price
                amount = min(usdt * 0.05, usdt - 5)
                self.log(f"BUY {amount:.0f} USDT | {reason}")
                order = await asyncio.to_thread(
                    self.exchange.place_market_buy_order, amount
                )

                if order:
                    qty = float(order.get("executedQty", 0)) or float(
                        order.get("origQty", 0)
                    )
                    fill_price = (
                        float(order.get("fills", [{}])[0].get("price", order_price))
                        if order.get("fills")
                        else order_price
                    )
                    self.position_quantity += qty
                    self.strategy.set_position("LONG", fill_price)
                    s = self.telegram_bot.stats
                    self.telegram_bot.update_stats({"trades": s["trades"] + 1})
                    self.log(
                        f"FILLED BUY @ ${fill_price:.2f} | {qty:.6f} | reason={reason}"
                    )
                    await self.telegram_bot.log_buy(fill_price, qty, reason)
                else:
                    self.log("BUY order rejected or not returned")

            elif signal in ["SELL", "DUMP"] and btc > 0.00001:
                order_price = target_price if target_price else price
                self.log(f"SELL {btc:.6f} BTC | {reason}")
                order = await asyncio.to_thread(
                    self.exchange.place_market_sell_order, btc
                )

                if order:
                    entry = self.strategy.entry_price or price
                    actual_price = (
                        float(order.get("fills", [{}])[0].get("price", order_price))
                        if order.get("fills")
                        else order_price
                    )
                    pnl = (actual_price - entry) * btc
                    is_win = pnl > 0
                    s = self.telegram_bot.stats
                    self.telegram_bot.update_stats(
                        {
                            "trades": s["trades"] + 1,
                            "wins": s["wins"] + (1 if is_win else 0),
                            "losses": s["losses"] + (0 if is_win else 1),
                            "pnl": s["pnl"] + pnl,
                        }
                    )
                    self.log(f"FILLED {signal} @ ${actual_price:.2f} | PnL: ${pnl:.2f}")
                    await self.telegram_bot.log_sell(actual_price, btc, pnl, reason)
                    self.position_quantity = 0.0
                    self.strategy.clear_position()
                else:
                    self.log(f"{signal} order rejected or not returned")
        except Exception as e:
            self.log(f"✗ Trade Error: {e}")

    async def update_balance(self):
        try:
            balance = await asyncio.to_thread(self.exchange.get_balance)
            usdt = balance.get("USDT", {}).get("free", 0.0)
            btc = balance.get("BTC", {}).get("free", 0.0)
            price = await asyncio.to_thread(self.exchange.get_current_price)
            total = usdt + (btc * price)
            self.telegram_bot.update_stats({"bal": total})
        except:
            pass

    async def trading_loop(self):
        while True:
            try:
                if self.telegram_bot.is_running:
                    self.cycle_count += 1
                    ohlcv = await asyncio.to_thread(self.exchange.get_ohlcv, "1m", 20)
                    df = self.strategy.process_data(ohlcv)
                    balance = await asyncio.to_thread(self.exchange.get_balance)
                    btc = balance.get("BTC", {}).get("free", 0.0)
                    usdt = balance.get("USDT", {}).get("free", 0.0)
                    order_book = await asyncio.to_thread(
                        self.exchange.get_order_book, 10
                    )
                    trades = await asyncio.to_thread(
                        self.exchange.get_recent_trades, 50
                    )
                    signal, reason, target = self.strategy.generate_signal(
                        df, btc, usdt, order_book, trades
                    )
                    price = df["close"].iloc[-1]
                    self.log(
                        f"[{self.cycle_count}] ${price:.2f} | BTC:{btc:.6f} USDT:{usdt:.2f} | sig={signal}"
                    )
                    if signal:
                        await self.execute_trade(signal, reason, target)
                    await self.update_balance()
                await asyncio.sleep(self.config.TRADE_INTERVAL_SECONDS)
            except Exception as e:
                self.log(f"Loop error: {e}")
                await asyncio.sleep(self.config.TRADE_INTERVAL_SECONDS)

    async def report_loop(self):
        while True:
            await asyncio.sleep(self.config.STATUS_REPORT_INTERVAL)
            try:
                if self.telegram_bot.is_running:
                    await self.telegram_bot.send_minute_report()
            except:
                pass

    async def run(self):
        await self.initialize()
        self.log("Bot ready! /start on Telegram")
        await asyncio.gather(self.trading_loop(), self.report_loop())


if __name__ == "__main__":
    bot = TradingBot()
    try:
        asyncio.run(bot.run())
    except KeyboardInterrupt:
        print("\nStopped")
    except Exception:
        traceback.print_exc()
