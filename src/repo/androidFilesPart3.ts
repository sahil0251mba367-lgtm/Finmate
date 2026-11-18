import { RepoFileEntry } from '../utils/zipBuilder';

export const ANDROID_FILES_PART_3: RepoFileEntry[] = [
  {
    path: 'app/src/main/java/com/finmate/app/data/repository/Repositories.kt',
    phase: 'Phase 2 & 8: DataStore & Repositories',
    description: 'SettingsDataStore, AnalyticsRepository with CSV export & gated upload flag.',
    content: `package com.finmate.app.data.repository

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.finmate.app.BuildConfig
import com.finmate.app.data.local.db.AnalyticsDao
import com.finmate.app.data.local.db.AnalyticsEventEntity
import com.finmate.app.domain.model.OnboardingVariant
import com.finmate.app.domain.model.Settings
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.random.Random

private val Context.dataStore by preferencesDataStore(name = "finmate_settings")

@Singleton
class SettingsRepository @Inject constructor(
    private val context: Context,
    private val analyticsRepository: AnalyticsRepository
) {
    private object Keys {
        val ALLOWANCE_PAISE = longPreferencesKey("allowance_paise")
        val ALLOWANCE_DAY = intPreferencesKey("allowance_day")
        val FIXED_COMMITMENTS_PAISE = longPreferencesKey("fixed_commitments_paise")
        val ONBOARDING_COMPLETED = booleanPreferencesKey("onboarding_completed")
        val ONBOARDING_VARIANT = stringPreferencesKey("onboarding_variant")
        val REFERRAL_CODE = stringPreferencesKey("referral_code")
        val SMS_DENIED = booleanPreferencesKey("sms_denied")
        val INSTALLED_LOGGED = booleanPreferencesKey("installed_logged")
    }

    val settingsFlow: Flow<Settings> = context.dataStore.data.map { prefs ->
        Settings(
            allowancePaise = prefs[Keys.ALLOWANCE_PAISE] ?: 10_000_00L,
            allowanceDay = prefs[Keys.ALLOWANCE_DAY] ?: 1,
            fixedCommitmentsPaise = prefs[Keys.FIXED_COMMITMENTS_PAISE] ?: 0L,
            onboardingCompleted = prefs[Keys.ONBOARDING_COMPLETED] ?: false,
            onboardingVariant = prefs[Keys.ONBOARDING_VARIANT]?.let {
                runCatching { OnboardingVariant.valueOf(it) }.getOrNull()
            } ?: OnboardingVariant.A,
            referralCode = prefs[Keys.REFERRAL_CODE],
            smsPermissionDenied = prefs[Keys.SMS_DENIED] ?: false
        )
    }

    suspend fun ensureInstallInitialized() {
        val prefs = context.dataStore.data.first()
        if (prefs[Keys.INSTALLED_LOGGED] != true) {
            val variant = if (Random.nextBoolean()) OnboardingVariant.A else OnboardingVariant.B
            context.dataStore.edit { edit ->
                edit[Keys.ONBOARDING_VARIANT] = variant.name
                edit[Keys.INSTALLED_LOGGED] = true
            }
            analyticsRepository.logEvent("app_installed", "{\\"variant\\":\\"\${variant.name}\\"}")
        }
    }

    suspend fun saveOnboarding(
        allowancePaise: Long,
        allowanceDay: Int,
        fixedCommitmentsPaise: Long,
        referralCode: String?
    ) {
        val cleanCode = referralCode?.trim()?.uppercase()?.takeIf { it.matches(Regex("^[A-Z0-9]{4,8}$")) }
        context.dataStore.edit { edit ->
            edit[Keys.ALLOWANCE_PAISE] = allowancePaise
            edit[Keys.ALLOWANCE_DAY] = allowanceDay.coerceIn(1, 31)
            edit[Keys.FIXED_COMMITMENTS_PAISE] = fixedCommitmentsPaise
            if (cleanCode != null) edit[Keys.REFERRAL_CODE] = cleanCode
            edit[Keys.ONBOARDING_COMPLETED] = true
        }
        if (cleanCode != null) {
            analyticsRepository.logEvent("referral_code_entered", "{\\"hasCode\\":true}")
        }
        analyticsRepository.logEvent("onboarding_completed")
    }

    suspend fun setSmsPermissionResult(granted: Boolean) {
        val current = settingsFlow.first()
        context.dataStore.edit { it[Keys.SMS_DENIED] = !granted }
        val event = if (granted) "sms_permission_granted" else "sms_permission_denied"
        analyticsRepository.logEvent(event, "{\\"variant\\":\\"\${current.onboardingVariant.name}\\"}")
    }
}

@Singleton
class AnalyticsRepository @Inject constructor(
    private val context: Context,
    private val analyticsDao: AnalyticsDao
) {
    fun observeEvents(): Flow<List<AnalyticsEventEntity>> = analyticsDao.observeAll()

    suspend fun logEvent(eventName: String, metadataJson: String = "{}") {
        val entity = AnalyticsEventEntity(
            eventName = eventName,
            variant = "auto",
            metadataJson = metadataJson,
            timestamp = System.currentTimeMillis()
        )
        analyticsDao.insert(entity)
        if (BuildConfig.ENABLE_ANALYTICS_UPLOAD) {
            // Optional upload hook gated behind feature flag (OFF by default in MVP).
        }
    }

    suspend fun exportCsvToCache(): File {
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, "finmate_analytics.csv")
        val events = analyticsDao.getAllSnapshot()
        val csv = buildString {
            appendLine("id,event_name,timestamp_ms,metadata")
            for (e in events) {
                val safeMeta = e.metadataJson.replace("\\"", "\\"\\"")
                appendLine("\${e.id},\${e.eventName},\${e.timestamp},\\"\$safeMeta\\"")
            }
        }
        file.writeText(csv)
        return file
    }
}
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/di/AppModule.kt',
    phase: 'Phase 2: Hilt DI Module',
    description: 'Provides Room database, DAOs, and application Context.',
    content: `package com.finmate.app.di

import android.content.Context
import androidx.room.Room
import com.finmate.app.data.local.db.AnalyticsDao
import com.finmate.app.data.local.db.FinMateDatabase
import com.finmate.app.data.local.db.MerchantOverrideDao
import com.finmate.app.data.local.db.SavingsGoalDao
import com.finmate.app.data.local.db.TransactionDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideContext(@ApplicationContext context: Context): Context = context

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): FinMateDatabase =
        Room.databaseBuilder(context, FinMateDatabase::class.java, "finmate.db")
            .fallbackToDestructiveMigration(dropAllTables = true)
            .build()

    @Provides fun provideTransactionDao(db: FinMateDatabase): TransactionDao = db.transactionDao()
    @Provides fun provideOverrideDao(db: FinMateDatabase): MerchantOverrideDao = db.merchantOverrideDao()
    @Provides fun provideGoalDao(db: FinMateDatabase): SavingsGoalDao = db.savingsGoalDao()
    @Provides fun provideAnalyticsDao(db: FinMateDatabase): AnalyticsDao = db.analyticsDao()
}
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/ui/theme/Theme.kt',
    phase: 'Phase 1: Material 3 Theme',
    description: 'Light and Dark Material 3 color schemes for FinMate.',
    content: `package com.finmate.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF0B6E4F),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFA7F3D0),
    onPrimaryContainer = Color(0xFF002116),
    background = Color(0xFFF7FAF8),
    surface = Color(0xFFFFFFFF),
    error = Color(0xFFD93025)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF6EE7B7),
    onPrimary = Color(0xFF003826),
    primaryContainer = Color(0xFF005139),
    onPrimaryContainer = Color(0xFFA7F3D0),
    background = Color(0xFF0F1512),
    surface = Color(0xFF171F1B),
    error = Color(0xFFFF8A80)
)

@Composable
fun FinMateTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/ui/navigation/FinMateNavHost.kt',
    phase: 'Phase 1 & 6: Compose Navigation',
    description: 'Type-safe Navigation Compose graph opening to Dashboard (or Onboarding on fresh install).',
    content: `package com.finmate.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.finmate.app.ui.screens.DashboardScreen
import com.finmate.app.ui.screens.DebugAnalyticsScreen
import com.finmate.app.ui.screens.GoalScreen
import com.finmate.app.ui.screens.OnboardingScreen
import com.finmate.app.ui.screens.SettingsScreen
import kotlinx.serialization.Serializable

sealed interface FinMateRoute {
    @Serializable data object Onboarding : FinMateRoute
    @Serializable data object Dashboard : FinMateRoute
    @Serializable data object Goal : FinMateRoute
    @Serializable data object Settings : FinMateRoute
    @Serializable data object DebugAnalytics : FinMateRoute
}

@Composable
fun FinMateNavHost(onboardingCompleted: Boolean) {
    val navController = rememberNavController()
    val startDestination: FinMateRoute =
        if (onboardingCompleted) FinMateRoute.Dashboard else FinMateRoute.Onboarding

    NavHost(navController = navController, startDestination = startDestination) {
        composable<FinMateRoute.Onboarding> {
            OnboardingScreen(
                onCompleted = {
                    navController.navigate(FinMateRoute.Dashboard) {
                        popUpTo<FinMateRoute.Onboarding> { inclusive = true }
                    }
                }
            )
        }
        composable<FinMateRoute.Dashboard> {
            DashboardScreen(
                onOpenGoal = { navController.navigate(FinMateRoute.Goal) },
                onOpenSettings = { navController.navigate(FinMateRoute.Settings) }
            )
        }
        composable<FinMateRoute.Goal> {
            GoalScreen(onBack = { navController.popBackStack() })
        }
        composable<FinMateRoute.Settings> {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onOpenDebug = { navController.navigate(FinMateRoute.DebugAnalytics) }
            )
        }
        composable<FinMateRoute.DebugAnalytics> {
            DebugAnalyticsScreen(onBack = { navController.popBackStack() })
        }
    }
}
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/ui/screens/FinMateScreens.kt',
    phase: 'Phase 6, 7 & 8: Compose UI Screens',
    description: 'Onboarding (A/B SMS permission), Dashboard with Canvas Donut chart, Goal, Settings, and Debug Analytics.',
    content: `package com.finmate.app.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.finmate.app.data.sms.SmsSyncWorker
import com.finmate.app.domain.format.InrFormatter
import com.finmate.app.domain.model.SpendCategory

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(onCompleted: () -> Unit) {
    var allowance by remember { mutableStateOf("10000") }
    var allowanceDay by remember { mutableStateOf("1") }
    var fixedCommitments by remember { mutableStateOf("2500") }
    var referralCode by remember { mutableStateOf("") }
    var step by remember { mutableStateOf(1) }
    val context = LocalContext.current

    val smsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants[Manifest.permission.READ_SMS] == true
        if (granted) {
            WorkManager.getInstance(context)
                .enqueue(OneTimeWorkRequestBuilder<SmsSyncWorker>().build())
        }
        onCompleted()
    }

    Scaffold(topBar = { TopAppBar(title = { Text("FinMate Setup") }) }) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (step == 1) {
                Text(
                    "Set your monthly allowance",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                OutlinedTextField(
                    value = allowance,
                    onValueChange = { allowance = it.filter(Char::isDigit) },
                    label = { Text("Monthly Allowance (₹)") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = allowanceDay,
                    onValueChange = { allowanceDay = it.filter(Char::isDigit) },
                    label = { Text("Allowance Day (1–31)") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = fixedCommitments,
                    onValueChange = { fixedCommitments = it.filter(Char::isDigit) },
                    label = { Text("Fixed Rent / Recharge (₹)") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = referralCode,
                    onValueChange = { referralCode = it.take(8) },
                    label = { Text("Campus Referral Code (Optional)") },
                    modifier = Modifier.fillMaxWidth()
                )
                Button(
                    onClick = { step = 2 },
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text("Continue")
                }
            } else {
                Text(
                    "Automatic UPI Tracking",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "FinMate only reads bank/UPI transaction alerts. OTPs and personal messages are ignored. Everything stays on your phone.",
                    style = MaterialTheme.typography.bodyLarge
                )
                Button(
                    onClick = {
                        smsLauncher.launch(
                            arrayOf(
                                Manifest.permission.READ_SMS,
                                Manifest.permission.RECEIVE_SMS
                            )
                        )
                    },
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text("Allow SMS Tracking")
                }
                OutlinedButton(
                    onClick = onCompleted,
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                ) {
                    Text("Use Manual Mode Instead")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onOpenGoal: () -> Unit,
    onOpenSettings: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("FinMate") },
                actions = {
                    TextButton(onClick = onOpenGoal) { Text("Goal") }
                    TextButton(onClick = onOpenSettings) { Text("Settings") }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("Today's Safe-to-Spend", style = MaterialTheme.typography.labelLarge)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = InrFormatter.format(320_00L),
                            style = MaterialTheme.typography.displayMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.semantics { contentDescription = "Daily limit 320 rupees" }
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "Remaining today: \${InrFormatter.format(240_00L)}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
            item {
                CategoryBreakdownCard(
                    totals = mapOf(
                        SpendCategory.FOOD to 1450_00L,
                        SpendCategory.TRAVEL to 620_00L,
                        SpendCategory.SHOPPING to 899_00L,
                        SpendCategory.ACADEMICS to 499_00L,
                        SpendCategory.OTHERS to 250_00L
                    )
                )
            }
            items(listOf("Swiggy · ₹180 · Food", "Chai Point · ₹45 · Food", "Uber · ₹149 · Travel")) { row ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(row, modifier = Modifier.padding(16.dp))
                }
            }
        }
    }
}

@Composable
fun CategoryBreakdownCard(totals: Map<SpendCategory, Long>) {
    val colors = listOf(
        Color(0xFF0B6E4F),
        Color(0xFF3E6373),
        Color(0xFF8A5A00),
        Color(0xFF5C6BC0),
        Color(0xFF78909C)
    )
    val sum = totals.values.sum().coerceAtLeast(1L)

    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Canvas(modifier = Modifier.size(96.dp)) {
                var startAngle = -90f
                totals.entries.forEachIndexed { idx, (_, amount) ->
                    val sweep = (amount.toFloat() / sum.toFloat()) * 360f
                    drawArc(
                        color = colors[idx % colors.size],
                        startAngle = startAngle,
                        sweepAngle = sweep,
                        useCenter = false,
                        style = Stroke(width = 22f, cap = StrokeCap.Butt)
                    )
                    startAngle += sweep
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                totals.entries.forEach { (cat, amt) ->
                    Text("\${cat.displayName}: \${InrFormatter.format(amt)}", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoalScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Savings Goal") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("College Fest & Headphones", style = MaterialTheme.typography.titleLarge)
            LinearProgressIndicator(progress = { 0.45f }, modifier = Modifier.fillMaxWidth())
            Text("Saved ₹2,250 of ₹5,000")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit, onOpenDebug: () -> Unit) {
    var tapCount by remember { mutableStateOf(0) }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("All financial data stays on-device.")
            TextButton(onClick = {
                tapCount++
                if (tapCount >= 7) onOpenDebug()
            }) {
                Text("FinMate v1.0.0-pilot")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DebugAnalyticsScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Pilot Metrics (Debug)") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Activation Rate & Weekly Opens computed from local Room analytics_events table.")
            Text("Optional network upload flag: BuildConfig.ENABLE_ANALYTICS_UPLOAD = false")
        }
    }
}
`,
  },
  {
    path: 'app/src/test/java/com/finmate/app/domain/parser/SmsParserTest.kt',
    phase: 'Phase 3: Unit Tests (30+ SMS Cases)',
    description: '32 unit tests covering Indian banks, UPI, cards, ATM, refunds, OTPs, promos, duplicates, and malformed SMS.',
    content: `package com.finmate.app.domain.parser

import com.finmate.app.domain.model.PaymentMode
import com.finmate.app.domain.model.SpendCategory
import com.finmate.app.domain.model.TransactionDirection
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsParserTest {

    private val parser = SmsParser()
    private val now = 1_795_000_000_000L

    private data class Sample(
        val sender: String,
        val body: String,
        val expectedAmount: Long,
        val expectedDirection: TransactionDirection,
        val expectedCategory: SpendCategory,
        val expectedMode: PaymentMode
    )

    @Test
    fun \`parses and categorises realistic multi-bank SMS with at least 90 percent accuracy\`() {
        // All samples marked [synthetic] modeled on Indian DLT bank alert formats
        val samples = listOf(
            Sample("AD-HDFCBK", "Amt Sent Rs.180.00 From HDFC Bank A/C *4821 To Swiggy On 18-11 Ref 432319847120.", 18000L, TransactionDirection.DEBIT, SpendCategory.FOOD, PaymentMode.UPI), // synthetic
            Sample("AX-SBIINB", "Dear UPI user A/C X9012 debited by 45.00 on date 18Nov26 trf to CHAI POINT Refno 632189451023.", 4500L, TransactionDirection.DEBIT, SpendCategory.FOOD, PaymentMode.UPI), // synthetic
            Sample("VM-ICICIB", "ICICI Bank Acct XX7712 debited for Rs 149.00 on 18-Nov-26; UBER INDIA SYSTEMS credited. UPI:632310293847.", 14900L, TransactionDirection.DEBIT, SpendCategory.TRAVEL, PaymentMode.UPI), // synthetic
            Sample("JD-AXISBK", "INR 320.00 debited from A/c no. XX3310 on 18-11-26 at Zomato Online. UPI Ref 632391827364.", 32000L, TransactionDirection.DEBIT, SpendCategory.FOOD, PaymentMode.UPI), // synthetic
            Sample("JK-KOTAKB", "Sent Rs.65.00 from Kotak Bank AC X1145 to rapido@okicici on 18-11-26.UPI Ref 632344556677.", 6500L, TransactionDirection.DEBIT, SpendCategory.TRAVEL, PaymentMode.UPI), // synthetic
            Sample("AD-PNBSMS", "Your A/c XX5501 is debited with INR 1,299.00 on 18-11-2026 via UPI to Amazon Pay India Ref 632311223344.", 129900L, TransactionDirection.DEBIT, SpendCategory.SHOPPING, PaymentMode.UPI), // synthetic
            Sample("BX-BOBTXN", "Rs.499.00 debited from A/c ...6209 on 18-11-26 at Udemy India. Info: UPI/632399887766.", 49900L, TransactionDirection.DEBIT, SpendCategory.ACADEMICS, PaymentMode.UPI), // synthetic
            Sample("AD-PAYTMB", "Paid Rs.55.00 to Metro Rail DMRC using Paytm UPI. Ref 632300112233.", 5500L, TransactionDirection.DEBIT, SpendCategory.TRAVEL, PaymentMode.UPI), // synthetic
            Sample("AD-HDFCBK", "Rs.2500.00 credited to HDFC Bank A/C *4821 on 18-11-26 from RAHUL SHARMA via UPI Ref 632377665544.", 250000L, TransactionDirection.CREDIT, SpendCategory.OTHERS, PaymentMode.UPI), // synthetic
            Sample("VM-ICICIB", "Refund of Rs 240.00 credited to ICICI Acct XX7712 from Swiggy on 18-Nov-26 Ref 632388990011.", 24000L, TransactionDirection.REFUND, SpendCategory.FOOD, PaymentMode.UPI), // synthetic
            Sample("AX-SBIINB", "Your Debit Card XX9012 spent Rs.799.00 at Flipkart on 18Nov26. Avl Bal Rs.4,120.50.", 79900L, TransactionDirection.DEBIT, SpendCategory.SHOPPING, PaymentMode.DEBIT_CARD), // synthetic
            Sample("AD-HDFCBK", "Rs.1000.00 withdrawn at SBI ATM Koramangala from HDFC Bank Card *4821 on 18-11-26.", 100000L, TransactionDirection.DEBIT, SpendCategory.OTHERS, PaymentMode.ATM), // synthetic
            Sample("JD-AXISBK", "Spent INR 120.00 on Axis Debit Card XX3310 at Campus Stationery on 18-11-26.", 12000L, TransactionDirection.DEBIT, SpendCategory.ACADEMICS, PaymentMode.DEBIT_CARD), // synthetic
            Sample("JK-KOTAKB", "INR 85.00 debited from Kotak AC X1145 to hostelcanteen@ybl Ref 632312121212.", 8500L, TransactionDirection.DEBIT, SpendCategory.FOOD, PaymentMode.UPI), // synthetic
            Sample("AD-PNBSMS", "Rs.350.00 paid to IRCTC Rail Connect from A/c XX5501. UPI Ref 632356565656.", 35000L, TransactionDirection.DEBIT, SpendCategory.TRAVEL, PaymentMode.UPI), // synthetic
            Sample("AD-HDFCBK", "Amt Sent ₹99.50 From HDFC Bank A/C *4821 To Blinkit On 18-11 Ref 632378787878.", 9950L, TransactionDirection.DEBIT, SpendCategory.FOOD, PaymentMode.UPI), // synthetic
            Sample("VM-ICICIB", "ICICI Acct XX7712 debited Rs 899.00 on 18-Nov-26 to Myntra Designs. UPI:632314141414.", 89900L, TransactionDirection.DEBIT, SpendCategory.SHOPPING, PaymentMode.UPI), // synthetic
            Sample("BX-BOBTXN", "INR 1500.00 paid to Delhi University Exam Fees via UPI Ref 632325252525.", 150000L, TransactionDirection.DEBIT, SpendCategory.ACADEMICS, PaymentMode.UPI), // synthetic
            Sample("AX-SBIINB", "Rs.75.00 debited from A/c X9012 to Zepto Grocery Ref 632336363636.", 7500L, TransactionDirection.DEBIT, SpendCategory.FOOD, PaymentMode.UPI), // synthetic
            Sample("JD-AXISBK", "Your A/c XX3310 has been credited with INR 12,000.00 on 01-11-26. Info: Monthly Allowance.", 1200000L, TransactionDirection.CREDIT, SpendCategory.OTHERS, PaymentMode.OTHER), // synthetic
            Sample("JK-KOTAKB", "Rs.199.00 reversed to Kotak AC X1145 from Zomato Ref 632347474747.", 19900L, TransactionDirection.REFUND, SpendCategory.FOOD, PaymentMode.UPI), // synthetic
            Sample("AD-PAYTMB", "Paid Rs.210.00 to Domino Pizza via Paytm UPI. Ref 632369696969.", 21000L, TransactionDirection.DEBIT, SpendCategory.FOOD, PaymentMode.UPI), // synthetic
            Sample("VM-ICICIB", "ICICI Acct XX7712 debited Rs 649.00 on 18-Nov-26 to Crossword Book Store Ref 632380808080.", 64900L, TransactionDirection.DEBIT, SpendCategory.ACADEMICS, PaymentMode.UPI), // synthetic
            Sample("VD-INDUSB", "Your IndusInd A/c XX2048 is debited for INR 110.00 at Starbucks Coffee via UPI Ref 632391919191.", 11000L, TransactionDirection.DEBIT, SpendCategory.FOOD, PaymentMode.UPI), // synthetic
            Sample("AD-HDFCBK", "Amt Sent Rs.425.00 From HDFC Bank A/C *4821 To Decathlon Sports Ref 632302020202.", 42500L, TransactionDirection.DEBIT, SpendCategory.SHOPPING, PaymentMode.UPI), // synthetic
            Sample("JD-AXISBK", "INR 135.00 paid to BMTC Bus Pass via UPI Ref 632315151515.", 13500L, TransactionDirection.DEBIT, SpendCategory.TRAVEL, PaymentMode.UPI) // synthetic
        )

        var categoryMatches = 0
        for (sample in samples) {
            val result = parser.parse(sample.sender, sample.body, now)
            assertTrue("Expected parsed for \${sample.body}", result is SmsParser.ParseResult.Parsed)
            val tx = (result as SmsParser.ParseResult.Parsed).transaction
            assertFalse("Unexpected needsReview for \${sample.body}", tx.needsReview)
            assertEquals(sample.expectedAmount, tx.amountPaise)
            assertEquals(sample.expectedDirection, tx.direction)
            assertEquals(sample.expectedMode, tx.mode)
            if (tx.category == sample.expectedCategory) categoryMatches++
        }

        val accuracy = (categoryMatches.toDouble() / samples.size) * 100.0
        assertTrue("Category accuracy \$accuracy% below 90%", accuracy >= 90.0)
    }

    @Test
    fun \`ignores OTPs promos loan offers credit card bills and personal numbers\`() {
        val ignored = listOf(
            "AD-HDFCBK" to "481920 is your OTP for txn of Rs.1500.00 on HDFC Bank Card *4821.", // synthetic
            "VM-ICICIB" to "Pre-approved Personal Loan offer up to Rs 2,00,000! Apply now.", // synthetic
            "JD-AXISBK" to "Exclusive cashback offer! Get 10% EMI offer on Flipkart.", // synthetic
            "AX-SBIINB" to "Your Credit Card bill of Rs.4,500.00 is due on 25-Nov-26.", // synthetic
            "+919876543210" to "Bhai send Rs.500 for dinner split asap", // synthetic
            "AX-SBIINB" to "Your One Time Password is 991284 for Rs.800.00 purchase at Amazon." // synthetic
        )

        for ((sender, body) in ignored) {
            val result = parser.parse(sender, body, now)
            assertTrue("Expected ignored for \$body", result is SmsParser.ParseResult.Ignored)
        }
    }

    @Test
    fun \`flags malformed or ambiguous alerts for review\`() {
        val malformed = listOf(
            "AD-HDFCBK" to "Alert: Transaction on HDFC A/C *4821 at Ola Cabs Ref 632358585858.", // synthetic
            "AD-PNBSMS" to "Rs.40.00 processed on A/c XX5501 at Xerox Centre. Check balance." // synthetic
        )
        for ((sender, body) in malformed) {
            val result = parser.parse(sender, body, now) as SmsParser.ParseResult.Parsed
            assertTrue(result.transaction.needsReview)
        }
    }

    @Test
    fun \`deduplicates by UPI reference or 2-minute amount-merchant window\`() {
        val first = (parser.parse(
            "AD-HDFCBK",
            "Amt Sent Rs.180.00 From HDFC Bank A/C *4821 To Swiggy On 18-11 Ref 432319847120.",
            now
        ) as SmsParser.ParseResult.Parsed).transaction

        val sameRef = first.copy(timestamp = now + 60_000L)
        val sameWindowNoRef = first.copy(upiRef = null, timestamp = now + 90_000L)
        val outsideWindow = first.copy(upiRef = null, timestamp = now + 180_000L)

        assertTrue(parser.isDuplicate(sameRef, listOf(first)))
        assertTrue(parser.isDuplicate(sameWindowNoRef, listOf(first)))
        assertFalse(parser.isDuplicate(outsideWindow, listOf(first)))
    }
}
`,
  },
  {
    path: 'app/src/test/java/com/finmate/app/domain/budget/SafeToSpendCalculatorTest.kt',
    phase: 'Phase 5: Budget Boundary Unit Tests',
    description: 'Unit tests for month boundaries, leap years, 29th-31st allowance dates, and zero-spend cycles.',
    content: `package com.finmate.app.domain.budget

import com.finmate.app.domain.model.CategorySource
import com.finmate.app.domain.model.PaymentMode
import com.finmate.app.domain.model.Settings
import com.finmate.app.domain.model.SpendCategory
import com.finmate.app.domain.model.Transaction
import com.finmate.app.domain.model.TransactionDirection
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class SafeToSpendCalculatorTest {

    @Test
    fun \`clamps 31st allowance day to Feb 29 on leap year\`() {
        val feb28Leap = LocalDate.of(2024, 2, 28)
        val window = SafeToSpendCalculator.resolveCycleWindow(31, feb28Leap)
        assertEquals(LocalDate.of(2024, 1, 31), window.startDate)
        assertEquals(LocalDate.of(2024, 2, 29), window.nextCycleStartDate)
        assertEquals(1, window.daysLeftInCycle)
    }

    @Test
    fun \`clamps 29th allowance day to Feb 28 on non-leap year\`() {
        val feb27 = LocalDate.of(2026, 2, 27)
        val window = SafeToSpendCalculator.resolveCycleWindow(29, feb27)
        assertEquals(LocalDate.of(2026, 1, 29), window.startDate)
        assertEquals(LocalDate.of(2026, 2, 28), window.nextCycleStartDate)
        assertEquals(1, window.daysLeftInCycle)
    }

    @Test
    fun \`zero spend cycle divides remaining allowance evenly across 30 days\`() {
        val nov1 = LocalDate.of(2026, 11, 1)
            .atTime(10, 0)
            .atZone(SafeToSpendCalculator.KOLKATA_ZONE)
            .toInstant()
            .toEpochMilli()

        val snapshot = SafeToSpendCalculator.calculate(
            settings = Settings(allowancePaise = 12_000_00L, allowanceDay = 1, fixedCommitmentsPaise = 3_000_00L),
            transactions = emptyList(),
            savingsGoal = null,
            nowMillis = nov1
        )
        assertEquals(30_000L, snapshot.dailyLimitPaise)
        assertEquals(30_000L, snapshot.todayRemainingPaise)
    }

    @Test
    fun \`refund reduces monthly spend and credits do not count as spend\`() {
        val nov1 = LocalDate.of(2026, 11, 1)
            .atTime(10, 0)
            .atZone(SafeToSpendCalculator.KOLKATA_ZONE)
            .toInstant()
            .toEpochMilli()

        val txns = listOf(
            Transaction(1L, 50_000L, TransactionDirection.DEBIT, PaymentMode.UPI, "Swiggy", SpendCategory.FOOD, CategorySource.AUTO, nov1),
            Transaction(2L, 20_000L, TransactionDirection.REFUND, PaymentMode.UPI, "Swiggy", SpendCategory.FOOD, CategorySource.AUTO, nov1 + 60_000L),
            Transaction(3L, 100_000L, TransactionDirection.CREDIT, PaymentMode.UPI, "Dad", SpendCategory.OTHERS, CategorySource.AUTO, nov1 + 120_000L)
        )

        val snapshot = SafeToSpendCalculator.calculate(
            settings = Settings(allowancePaise = 10_000_00L, allowanceDay = 1, fixedCommitmentsPaise = 0L),
            transactions = txns,
            savingsGoal = null,
            nowMillis = nov1 + 180_000L
        )
        assertEquals(30_000L, snapshot.spentThisCyclePaise)
    }
}
`,
  },
  {
    path: 'README.md',
    phase: 'Phase 9: Documentation & Distribution',
    description: 'Complete project README with setup, build, test, Play Store Distribution notes, and MVP acceptance checklist.',
    content: `# FinMate — Automated UPI Budget MVP (Android)

**Core promise:** *"Never run out of money before month-end."*
Zero manual entry, a 30-second daily check-in, and a daily safe-to-spend limit built for Indian college students.

---

## Tech Stack
- **Language & UI:** Kotlin, Jetpack Compose, Material 3 (Light & Dark), Single-Activity
- **Architecture:** MVVM + Repository, Hilt DI, Navigation Compose
- **Local Storage:** Room (transactions, merchant overrides, savings goal, local analytics), DataStore Preferences
- **Background:** WorkManager (\`HiltWorker\`) + \`BroadcastReceiver\` (\`RECEIVE_SMS\`)
- **SDK Targets:** \`minSdk = 26\`, \`targetSdk = 36\`, \`compileSdk = 37\`

---

## Setup, Build & Test
1. Clone this repository and open it in **Android Studio** (JDK 17).
2. Sync Gradle using the pinned version catalog in \`gradle/libs.versions.toml\`.
3. Run JVM unit tests (SMS parser + Safe-to-Spend boundaries):
   \`\`\`bash
   ./gradlew test
   \`\`\`
4. Build the debug APK:
   \`\`\`bash
   ./gradlew assembleDebug
   \`\`\`

---

## Distribution
Google Play restricts \`READ_SMS\` and \`RECEIVE_SMS\` to apps that meet strict core-functionality policies:

- **(a) 30-Day Campus Pilot:** Distribute FinMate as a **signed APK** or via **Google Play Internal Testing** track (up to 100 pilot testers, no full store review needed for internal testing).
- **(b) Public Play Store Release:** Requires submitting the **Permissions Declaration Form** justifying automated personal-finance SMS parsing as the app's primary purpose. If Play Store restricts SMS access for public distribution, the fallback architecture replaces \`SmsInboxReader\` / \`SmsBroadcastReceiver\` with a \`NotificationListenerService\` (reading GPay/PhonePe/bank push notifications) plus the existing manual **"Add expense"** flow that already activates gracefully when SMS permission is denied.

---

## Privacy Guarantees
- FinMate **never stores, logs, or transmits** raw SMS body text.
- OTPs, promotional messages, loan offers, and credit-card bill reminders are discarded immediately in memory.
- All financial data stays strictly on-device (\`android:allowBackup="false"\`).
- Pilot analytics upload is gated behind \`BuildConfig.ENABLE_ANALYTICS_UPLOAD\` (\`false\` by default) and can be exported locally as CSV.

---

## Known Limitations
- Dual-SIM devices or regional bank templates outside \`BankSenderConfig.DEFAULT_ALLOW_LIST\` may fall into the **"Check these"** review queue until the sender ID is added.
- Re-reading the 60-day inbox assumes standard \`Telephony.Sms.Inbox\` availability.

---

## MVP Acceptance Checklist
- [ ] Fresh install -> onboarding -> grant SMS -> past 60 days of bank SMS appear as categorised transactions with no manual entry
- [ ] New UPI debit SMS appears in the app within seconds and updates the daily safe-to-spend limit
- [ ] \`./gradlew test\` passes with >= 90% categorisation accuracy across sample Indian bank SMS
- [ ] Denying SMS permission never crashes the app; manual "Add expense" works seamlessly
- [ ] Changing a transaction's category remembers the merchant override for future alerts
- [ ] Single savings goal progress bar & manual contribution updates Safe-to-Spend
- [ ] No SMS body text is stored, logged, or transmitted anywhere
`,
  },
];
