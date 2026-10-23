import ccxt
import requests
from decimal import Decimal, ROUND_DOWN


class Exchange:
    def __init__(self, api_key, secret_key, testnet_url):
        self.api_key = api_key
        self.secret_key = secret_key
        self.testnet_url = testnet_url
        self.exchange = None
        self.symbol = None
        self.market_info = None

    def initialize(self):
        self.exchange = ccxt.binance(
            {
                "apiKey": self.api_key,
                "secret": self.secret_key,
                "enableRateLimit": True,
                "options": {
                    "defaultType": "spot",
                    "adjustForTimeDifference": True,
                    "fetchCurrencies": False,
                    "warnOnFetchCurrenciesSapi": False,
                    "warnOnFetchCurrencies": False,
                },
            }
        )
        self.exchange.set_sandbox_mode(False)
        self.exchange.has["fetchCurrencies"] = False
        self.exchange.has["sapi"] = False
        self.exchange.urls["api"] = {
            "public": "https://testnet.binance.vision/api/v3",
            "private": "https://testnet.binance.vision/api/v3",
        }
        self.exchange.load_markets = lambda *args, **kwargs: {}

    def close(self):
        pass

    def load_market_info(self, symbol):
        self.symbol = symbol
        resp = requests.get("https://testnet.binance.vision/api/v3/exchangeInfo")
        data = resp.json()
        raw_symbol = symbol.replace("/", "")
        for s in data.get("symbols", []):
            if s["symbol"] == raw_symbol:
                self.market_info = s
                break

    def get_balance(self):
        response = self.exchange.private_get_account()
        balances = {}
        if "balances" in response:
            for item in response["balances"]:
                asset = item["asset"]
                free = float(item["free"])
                locked = float(item["locked"])
                balances[asset] = {
                    "free": free,
                    "locked": locked,
                    "total": free + locked,
                }
        return balances

    def get_current_price(self):
        ticker = self.exchange.public_get_ticker_price(
            {"symbol": self.symbol.replace("/", "")}
        )
        return float(ticker["price"])

    def get_ohlcv(self, timeframe="1m", limit=100):
        interval_map = {
            "1m": "1m",
            "5m": "5m",
            "15m": "15m",
            "1h": "1h",
            "4h": "4h",
            "1d": "1d",
        }
        params = {
            "symbol": self.symbol.replace("/", ""),
            "interval": interval_map.get(timeframe, "1m"),
            "limit": limit,
        }
        klines = self.exchange.public_get_klines(params)
        return [
            [k[0], float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5])]
            for k in klines
        ]

    def calculate_quantity(self, price, amount_usdt):
        step_size = 0.00001
        for f in self.market_info.get("filters", []):
            if f["filterType"] == "LOT_SIZE":
                step_size = float(f["stepSize"])
                break
        quantity = amount_usdt / price
        quantity = Decimal(str(quantity))
        quantity = quantity.quantize(Decimal(str(step_size)), rounding=ROUND_DOWN)
        return float(quantity)

    def place_market_buy_order(self, amount_usdt):
        current_price = self.get_current_price()
        quantity = self.calculate_quantity(current_price, amount_usdt)
        if quantity <= 0:
            return None
        params = {
            "symbol": self.symbol.replace("/", ""),
            "side": "BUY",
            "type": "MARKET",
            "quantity": quantity,
        }
        return self.exchange.private_post_order(params)

    def place_market_sell_order(self, quantity):
        if quantity <= 0:
            return None
        params = {
            "symbol": self.symbol.replace("/", ""),
            "side": "SELL",
            "type": "MARKET",
            "quantity": quantity,
        }
        return self.exchange.private_post_order(params)

    def place_limit_buy_order(self, price, quantity):
        if quantity <= 0 or price <= 0:
            return None
        price = round(price, 2)
        params = {
            "symbol": self.symbol.replace("/", ""),
            "side": "BUY",
            "type": "LIMIT",
            "timeInForce": "GTC",
            "price": price,
            "quantity": quantity,
        }
        try:
            return self.exchange.private_post_order(params)
        except Exception as e:
            print(f"Limit buy order error: {e}")
            return None

    def place_limit_sell_order(self, price, quantity):
        if quantity <= 0 or price <= 0:
            return None
        price = round(price, 2)
        params = {
            "symbol": self.symbol.replace("/", ""),
            "side": "SELL",
            "type": "LIMIT",
            "timeInForce": "GTC",
            "price": price,
            "quantity": quantity,
        }
        try:
            return self.exchange.private_post_order(params)
        except Exception as e:
            print(f"Limit sell order error: {e}")
            return None

    def get_open_orders(self):
        params = {"symbol": self.symbol.replace("/", "")}
        return self.exchange.private_get_openorders(params)

    def get_order_book(self, depth=5):
        url = f"{self.testnet_url}/api/v3/depth"
        params = {"symbol": self.symbol.replace("/", ""), "limit": depth}
        resp = requests.get(url, params=params)
        data = resp.json()
        return {
            "bids": [[float(p), float(q)] for p, q in data.get("bids", [])],
            "asks": [[float(p), float(q)] for p, q in data.get("asks", [])],
            "timestamp": data.get("lastUpdateId", 0),
            "datetime": None,
            "nonce": data.get("lastUpdateId", 0),
        }

    def get_recent_trades(self, limit=50):
        url = f"{self.testnet_url}/api/v3/trades"
        params = {"symbol": self.symbol.replace("/", ""), "limit": limit}
        resp = requests.get(url, params=params)
        data = resp.json()
        return [
            {
                "id": t.get("id"),
                "price": float(t.get("price", 0)),
                "amount": float(t.get("qty", 0)),
                "timestamp": t.get("time", 0),
                "side": "buy" if t.get("isBuyerMaker") is False else "sell",
            }
            for t in data
        ]
