import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import YahooFinanceRaw from "yahoo-finance2";
const YahooFinance = (YahooFinanceRaw as any).default || YahooFinanceRaw;
const yahooFinance = new YahooFinance();

// Cache exchange rates to keep responses extremely fast and avoid rate limits
const exchangeRateCache: Record<string, { rate: number; timestamp: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

async function getUsdToInrRate(): Promise<number> {
  const now = Date.now();
  if (exchangeRateCache["USDINR"] && (now - exchangeRateCache["USDINR"].timestamp) < CACHE_TTL) {
    return exchangeRateCache["USDINR"].rate;
  }
  try {
    const q = (await yahooFinance.quote("USDINR=X")) as any;
    const rate = q?.regularMarketPrice ?? 83.5;
    exchangeRateCache["USDINR"] = { rate, timestamp: now };
    return rate;
  } catch (err) {
    console.error("Failed to fetch USDINR for normalization:", err);
    return 83.5;
  }
}

async function getUsdMultiplier(currencyCode: string): Promise<number> {
  const currencyStr = (currencyCode || "USD").toUpperCase();
  if (currencyStr === "USD") return 1.0;
  if (currencyStr === "INR") {
    const rate = await getUsdToInrRate();
    return 1 / rate;
  }
  
  // Cache check for other forex pairs
  const now = Date.now();
  const cacheKey = `${currencyStr}USD`;
  if (exchangeRateCache[cacheKey] && (now - exchangeRateCache[cacheKey].timestamp) < CACHE_TTL) {
    return exchangeRateCache[cacheKey].rate;
  }

  if (currencyStr === "EUR") {
    try {
      const q = (await yahooFinance.quote("EURUSD=X")) as any;
      const rate = q?.regularMarketPrice ?? 1.08;
      exchangeRateCache[cacheKey] = { rate, timestamp: now };
      return rate;
    } catch {
      return 1.08;
    }
  }
  if (currencyStr === "GBP") {
    try {
      const q = (await yahooFinance.quote("GBPUSD=X")) as any;
      const rate = q?.regularMarketPrice ?? 1.27;
      exchangeRateCache[cacheKey] = { rate, timestamp: now };
      return rate;
    } catch {
      return 1.27;
    }
  }
  if (currencyStr === "GBP" || currencyStr === "GBX" || currencyStr === "GBP") { // British pence
    try {
      const q = (await yahooFinance.quote("GBPUSD=X")) as any;
      const rate = (q?.regularMarketPrice ?? 1.27) / 100;
      exchangeRateCache[cacheKey] = { rate, timestamp: now };
      return rate;
    } catch {
      return 1.27 / 100;
    }
  }
  
  return 1.0;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies
  app.use(express.json());

  // 1. Stock Search Endpoint
  app.get("/api/stocks/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim() === "") {
        return res.json({ quotes: [] });
      }

      const result = (await yahooFinance.search(query)) as any;
      
      // Filter out options or focus on main equity indices/stocks/crypto/ETF
      const quotes = (result.quotes || [])
        .filter((q: any) => q.symbol)
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          type: q.quoteType || "EQUITY",
          exchange: q.exchDisp || q.exchange || "Unknown",
        }));

      res.json({ quotes });
    } catch (err: any) {
      console.error("Search error:", err.message);
      res.status(500).json({ error: err.message || "Failed to search ticker" });
    }
  });

  // 2. Multi-Quote Fetching Endpoint
  app.post("/api/stocks/quotes", async (req, res) => {
    try {
      const { symbols } = req.body;
      if (!Array.isArray(symbols)) {
        return res.status(400).json({ error: "symbols must be an array" });
      }

      if (symbols.length === 0) {
        return res.json({});
      }

      // Query each symbol safely
      const quotePromises = symbols.map(async (symbol) => {
        try {
          const q = (await yahooFinance.quote(symbol)) as any;
          const currency = q.currency ?? "USD";
          const mult = await getUsdMultiplier(currency);

          return {
            symbol,
            success: true,
            price: (q.regularMarketPrice ?? 0) * mult,
            change: (q.regularMarketChange ?? 0) * mult,
            changePercent: q.regularMarketChangePercent ?? 0,
            previousClose: (q.regularMarketPreviousClose ?? 0) * mult,
            currency: "USD", // Report as converted USD to keep client-side arithmetic aligned
            originalCurrency: currency,
            longName: q.longName || q.shortName || symbol,
            high: q.regularMarketDayHigh ? q.regularMarketDayHigh * mult : null,
            low: q.regularMarketDayLow ? q.regularMarketDayLow * mult : null,
            open: q.regularMarketOpen ? q.regularMarketOpen * mult : null,
          };
        } catch (err: any) {
          console.error(`Quote match failed for ${symbol}:`, err.message);
          return { symbol, success: false, error: err.message };
        }
      });

      const quotesList = await Promise.all(quotePromises);
      const results: Record<string, any> = {};
      quotesList.forEach((q) => {
         results[q.symbol] = q;
      });

      res.json(results);
    } catch (err: any) {
      console.error("Quotes fetch error:", err.message);
      res.status(500).json({ error: err.message || "Failed to fetch quotes" });
    }
  });

  // 2b. Forex Rates Endpoint
  app.get("/api/forex/rate", async (req, res) => {
    try {
      const q = (await yahooFinance.quote("USDINR=X")) as any;
      const rate = q?.regularMarketPrice ?? 83.5;
      res.json({ rate });
    } catch (err: any) {
      console.error("Forex fetch error:", err.message);
      res.json({ rate: 83.5, error: err.message });
    }
  });

  // 2c. Historical Day Close Price Endpoint (for buy price dynamic synchronization)
  app.get("/api/stocks/historical-price", async (req, res) => {
    try {
      const symbol = (req.query.symbol as string || "").toUpperCase().trim();
      const dateStr = req.query.date as string; // YYYY-MM-DD
      
      if (!symbol || !dateStr) {
        return res.status(400).json({ error: "symbol and date parameters are required" });
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const isLive = dateStr >= todayStr;
      
      let currency = "USD";
      try {
        const q = (await yahooFinance.quote(symbol)) as any;
        currency = q?.currency ?? "USD";
      } catch (e: any) {
        console.error(`Could not resolve currency for ${symbol} on historical lookup:`, e.message);
      }
      const mult = await getUsdMultiplier(currency);

      if (isLive) {
        // Fetch current live price
        try {
          const q = (await yahooFinance.quote(symbol)) as any;
          const price = (q?.regularMarketPrice ?? 0) * mult;
          return res.json({ symbol, date: dateStr, price, isLive: true });
        } catch {
          return res.json({ symbol, date: dateStr, price: 0, isLive: true });
        }
      }

      // Fetch starting from target date, up to 7 days later to capture weekend or market holiday gaps
      const requestedDate = new Date(dateStr);
      const period1 = new Date(requestedDate);
      const period2 = new Date(requestedDate);
      period2.setDate(period2.getDate() + 7);

      const hist = (await yahooFinance.historical(symbol, {
        period1,
        period2,
      })) as any[];

      if (hist && hist.length > 0) {
        // Sort ascending chronologically to get the first trading day on/after requested date
        hist.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const matched = hist[0];
        const price = (matched.close ?? matched.adjClose ?? matched.open ?? 0) * mult;
        return res.json({ symbol, date: dateStr, price, matchedDate: matched.date, isLive: false });
      } else {
        // Attempt fallback to current price
        try {
          const q = (await yahooFinance.quote(symbol)) as any;
          const price = (q?.regularMarketPrice ?? 0) * mult;
          return res.json({ symbol, date: dateStr, price, isFallback: true });
        } catch {
          return res.status(404).json({ error: "No historical record found for this asset" });
        }
      }
    } catch (err: any) {
      console.error("Historical price fetch error:", err.message);
      res.status(500).json({ error: err.message || "Failed to fetch historical price" });
    }
  });

  // 3. Portfolio Historic Valuation Timeline Endpoint (Last 30 Days)
  app.post("/api/stocks/portfolio-history", async (req, res) => {
    try {
      const { holdings } = req.body; // Array of { symbol, qty, buyPrice }
      if (!Array.isArray(holdings)) {
        return res.status(400).json({ error: "holdings must be an array" });
      }

      if (holdings.length === 0) {
        return res.json([]);
      }

      // Range: past 30 days
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const historicalPromises = holdings.map(async (h) => {
        try {
          // Resolve symbol trading currency to translate close prices appropriately to base USD
          let currency = "USD";
          try {
            const q = (await yahooFinance.quote(h.symbol)) as any;
            currency = q?.currency ?? "USD";
          } catch (e: any) {
            console.error(`Could not resolve currency for ${h.symbol}:`, e.message);
          }
          const mult = await getUsdMultiplier(currency);

          const hist = (await yahooFinance.historical(h.symbol, {
            period1: thirtyDaysAgo,
            period2: today,
          })) as any[];

          // Sort ascending chronologically
          hist.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Normalize close price to USD
          const normalizedHist = hist.map((day: any) => ({
            ...day,
            close: (day.close ?? 0) * mult,
          }));

          return {
            symbol: h.symbol,
            success: true,
            data: normalizedHist,
          };
        } catch (err: any) {
          console.error(`Historical fetch failed for ${h.symbol}:`, err.message);
          return { symbol: h.symbol, success: false, data: [] };
        }
      });

      const resolvedHistory = await Promise.all(historicalPromises);

      // Collect all calendar dates present in any response
      const allDatesSet = new Set<string>();
      const dateMap: Record<string, Record<string, number>> = {};

      resolvedHistory.forEach((res) => {
        if (!res.success) return;
        res.data.forEach((day: any) => {
          const dStr = new Date(day.date).toISOString().split("T")[0];
          allDatesSet.add(dStr);
          if (!dateMap[dStr]) {
            dateMap[dStr] = {};
          }
          dateMap[dStr][res.symbol] = day.close;
        });
      });

      const sortedDates = Array.from(allDatesSet).sort();

      // Tracker of the last known price to fill holiday and weekend gaps
      const lastPriceLookup: Record<string, number> = {};
      holdings.forEach((h) => {
        lastPriceLookup[h.symbol] = h.buyPrice; // initial default
      });

      const timeline = sortedDates.map((dStr) => {
        let totalValue = 0;
        let totalCost = 0;

        holdings.forEach((h) => {
          const key = h.symbol;
          if (dateMap[dStr] && dateMap[dStr][key] !== undefined) {
            lastPriceLookup[key] = dateMap[dStr][key];
          }
          
          // Only include holding inside the active portfolio valuation timeline ON or AFTER its specific purchase date
          if (h.buyDate) {
            const dateOnly_buyDate = h.buyDate.split("T")[0];
            if (dStr < dateOnly_buyDate) {
              return; // Has not been purchased yet as of this historical day
            }
          }

          const price = lastPriceLookup[key];
          totalValue += price * h.qty;
          totalCost += h.buyPrice * h.qty;
        });

        const gainLoss = totalValue - totalCost;
        const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

        return {
          date: dStr,
          value: parseFloat(totalValue.toFixed(2)),
          cost: parseFloat(totalCost.toFixed(2)),
          gainLoss: parseFloat(gainLoss.toFixed(2)),
          gainLossPercent: parseFloat(gainLossPercent.toFixed(2)),
        };
      });

      res.json(timeline);
    } catch (err: any) {
      console.error("Portfolio history aggregation error:", err.message);
      res.status(500).json({ error: err.message || "Failed to compute history" });
    }
  });

  // Serve static files / Vite HMR integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Portfolio Tracker backend online listening on port ${PORT}`);
  });
}

startServer();
