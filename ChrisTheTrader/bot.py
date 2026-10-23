from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from datetime import datetime
import sqlite3


class TelegramBot:
    def __init__(self, token, chat_id):
        self.token = token
        self.chat_id = chat_id
        self.application = None
        self.is_running = False
        self.stats = {
            "trades": 0,
            "wins": 0,
            "losses": 0,
            "pnl": 0.0,
            "start_bal": 0.0,
            "bal": 0.0,
        }
        self.position = None
        self.exchange = None
        self.db_path = "trades.db"
        self.minute_data = {
            "start_bal": 0.0,
            "trades": [],
            "buys": 0,
            "sells": 0,
            "pnl": 0.0,
        }
        self.init_db()

    def init_db(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute(
            """CREATE TABLE IF NOT EXISTS trades (id INTEGER PRIMARY KEY, time TEXT, type TEXT, price REAL, qty REAL, pnl REAL, dur INTEGER)"""
        )
        conn.commit()
        conn.close()

    def save_trade(self, t_type, price, qty, pnl=0.0, dur=0):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute(
            "INSERT INTO trades (time,type,price,qty,pnl,dur) VALUES (?,?,?,?,?,?)",
            (datetime.now().isoformat(), t_type, price, qty, pnl, dur),
        )
        conn.commit()
        conn.close()

    def get_db_stats(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute(
            "SELECT COUNT(*), COALESCE(SUM(CASE WHEN pnl>0 THEN 1 ELSE 0 END),0), COALESCE(SUM(CASE WHEN pnl<0 THEN 1 ELSE 0 END),0), COALESCE(SUM(pnl),0) FROM trades WHERE type='SELL'"
        )
        r = c.fetchone()
        conn.close()
        return {"total": r[0], "wins": r[1], "losses": r[2], "pnl": r[3]}

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.message.chat_id != int(self.chat_id):
            return
        self.is_running = True
        bal = self.stats["start_bal"]
        self.minute_data = {
            "start_bal": bal,
            "trades": [],
            "buys": 0,
            "sells": 0,
            "pnl": 0.0,
        }
        msg = (
            "┏━━━━━━━━━━━━━━━━━━━━━━━┓\n"
            "┃ 🟢 BOT ONLINE          ┃\n"
            "┣━━━━━━━━━━━━━━━━━━━━━━━╋\n"
            "┃ Pair: BTC/USDT        \n"
            f"┃ Start Bal: ${bal:,.2f}\n"
            "┃ Reports: Every minute  \n"
            "┗━━━━━━━━━━━━━━━━━━━━━━━┛"
        )
        await update.message.reply_text(msg)

    async def cmd_stop(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.message.chat_id != int(self.chat_id):
            return
        self.is_running = False
        await update.message.reply_text(
            "┏━━━━━━━━━━━━━━━━━━━━━━━┓\n"
            "┃ 🔴 BOT PAUSED         ┃\n"
            "┗━━━━━━━━━━━━━━━━━━━━━━━┛"
        )

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.message.chat_id != int(self.chat_id):
            return
        msg = (
            "┏━━━━━━━━ COMMANDS ━━━━━━━━┓\n"
            "┃ /start   → Start trading \n"
            "┃ /stop    → Pause bot      \n"
            "┃ /status  → Quick status   \n"
            "┃ /reports → Full stats     \n"
            "┃ /trades  → Recent trades  \n"
            "┃ /bal     → Balance        \n"
            "┃ /sellall → Close BTC      \n"
            "┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
        )
        await update.message.reply_text(msg)

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.message.chat_id != int(self.chat_id):
            return
        s = self.stats
        wr = (s["wins"] / s["trades"] * 100) if s["trades"] > 0 else 0
        pos = "None"
        if self.position:
            dur = int((datetime.now() - self.position["t"]).total_seconds())
            pos = f"LONG ${self.position['p']:,.0f} ({dur}s)"
        status = "🟢 Running" if self.is_running else "🔴 Paused"
        msg = (
            "┏━━━━━━ STATUS ━━━━━━┓\n"
            f"┃ {status}\n"
            "┣━━━━━━━━━━━━━━━━━━━━┫\n"
            f"┃ 💰 Balance: ${s['bal']:,.2f}\n"
            f"┃ 📈 P&L:     ${s['pnl']:+,.2f}\n"
            f"┃ 📊 Trades:  {s['trades']} ({wr:.0f}%)\n"
            f"┃ 🎯 Pos:     {pos}\n"
            "┗━━━━━━━━━━━━━━━━━━━━┛"
        )
        await update.message.reply_text(msg)

    async def cmd_balance(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.message.chat_id != int(self.chat_id):
            return
        s = self.stats
        msg = (
            "┏━━━━ BALANCE ━━━━┓\n"
            f"┃ 💰 Total:   ${s['bal']:,.2f}\n"
            f"┃ 📈 Session: ${s['pnl']:+,.2f}\n"
            "┗━━━━━━━━━━━━━━━┛"
        )
        await update.message.reply_text(msg)

    async def cmd_trades(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.message.chat_id != int(self.chat_id):
            return
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT type, price, pnl FROM trades ORDER BY id DESC LIMIT 8")
        rows = c.fetchall()
        conn.close()
        if not rows:
            await update.message.reply_text("No trades yet")
            return
        msg = "┏━━━━ RECENT TRADES ━━━━┓\n"
        for r in rows:
            icon = "🟢" if r[0] == "BUY" else ("✅" if r[2] >= 0 else "❌")
            msg += f"┃ {icon} {r[0]} ${r[1]:,.0f} ${r[2]:+.2f}\n"
        msg += "┗━━━━━━━━━━━━━━━━━━━━━━━┛"
        await update.message.reply_text(msg)

    async def cmd_reports(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.message.chat_id != int(self.chat_id):
            return
        db = self.get_db_stats()
        s = self.stats
        wr = (db["wins"] / db["total"] * 100) if db["total"] > 0 else 0
        msg = (
            "┏━━━━━━ FULL REPORT ━━━━━━┓\n"
            f"┃ Status: {'🟢 Live' if self.is_running else '🔴 Off'}\n"
            "┣━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n"
            f"┃ Session P&L: ${s['pnl']:+,.2f}\n"
            f"┃ Balance:     ${s['bal']:,.2f}\n"
            "┣━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n"
            f"┃ All-time trades: {db['total']}\n"
            f"┃ ✅ Wins:   {db['wins']} ({wr:.0f}%)\n"
            f"┃ ❌ Losses: {db['losses']}\n"
            f"┃ 💰 Total:  ${db['pnl']:+,.2f}\n"
            "┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
        )
        await update.message.reply_text(msg)

    async def cmd_sellall(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        if update.message.chat_id != int(self.chat_id):
            return
        if not self.exchange:
            await update.message.reply_text("Not connected")
            return
        try:
            bal = self.exchange.get_balance()
            btc = bal.get("BTC", {}).get("free", 0.0)
            if btc > 0.00001:
                price = self.exchange.get_current_price()
                self.exchange.place_market_sell_order(btc)
                self.save_trade("SELL", price, btc, 0.0, 0)
                await update.message.reply_text(
                    "┏━━━━ SOLD ALL BTC ━━━━┓\n"
                    f"┃ Qty: {btc:.6f} BTC\n"
                    f"┃ Px : ${price:,.2f}\n"
                    "┗━━━━━━━━━━━━━━━━━━━━━━┛"
                )
                self.position = None
            else:
                await update.message.reply_text("No BTC to sell")
        except Exception as e:
            await update.message.reply_text(f"Error: {str(e)[:40]}")

    async def send(self, msg):
        if self.application:
            await self.application.bot.send_message(chat_id=self.chat_id, text=msg)

    def record_trade(self, t_type, price, qty, pnl=0.0):
        self.minute_data["trades"].append(
            {"type": t_type, "price": price, "qty": qty, "pnl": pnl}
        )
        if t_type == "BUY":
            self.minute_data["buys"] += 1
        else:
            self.minute_data["sells"] += 1
            self.minute_data["pnl"] += pnl

    async def log_buy(self, price, qty, reason):
        self.position = {"p": price, "q": qty, "t": datetime.now()}
        self.save_trade("BUY", price, qty)
        self.record_trade("BUY", price, qty)

    async def log_sell(self, price, qty, pnl, reason):
        dur = (
            int((datetime.now() - self.position["t"]).total_seconds())
            if self.position
            else 0
        )
        self.save_trade("SELL", price, qty, pnl, dur)
        self.record_trade("SELL", price, qty, pnl)
        self.position = None

    async def send_minute_report(self):
        if not self.is_running:
            return
        d = self.minute_data
        start = d["start_bal"]
        end = self.stats["bal"]
        total = len(d["trades"])
        icon = "📈" if d["pnl"] >= 0 else "📉"
        trades_str = ""
        for t in d["trades"][-5:]:
            t_icon = "🟢" if t["type"] == "BUY" else ("✅" if t["pnl"] >= 0 else "❌")
            trades_str += (
                f"║ {t_icon} {t['type']} ${t['price']:,.0f} ${t['pnl']:+.2f}\n"
            )
        if not trades_str:
            trades_str = "║ No trades this minute\n"
        msg = (
            "┏━━━━ MINUTE REPORT ━━━━┓\n"
            f"┃ ⏱️ {datetime.now().strftime('%H:%M')} | {total} trades\n"
            "┣━━━━━━━━━━━━━━━━━━━━━━━┫\n"
            f"┃ 💰 Start: ${start:,.2f}\n"
            f"┃ 💰 Now:   ${end:,.2f}\n"
            "┣━━━━━━━━━━━━━━━━━━━━━━━┫\n"
            f"┃ 🟢 Buys : {d['buys']}\n"
            f"┃ 🔴 Sells: {d['sells']}\n"
            f"┃ {icon} P&L : ${d['pnl']:+.2f}\n"
            "┣━━━━━━━━━━━━━━━━━━━━━━━┫\n"
            f"{trades_str}"
            "┗━━━━━━━━━━━━━━━━━━━━━━━┛"
        )
        await self.send(msg)
        self.minute_data = {
            "start_bal": end,
            "trades": [],
            "buys": 0,
            "sells": 0,
            "pnl": 0.0,
        }

    async def send_status_report(self):
        await self.send_minute_report()

    def update_stats(self, data):
        self.stats.update(data)

    async def initialize(self):
        self.application = (
            Application.builder()
            .token(self.token)
            .read_timeout(30)
            .write_timeout(30)
            .connect_timeout(30)
            .build()
        )
        cmds = [
            ("start", self.cmd_start),
            ("stop", self.cmd_stop),
            ("help", self.cmd_help),
            ("status", self.cmd_status),
            ("bal", self.cmd_balance),
            ("trades", self.cmd_trades),
            ("reports", self.cmd_reports),
            ("sellall", self.cmd_sellall),
        ]
        for cmd, fn in cmds:
            self.application.add_handler(CommandHandler(cmd, fn))
        await self.application.initialize()
        await self.application.start()
        await self.application.updater.start_polling(drop_pending_updates=True)
