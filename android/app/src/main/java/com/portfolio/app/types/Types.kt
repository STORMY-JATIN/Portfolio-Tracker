package com.portfolio.app.types

import java.util.UUID

data class Holding(
    val id: String = UUID.randomUUID().toString(),
    val symbol: String,
    val qty: Double,
    val buyPrice: Double, // Always stored in USD internally, similar to web app
    val buyDate: String? = null,
    val notes: String? = null
)

data class QuoteData(
    val symbol: String,
    val success: Boolean,
    val price: Double,
    val change: Double,
    val changePercent: Double,
    val previousClose: Double,
    val currency: String,
    val longName: String,
    val high: Double? = null,
    val low: Double? = null,
    val open: Double? = null,
    val error: String? = null
)

data class QuoteResponse(
    val quotes: Map<String, QuoteData>
)

data class ForexRateResponse(
    val symbol: String = "USDINR",
    val rate: Double
)

data class HistoricalPriceResponse(
    val symbol: String,
    val date: String,
    val price: Double,
    val matchedDate: String? = null,
    val isLive: Boolean
)

data class HistoryPoint(
    val date: String,
    val value: Double,
    val cost: Double,
    val gainLoss: Double,
    val gainLossPercent: Double
)
