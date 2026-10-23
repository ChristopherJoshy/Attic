import pandas as pd
import numpy as np
from datetime import datetime


class Strategy:
    def __init__(
        self,
        rsi_period,
        stoch_rsi_period,
        stoch_rsi_k,
        stoch_rsi_d,
        rsi_oversold,
        rsi_overbought,
        take_profit_percent,
        stop_loss_percent,
        mm_gamma,
        mm_a,
        mm_k,
        mm_time_horizon,
        mm_min_spread_bps,
        mm_max_inventory_ratio,
        mm_dump_ratio,
        mm_ofi_weight,
        mm_trade_rate_spike,
        mm_spread_widen_factor,
    ):
        self.gamma = mm_gamma
        self.A = mm_a
        self.k = mm_k
        self.T = mm_time_horizon
        self.min_spread_bp = mm_min_spread_bps
        self.max_inventory_ratio = mm_max_inventory_ratio
        self.dump_ratio = mm_dump_ratio
        self.ofi_weight = mm_ofi_weight
        self.trade_rate_spike = mm_trade_rate_spike
        self.spread_widen_factor = mm_spread_widen_factor

        self.position = None
        self.entry_price = None
        self.last_prices = []
        self.sigma = 0.0
        self.inventory = 0.0
        self.last_buy_time = datetime.now()
        self.last_spread_time = datetime.now()
        self.pending_orders = {"buy": None, "sell": None}
        self.trade_rate_avg = 0.0

        self.take_profit = take_profit_percent
        self.stop_loss = stop_loss_percent

    def calculate_volatility(self, prices):
        if len(prices) < 2:
            return 0.01
        returns = np.diff(prices) / np.array(prices[:-1])
        return np.std(returns)

    def update_volatility(self, price):
        self.last_prices.append(price)
        if len(self.last_prices) > 60:
            self.last_prices.pop(0)
        if len(self.last_prices) >= 5:
            self.sigma = self.calculate_volatility(self.last_prices)

    def process_data(self, ohlcv_data):
        df = pd.DataFrame(
            ohlcv_data, columns=["timestamp", "open", "high", "low", "close", "volume"]
        )
        df["returns"] = df["close"].pct_change()
        df["volatility"] = df["returns"].rolling(window=10).std()
        return df

    def avellaneda_stoikov_spread(self, S, sigma, T, gamma, A, q, k=1.05):
        tau = T / (365.25 * 24 * 3600)
        if sigma == 0:
            sigma = 0.01
        if gamma == 0:
            gamma = 0.1
        reservation = S - q * gamma * (sigma**2) * tau
        spread_component = (2 / gamma) * np.log(1 + gamma / A)
        bid = reservation - spread_component / 2 - q * (sigma**2) * tau / (2 * k)
        ask = reservation + spread_component / 2 + q * (sigma**2) * tau / (2 * k)
        return bid, ask, reservation, spread_component

    def compute_ofi(self, order_book):
        bids = order_book.get("bids", [])
        asks = order_book.get("asks", [])
        bid_vol = sum([b[1] for b in bids[:5]]) if bids else 0.0
        ask_vol = sum([a[1] for a in asks[:5]]) if asks else 0.0
        denom = bid_vol + ask_vol
        if denom == 0:
            return 0.0
        return (bid_vol - ask_vol) / denom

    def compute_trade_rate(self, trades):
        if not trades or len(trades) < 2:
            return 0.0
        ts = [t["timestamp"] for t in trades if "timestamp" in t]
        ts.sort()
        span = (ts[-1] - ts[0]) / 1000.0
        if span <= 0:
            return len(ts)
        return len(ts) / span

    def generate_signal(
        self, df, btc_held=0.0, usdt_balance=0.0, order_book=None, trades=None
    ):
        if len(df) < 5:
            return None, None, None

        current_price = df["close"].iloc[-1]
        self.update_volatility(current_price)

        self.inventory = btc_held

        ofi = self.compute_ofi(order_book or {})
        trade_rate = self.compute_trade_rate(trades or [])
        if self.trade_rate_avg == 0.0:
            self.trade_rate_avg = trade_rate
        self.trade_rate_avg = 0.9 * self.trade_rate_avg + 0.1 * trade_rate

        bid, ask, reservation, spread_component = self.avellaneda_stoikov_spread(
            S=current_price,
            sigma=self.sigma if self.sigma > 0 else 0.02,
            T=self.T,
            gamma=self.gamma,
            A=self.A,
            q=self.inventory,
            k=self.k,
        )

        ofi_term = self.ofi_weight * ofi * spread_component
        reservation += ofi_term
        bid += ofi_term
        ask += ofi_term

        if (
            trade_rate > self.trade_rate_avg * self.trade_rate_spike
            and spread_component > 0
        ):
            spread_component *= self.spread_widen_factor
            bid = reservation - spread_component / 2
            ask = reservation + spread_component / 2

        top_bid = (
            order_book.get("bids", [[current_price, 0]])[0][0]
            if order_book
            else current_price
        )
        top_ask = (
            order_book.get("asks", [[current_price, 0]])[0][0]
            if order_book
            else current_price
        )
        book_spread = max(top_ask - top_bid, 0)
        spread_bps = (book_spread / current_price) * 10000 if current_price else 0
        spread_pct = (spread_component / current_price) * 100 if current_price else 0

        equity = usdt_balance + btc_held * current_price
        inventory_ratio = (btc_held * current_price) / equity if equity > 0 else 0

        current_time = datetime.now()
        price_momentum = 0.0
        if len(df) >= 2:
            price_momentum = (
                (df["close"].iloc[-1] - df["close"].iloc[-2]) / df["close"].iloc[-2]
            ) * 100

        tp_pct = max(0.01, (spread_bps * 0.6) / 100)
        sl_pct = max(tp_pct * 2, 0.03)
        max_hold = 6

        if inventory_ratio >= self.dump_ratio:
            return "SELL", "Inventory dump", current_price

        if btc_held >= 0.0001:
            if not self.position:
                self.set_position("LONG", current_price)
            pnl_pct = (
                ((current_price - self.entry_price) / self.entry_price) * 100
                if self.entry_price
                else 0
            )
            hold_time = (current_time - self.last_buy_time).total_seconds()

            if pnl_pct >= tp_pct:
                return "SELL", f"TP +{pnl_pct:.4f}%", current_price
            if pnl_pct <= -sl_pct:
                return "SELL", f"SL {pnl_pct:.4f}%", current_price
            if hold_time >= max_hold and pnl_pct > -0.02:
                return "SELL", f"Cycle {pnl_pct:+.4f}%", current_price
        else:
            if usdt_balance < 10:
                return None, None, None
            if spread_bps > 6:
                return None, None, None
            if price_momentum >= -0.05 and ofi > -0.3:
                self.last_buy_time = current_time
                return "BUY", "Entry", current_price

        return None, None, None

    def set_position(self, position_type, entry_price):
        self.position = position_type
        self.entry_price = entry_price

    def clear_position(self):
        self.position = None
        self.entry_price = None

    def get_position(self):
        return self.position, self.entry_price
