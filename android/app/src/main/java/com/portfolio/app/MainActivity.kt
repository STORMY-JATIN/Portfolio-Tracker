package com.portfolio.app

import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.portfolio.app.api.ApiService
import com.portfolio.app.types.Holding
import com.portfolio.app.types.QuoteData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : ComponentActivity() {

    // Configured live backend endpoint URL
    private val BASE_URL = "https://ais-dev-px6sxebnfvd24cemfnoq6z-487077048319.asia-east1.run.app/"

    private lateinit var apiService: ApiService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize Retrofit Safely
        val retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        apiService = retrofit.create(ApiService::class.java)

        setContent {
            SlatePortfolioAppTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF0A0A0B) // Match Web App Dark Obsidian background
                ) {
                    PortfolioDashboard(
                        apiService = apiService,
                        onShowToast = { msg ->
                            Toast.makeText(this@MainActivity, msg, Toast.LENGTH_SHORT).show()
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun SlatePortfolioAppTheme(content: @Composable () -> Unit) {
    val darkColorScheme = darkColorScheme(
        primary = Color(0xFF10B981), // Emerald-500 matching target accents
        background = Color(0xFF0A0A0B),
        surface = Color(0xFF161618),
        onPrimary = Color.Black,
        onBackground = Color.White,
        onSurface = Color.White
    )
    MaterialTheme(
        colorScheme = darkColorScheme,
        content = content
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PortfolioDashboard(
    apiService: ApiService,
    onShowToast: (String) -> Unit
) {
    // Client-side local persistence list simulated
    var holdings by remember {
        mutableStateOf(
            listOf(
                Holding(symbol = "AAPL", qty = 15.0, buyPrice = 175.0, buyDate = "2026-05-01", notes = "Long-term Apple holding"),
                Holding(symbol = "MSFT", qty = 10.0, buyPrice = 415.0, buyDate = "2026-05-10", notes = "Cloud productivity growth"),
                Holding(symbol = "BTC-USD", qty = 0.5, buyPrice = 62000.0, buyDate = "2026-05-15", notes = "Crypto hedge asset"),
            )
        )
    }

    var quotes by remember { mutableStateOf<Map<String, QuoteData>>(emptyMap()) }
    var usdToInrRate by remember { mutableStateOf(83.5) }
    var usdOrInr by remember { mutableStateOf("USD") } // USD or INR
    var isRefreshing by remember { mutableStateOf(false) }

    // Forms State
    var showAddForm by remember { mutableStateOf(false) }
    var formSymbol by remember { mutableStateOf("") }
    var formQty by remember { mutableStateOf("") }
    var formBuyPrice by remember { mutableStateOf("") }
    var formBuyDate by remember { mutableStateOf("") }
    var formNotes by remember { mutableStateOf("") }
    var isFetchingHistoricPrice by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()
    val exchangeRate = if (usdOrInr == "INR") usdToInrRate else 1.0

    // Fetch Rates & Quotes
    val syncData = {
        isRefreshing = true
        scope.launch(Dispatchers.IO) {
            try {
                // 1. Fetch live Forex rate
                val forexRes = apiService.getForexRate()
                if (forexRes.isSuccessful && forexRes.body() != null) {
                    usdToInrRate = forexRes.body()!!.rate
                }

                // 2. Fetch Stock Quotes
                val symbolsList = holdings.map { it.symbol.uppercase() }.distinct()
                if (symbolsList.isNotEmpty()) {
                    val quotesRes = apiService.getQuotes(mapOf("symbols" to symbolsList))
                    if (quotesRes.isSuccessful && quotesRes.body() != null) {
                        quotes = quotesRes.body()!!
                    }
                }
                withContext(Dispatchers.Main) {
                    onShowToast("Synced real-time prices & forex rate")
                }
            } catch (e: Exception) {
                Log.e("PortfolioDashboard", "Sync error", e)
                withContext(Dispatchers.Main) {
                    onShowToast("Sync failed: Check network connectivity")
                }
            } finally {
                isRefreshing = false
            }
        }
    }

    // Initialize/Sync on load
    LaunchedEffect(holdings) {
        syncData()
    }

    // Auto sync dynamic price details when ticker selection or date is updated
    LaunchedEffect(formSymbol, formBuyDate) {
        if (formSymbol.trim().length >= 2 && formBuyDate.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) {
            isFetchingHistoricPrice = true
            scope.launch(Dispatchers.IO) {
                try {
                    val res = apiService.getHistoricalPrice(formSymbol.trim().uppercase(), formBuyDate)
                    if (res.isSuccessful && res.body() != null) {
                        val body = res.body()!!
                        withContext(Dispatchers.Main) {
                            formBuyPrice = String.format(Locale.US, "%.2f", body.price)
                            onShowToast("Synced historic price for $formSymbol on $formBuyDate!")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("PortfolioDashboard", "Failed lookup date price", e)
                } finally {
                    isFetchingHistoricPrice = false
                }
            }
        }
    }

    // Calculated Aggregation States
    val aggregateMetrics = remember(holdings, quotes, exchangeRate) {
        var totalCostBasis = 0.0
        var totalCurrentValue = 0.0

        for (h in holdings) {
            val cost = h.qty * h.buyPrice
            totalCostBasis += cost

            val quote = quotes[h.symbol.uppercase()]
            val currentPrice = if (quote != null && quote.success) quote.price else h.buyPrice
            totalCurrentValue += h.qty * currentPrice
        }

        val gainLoss = totalCurrentValue - totalCostBasis
        val gainLossPercent = if (totalCostBasis > 0) (gainLoss / totalCostBasis) * 100.0 else 0.0

        Triple(totalCurrentValue, totalCostBasis, Pair(gainLoss, gainLossPercent))
    }

    val (currentVal, costBasis, profitLoss) = aggregateMetrics

    Scaffold(
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF0A0A0B))
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween, // <--- FIXED HERE
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Slate Portfolio",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.SansSerif
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(if (isRefreshing) Color.Yellow else Color(0xFF10B981))
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (isRefreshing) "Refreshing..." else "Synced Live",
                                color = Color(0xFFA1A1AA),
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    // Currency Switcher Row
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF161618))
                            .border(1.dp, Color(0xFF27272A), RoundedCornerShape(8.dp))
                            .padding(2.dp)
                    ) {
                        listOf("USD", "INR").forEach { cur ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(if (usdOrInr == cur) Color(0xFF27272A) else Color.Transparent)
                                    .clickable { usdOrInr = cur }
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = cur,
                                    color = if (usdOrInr == cur) Color.White else Color(0xFF71717A),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    IconButton(
                        onClick = { syncData() },
                        modifier = Modifier
                            .background(Color(0xFF161618), RoundedCornerShape(8.dp))
                            .size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Refresh Price",
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showAddForm = !showAddForm },
                containerColor = Color.White,
                contentColor = Color.Black,
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(
                    imageVector = if (showAddForm) Icons.Default.Close else Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = if (showAddForm) "Close Panel" else "Add Asset",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // METRICS CARD SECTION
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFF161618))
                        .border(1.dp, Color(0xFF27272A), RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Text(
                        text = "TOTAL PORTFOLIO VALUE",
                        color = Color(0xFFA1A1AA),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.SansSerif,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = formatCurrency(currentVal * exchangeRate, usdOrInr),
                        color = Color.White,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = FontFamily.SansSerif
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("COST BASIS", color = Color(0xFF71717A), fontSize = 9.sp)
                            Text(
                                text = formatCurrency(costBasis * exchangeRate, usdOrInr),
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text("RETURNS", color = Color(0xFF71717A), fontSize = 9.sp)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                val profit = profitLoss.first
                                val isGain = profit >= 0
                                Icon(
                                    imageVector = if (isGain) Icons.Default.TrendingUp else Icons.Default.ArrowDownward,
                                    contentDescription = null,
                                    tint = if (isGain) Color(0xFF10B981) else Color(0xFFEF4444),
                                    modifier = Modifier.size(13.dp)
                                )
                                Spacer(modifier = Modifier.width(3.dp))
                                Text(
                                    text = "${if (isGain) "+" else ""}${formatCurrency(profit * exchangeRate, usdOrInr)} (${String.format("%.2f", profitLoss.second)}%)",
                                    color = if (isGain) Color(0xFF10B981) else Color(0xFFEF4444),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }
            }

            // ADD ASSET FOLD-DOWN FORM
            item {
                AnimatedVisibility(
                    visible = showAddForm,
                    enter = expandVertically() + fadeIn(),
                    exit = shrinkVertically() + fadeOut()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF111113))
                            .border(1.dp, Color(0xFF27272A), RoundedCornerShape(12.dp))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "LOG NEW PURCHASE",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        )

                        // Symbol input
                        OutlinedTextField(
                            value = formSymbol,
                            onValueChange = { formSymbol = it },
                            label = { Text("Ticker Symbol (e.g. AAPL)", fontSize = 11.sp) },
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp, color = Color.White, fontFamily = FontFamily.Monospace),
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                focusedBorderColor = Color(0xFF10B981),
                                unfocusedBorderColor = Color(0xFF27272A)
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        // Quantity input
                        OutlinedTextField(
                            value = formQty,
                            onValueChange = { formQty = it },
                            label = { Text("Quantity", fontSize = 11.sp) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp, color = Color.White, fontFamily = FontFamily.Monospace),
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                focusedBorderColor = Color(0xFF10B981),
                                unfocusedBorderColor = Color(0xFF27272A)
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        // Date selection
                        OutlinedTextField(
                            value = formBuyDate,
                            onValueChange = { formBuyDate = it },
                            placeholder = { Text("YYYY-MM-DD (e.g., 2026-05-18)") },
                            label = { Text("Purchase Date (Required for Price Sync)", fontSize = 11.sp) },
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp, color = Color.White, fontFamily = FontFamily.Monospace),
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                focusedBorderColor = Color(0xFF10B981),
                                unfocusedBorderColor = Color(0xFF27272A)
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        // Price Input
                        Box(modifier = Modifier.fillMaxWidth()) {
                            OutlinedTextField(
                                value = formBuyPrice,
                                onValueChange = { formBuyPrice = it },
                                label = {
                                    Text(
                                        text = if (isFetchingHistoricPrice) "Syncing Historic Price..." else "Buy Price per Share (USD)",
                                        fontSize = 11.sp,
                                        color = if (isFetchingHistoricPrice) Color(0xFF10B981) else Color.White
                                    )
                                },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp, color = Color.White, fontFamily = FontFamily.Monospace),
                                colors = TextFieldDefaults.outlinedTextFieldColors(
                                    focusedBorderColor = Color(0xFF10B981),
                                    unfocusedBorderColor = Color(0xFF27272A)
                                ),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            if (isFetchingHistoricPrice) {
                                CircularProgressIndicator(
                                    modifier = Modifier
                                        .size(16.dp)
                                        .align(Alignment.CenterEnd)
                                        .padding(end = 16.dp),
                                    color = Color(0xFF10B981),
                                    strokeWidth = 2.dp
                                )
                            }
                        }

                        // Notes Field
                        OutlinedTextField(
                            value = formNotes,
                            onValueChange = { formNotes = it },
                            label = { Text("Transaction Notes/Memo", fontSize = 11.sp) },
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp, color = Color.White),
                            colors = TextFieldDefaults.outlinedTextFieldColors(
                                focusedBorderColor = Color(0xFF10B981),
                                unfocusedBorderColor = Color(0xFF27272A)
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        // Submit Button
                        Button(
                            onClick = {
                                val symbolClean = formSymbol.trim().uppercase()
                                val qtyDouble = formQty.toDoubleOrNull() ?: 0.0
                                val buyPriceDouble = formBuyPrice.toDoubleOrNull() ?: 0.0

                                if (symbolClean.isEmpty() || qtyDouble <= 0 || buyPriceDouble <= 0) {
                                    onShowToast("Please fill valid Ticker, Quantity and Purchase Price parameters.")
                                    return@Button
                                }

                                val newHolding = Holding(
                                    symbol = symbolClean,
                                    qty = qtyDouble,
                                    buyPrice = buyPriceDouble,
                                    buyDate = formBuyDate.ifEmpty { null },
                                    notes = formNotes.ifEmpty { null }
                                )

                                holdings = holdings + newHolding
                                onShowToast("Added $symbolClean to portfolio!")

                                // Reset form values
                                formSymbol = ""
                                formQty = ""
                                formBuyPrice = ""
                                formBuyDate = ""
                                formNotes = ""
                                showAddForm = false
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color.White,
                                contentColor = Color.Black
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("SAVE TO PORTFOLIO", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // HOLDINGS TITLE STAMP
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "YOUR HOLDINGS (${holdings.size})",
                        color = Color(0xFFA1A1AA),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                }
            }

            // INDIVIDUAL HOLDINGS RENDERING CARD ROW
            if (holdings.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "No assets logged in portfolio yet",
                            color = Color(0xFF71717A),
                            fontSize = 12.sp
                        )
                    }
                }
            } else {
                items(holdings) { holding ->
                    HoldingItemCard(
                        holding = holding,
                        quote = quotes[holding.symbol.uppercase()],
                        exchangeRate = exchangeRate,
                        currency = usdOrInr,
                        onDeleteClick = {
                            holdings = holdings.filter { it.id != holding.id }
                            onShowToast("Archived position ${holding.symbol}")
                        }
                    )
                }
            }

            // Spacer bottom
            item {
                Spacer(modifier = Modifier.height(80.dp))
            }
        }
    }
}

@Composable
fun HoldingItemCard(
    holding: Holding,
    quote: QuoteData?,
    exchangeRate: Double,
    currency: String,
    onDeleteClick: () -> Unit
) {
    val livePrice = if (quote != null && quote.success) quote.price else holding.buyPrice
    val totalCost = holding.qty * holding.buyPrice
    val totalValueVal = holding.qty * livePrice

    val currentGain = totalValueVal - totalCost
    val currentGainPercent = if (totalCost > 0) (currentGain / totalCost) * 100 else 0.0
    val isProfit = currentGain >= 0

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF161618))
            .border(1.dp, Color(0xFF27272A), RoundedCornerShape(12.dp))
            .padding(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = holding.symbol.uppercase(),
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = Color.White,
                        fontFamily = FontFamily.Monospace
                    )
                    if (quote != null && quote.success) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(
                                    if (quote.changePercent >= 0) Color(0xFF10B981).copy(alpha = 0.15f)
                                    else Color(0xFFEF4444).copy(alpha = 0.15f)
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "${if (quote.changePercent >= 0) "+" else ""}${String.format("%.2f", quote.changePercent)}%",
                                color = if (quote.changePercent >= 0) Color(0xFF10B981) else Color(0xFFEF4444),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(2.dp))
                if (quote?.longName != null) {
                    Text(
                        text = quote.longName,
                        color = Color(0xFFA1A1AA),
                        fontSize = 10.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatCurrency(totalValueVal * exchangeRate, currency),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "${holding.qty} Shares",
                    color = Color(0xFF71717A),
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        Divider(
            modifier = Modifier.padding(vertical = 10.dp),
            color = Color(0xFF27272A)
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "ACQUISITION COST",
                    color = Color(0xFF71717A),
                    fontSize = 8.sp,
                    letterSpacing = 0.5.sp
                )
                Text(
                    text = "${formatCurrency(holding.buyPrice * exchangeRate, currency)} avg",
                    color = Color(0xFFA1A1AA),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    fontFamily = FontFamily.Monospace
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "UNREALIZED RETURN",
                    color = Color(0xFF71717A),
                    fontSize = 8.sp,
                    letterSpacing = 0.5.sp
                )
                Text(
                    text = "${if (isProfit) "+" else ""}${formatCurrency(currentGain * exchangeRate, currency)} (${String.format("%.2f", currentGainPercent)}%)",
                    color = if (isProfit) Color(0xFF10B981) else Color(0xFFEF4444),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        if (!holding.notes.isNullOrEmpty() || !holding.buyDate.isNullOrEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color(0xFF0D0D0E))
                    .padding(8.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = holding.notes ?: "No transaction notes",
                    color = Color(0xFF52525B),
                    fontSize = 9.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (!holding.buyDate.isNullOrEmpty()) {
                    Text(
                        text = holding.buyDate,
                        color = Color(0xFF52525B),
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(6.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            Text(
                text = "Remove Position",
                color = Color(0xFFEF4444),
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clickable { onDeleteClick() }
                    .padding(vertical = 4.dp, horizontal = 8.dp)
            )
        }
    }
}

fun formatCurrency(value: Double, currency: String): String {
    val symbol = if (currency == "INR") "₹" else "$"
    return String.format(Locale.getDefault(), "%s%,.2f", symbol, value)
}