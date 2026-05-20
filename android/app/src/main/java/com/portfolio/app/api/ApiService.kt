package com.portfolio.app.api

import com.portfolio.app.types.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface ApiService {

    @POST("api/stocks/quotes")
    suspend fun getQuotes(
        @Body request: Map<String, List<String>>
    ): Response<Map<String, QuoteData>>

    @GET("api/forex/rate")
    suspend fun getForexRate(): Response<ForexRateResponse>

    @GET("api/stocks/historical-price")
    suspend fun getHistoricalPrice(
        @Query("symbol") symbol: String,
        @Query("date") date: String
    ): Response<HistoricalPriceResponse>

    @POST("api/stocks/portfolio-history")
    suspend fun getPortfolioHistory(
        @Body request: Map<String, List<Holding>>
    ): Response<List<HistoryPoint>>
}
