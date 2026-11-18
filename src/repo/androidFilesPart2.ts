import { RepoFileEntry } from '../utils/zipBuilder';

export const ANDROID_FILES_PART_2: RepoFileEntry[] = [
  {
    path: 'app/src/main/java/com/finmate/app/domain/model/DomainModels.kt',
    phase: 'Phase 2 & 3: Domain Models',
    description: 'Core immutable domain models with Long paise monetary representation.',
    content: `package com.finmate.app.domain.model

enum class TransactionDirection { DEBIT, CREDIT, REFUND }

enum class PaymentMode { UPI, DEBIT_CARD, ATM, OTHER }

enum class SpendCategory(val displayName: String) {
    FOOD("Food"),
    TRAVEL("Travel"),
    SHOPPING("Shopping"),
    ACADEMICS("Academics"),
    OTHERS("Others")
}

enum class CategorySource { AUTO, USER }

enum class OnboardingVariant { A, B }

data class Transaction(
    val id: Long = 0L,
    val amountPaise: Long,
    val direction: TransactionDirection,
    val mode: PaymentMode,
    val merchant: String,
    val category: SpendCategory,
    val categorySource: CategorySource,
    val timestamp: Long,
    val upiRef: String? = null,
    val accountLast4: String? = null,
    val needsReview: Boolean = false
)

data class Settings(
    val allowancePaise: Long = 10_000_00L,
    val allowanceDay: Int = 1,
    val fixedCommitmentsPaise: Long = 0L,
    val onboardingCompleted: Boolean = false,
    val onboardingVariant: OnboardingVariant = OnboardingVariant.A,
    val referralCode: String? = null,
    val smsPermissionDenied: Boolean = false
)

data class SavingsGoal(
    val id: Long = 1L,
    val name: String,
    val targetPaise: Long,
    val targetDateIso: String,
    val savedPaise: Long
)
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/domain/parser/BankSenderConfig.kt',
    phase: 'Phase 3: SMS Parser Config',
    description: 'Extensible allow-list of Indian bank & UPI DLT sender IDs.',
    content: `package com.finmate.app.domain.parser

/**
 * Extensible configuration of Indian bank and UPI sender IDs.
 * Matches standard DLT sender headers such as "AD-HDFCBK", "XX-SBIINB-S", "VM-ICICIB".
 */
object BankSenderConfig {
    val DEFAULT_ALLOW_LIST: Set<String> = setOf(
        "HDFCBK",
        "SBIINB",
        "SBIPSG",
        "SBIUPI",
        "ICICIB",
        "AXISBK",
        "KOTAKB",
        "PNBSMS",
        "BOBTXN",
        "PAYTMB",
        "INDUSB",
        "YESBNK",
        "CANBNK",
        "UNIONB",
        "FEDBNK",
        "IDFCFB",
        "PHONEP",
        "GPAYIN"
    )

    private val dltRegex = Regex("^[A-Z0-9]{2}-([A-Z0-9]{4,10})(?:-[A-Z])?$")

    fun normalizeSender(rawSender: String): String {
        val upper = rawSender.trim().uppercase()
        val match = dltRegex.find(upper)
        return match?.groupValues?.getOrNull(1)
            ?: upper.replace(Regex("[^A-Z0-9]"), "")
    }

    fun isAllowed(rawSender: String, allowList: Set<String> = DEFAULT_ALLOW_LIST): Boolean {
        val code = normalizeSender(rawSender)
        if (code.isEmpty()) return false
        return allowList.any { allowed -> code == allowed || code.contains(allowed) }
    }
}
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/domain/parser/SmsParser.kt',
    phase: 'Phase 3: Pure-Kotlin SMS Parser',
    description: 'Pure-Kotlin on-device SMS parser, categoriser, and deduplicator with KDoc.',
    content: `package com.finmate.app.domain.parser

import com.finmate.app.domain.model.CategorySource
import com.finmate.app.domain.model.PaymentMode
import com.finmate.app.domain.model.SpendCategory
import com.finmate.app.domain.model.Transaction
import com.finmate.app.domain.model.TransactionDirection
import kotlin.math.abs

/**
 * Pure-Kotlin on-device SMS parser for Indian bank and UPI alerts.
 *
 * Privacy guarantee:
 * - Never persists or logs raw SMS body text.
 * - Extracts only structured transaction fields.
 * - Flags uncertain messages with [Transaction.needsReview] = true rather than guessing.
 */
class SmsParser(
    private val senderAllowList: Set<String> = BankSenderConfig.DEFAULT_ALLOW_LIST
) {
    sealed interface ParseResult {
        data class Ignored(val reason: String) : ParseResult
        data class Parsed(val transaction: Transaction) : ParseResult
    }

    private val ignoreKeywords = listOf(
        "otp", "one time password", "one-time password", "verification code",
        "offer", "cashback offer", "emi offer", "loan", "pre-approved",
        "credit card bill", "bill due", "minimum due", "win rs", "apply now", "reward points"
    )

    private val foodKeywords = listOf(
        "swiggy", "zomato", "cafe", "coffee", "chai", "tea", "canteen", "mess",
        "tiffin", "bakery", "biryani", "pizza", "domino", "mcdonald", "kfc",
        "burger", "starbucks", "chaayos", "blinkit", "zepto", "instamart",
        "bigbasket", "dhaba", "restaurant", "food", "eatery"
    )

    private val travelKeywords = listOf(
        "uber", "ola", "rapido", "irctc", "metro", "dmrc", "bmrc", "bmtc",
        "redbus", "abhibus", "rail", "petrol", "fuel", "hpcl", "bpcl", "iocl",
        "indigo", "makemytrip", "yulu", "namma yatri", "auto", "cab", "toll", "fastag"
    )

    private val shoppingKeywords = listOf(
        "amazon", "flipkart", "myntra", "ajio", "nykaa", "meesho", "croma",
        "decathlon", "zudio", "westside", "dmart", "retail", "mart", "mall"
    )

    private val academicsKeywords = listOf(
        "college", "university", "univ", "institute", "iit", "nit", "vit", "bits",
        "fees", "tuition", "exam", "stationery", "xerox", "print", "udemy",
        "coursera", "nptel", "book", "crossword", "sapna", "library", "hostel", "semester"
    )

    /**
     * Parses a single SMS message into a structured [Transaction] or [ParseResult.Ignored].
     *
     * @param sender Raw SMS originating address (e.g. "AD-HDFCBK").
     * @param body Raw SMS body (inspected in-memory only, never persisted or logged).
     * @param receivedAtMillis Epoch millis when the SMS was received.
     * @param userOverrides Merchant-key to [SpendCategory] overrides saved by the user.
     */
    fun parse(
        sender: String,
        body: String,
        receivedAtMillis: Long,
        userOverrides: Map<String, SpendCategory> = emptyMap()
    ): ParseResult {
        if (!BankSenderConfig.isAllowed(sender, senderAllowList)) {
            return ParseResult.Ignored("Sender outside bank/UPI allow-list")
        }

        val lower = body.lowercase()
        if (ignoreKeywords.any { lower.contains(it) }) {
            return ParseResult.Ignored("OTP, promotional, or loan/card-bill reminder")
        }

        val amountPaise = extractAmountPaise(body)
        val direction = extractDirection(lower)
        val mode = extractMode(body, lower)
        val accountLast4 = extractAccountLast4(body)
        val upiRef = extractUpiRef(body)
        val merchant = extractMerchant(body, mode)
        val (category, categorySource) = categorise(merchant, userOverrides)

        val needsReview = amountPaise == null || direction == null

        return ParseResult.Parsed(
            Transaction(
                amountPaise = amountPaise ?: 0L,
                direction = direction ?: TransactionDirection.DEBIT,
                mode = mode,
                merchant = merchant,
                category = category,
                categorySource = categorySource,
                timestamp = receivedAtMillis,
                upiRef = upiRef,
                accountLast4 = accountLast4,
                needsReview = needsReview
            )
        )
    }

    /**
     * Normalizes a merchant name for consistent override lookup and deduplication.
     */
    fun normalizeMerchantKey(merchant: String): String =
        merchant.lowercase()
            .replace(Regex("@[a-z0-9._-]+"), "")
            .replace(Regex("[^a-z0-9]+"), " ")
            .trim()

    /**
     * Categorises [merchant] by checking user overrides first, then keyword rules.
     */
    fun categorise(
        merchant: String,
        userOverrides: Map<String, SpendCategory>
    ): Pair<SpendCategory, CategorySource> {
        val key = normalizeMerchantKey(merchant)
        userOverrides[key]?.let { return it to CategorySource.USER }

        val lower = merchant.lowercase()
        return when {
            foodKeywords.any { lower.contains(it) } -> SpendCategory.FOOD to CategorySource.AUTO
            travelKeywords.any { lower.contains(it) } -> SpendCategory.TRAVEL to CategorySource.AUTO
            academicsKeywords.any { lower.contains(it) } -> SpendCategory.ACADEMICS to CategorySource.AUTO
            shoppingKeywords.any { lower.contains(it) } -> SpendCategory.SHOPPING to CategorySource.AUTO
            else -> SpendCategory.OTHERS to CategorySource.AUTO
        }
    }

    /**
     * Returns true if [candidate] duplicates any transaction in [existing] by UPI ref
     * or by matching (amountPaise + normalized merchantKey + within 2 minutes).
     */
    fun isDuplicate(candidate: Transaction, existing: List<Transaction>): Boolean {
        val candidateKey = normalizeMerchantKey(candidate.merchant)
        val twoMinutesMillis = 120_000L

        return existing.any { tx ->
            if (!candidate.upiRef.isNullOrBlank() && candidate.upiRef == tx.upiRef) {
                return@any true
            }
            val sameAmount = candidate.amountPaise > 0L && candidate.amountPaise == tx.amountPaise
            val sameMerchant = candidateKey.isNotEmpty() && candidateKey == normalizeMerchantKey(tx.merchant)
            val closeInTime = abs(candidate.timestamp - tx.timestamp) <= twoMinutesMillis
            sameAmount && sameMerchant && closeInTime
        }
    }

    private fun extractAmountPaise(body: String): Long? {
        val numPattern = "([0-9]{1,3}(?:,[0-9]{2,3})+(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)"
        val patterns = listOf(
            Regex("(?:rs\\.?|inr|₹)\\s*$numPattern", RegexOption.IGNORE_CASE),
            Regex("$numPattern\\s*(?:inr|rs\\.?)", RegexOption.IGNORE_CASE),
            Regex("debited\\s+by\\s+$numPattern", RegexOption.IGNORE_CASE)
        )
        for (regex in patterns) {
            val match = regex.find(body) ?: continue
            val raw = match.groupValues[1].replace(",", "")
            val parts = raw.split(".")
            val rupees = parts[0].toLongOrNull() ?: continue
            val paise = parts.getOrNull(1)?.padEnd(2, '0')?.take(2)?.toLongOrNull() ?: 0L
            val total = rupees * 100L + paise
            if (total > 0L) return total
        }
        return null
    }

    private fun extractDirection(lower: String): TransactionDirection? {
        if (Regex("\\b(refund|refunded|reversed|reversal|cashback credited)\\b").containsMatchIn(lower)) {
            return TransactionDirection.REFUND
        }
        if (Regex("\\b(?:acct|a/c|account)\\s+[x*0-9]+\\s+debited\\b").containsMatchIn(lower)) {
            return TransactionDirection.DEBIT
        }
        val debitMatches = Regex("\\b(debited|spent|paid|sent|withdrawn|purchase|deducted)\\b").findAll(lower).count()
        val creditMatches = Regex("\\b(credited|received|deposited)\\b").findAll(lower).count()
        return when {
            debitMatches > 0 && creditMatches == 0 -> TransactionDirection.DEBIT
            creditMatches > 0 && debitMatches == 0 -> TransactionDirection.CREDIT
            debitMatches > creditMatches -> TransactionDirection.DEBIT
            creditMatches > debitMatches -> TransactionDirection.CREDIT
            else -> null
        }
    }

    private fun extractMode(body: String, lower: String): PaymentMode = when {
        Regex("\\b(atm|cash withdrawal|withdrawn at)\\b").containsMatchIn(lower) -> PaymentMode.ATM
        Regex("\\b(upi|vpa|gpay|phonepe|paytm|bhim)\\b").containsMatchIn(lower) || body.contains("@") -> PaymentMode.UPI
        Regex("\\b(debit card|card|pos|ecom)\\b").containsMatchIn(lower) -> PaymentMode.DEBIT_CARD
        else -> PaymentMode.OTHER
    }

    private fun extractAccountLast4(body: String): String? {
        val explicit = Regex("(?:a/c|acct|account|card)\\s*(?:no\\.?\\s*)?(?:xx+|x+|\\*+)?([0-9]{4})\\b", RegexOption.IGNORE_CASE)
            .find(body)?.groupValues?.getOrNull(1)
        if (explicit != null) return explicit
        return Regex("[xX*]{2,}([0-9]{4})\\b").find(body)?.groupValues?.getOrNull(1)
    }

    private fun extractUpiRef(body: String): String? {
        val labeled = Regex("(?:upi\\s*ref(?:\\s*no\\.?)?|ref(?:\\s*no\\.?)?|utr|rrn|upi)\\s*[:#-]?\\s*([0-9]{9,14})", RegexOption.IGNORE_CASE)
            .find(body)?.groupValues?.getOrNull(1)
        if (labeled != null) return labeled
        return Regex("\\b([0-9]{12})\\b").find(body)?.groupValues?.getOrNull(1)
    }

    private fun extractMerchant(body: String, mode: PaymentMode): String {
        if (mode == PaymentMode.ATM) {
            val atmLoc = Regex("(?:at|from)\\s+([A-Za-z0-9 &._/-]{3,40}?)(?=\\s+on|\\s+bal|\\.|,|$)", RegexOption.IGNORE_CASE)
                .find(body)?.groupValues?.getOrNull(1)?.trim()
            return if (!atmLoc.isNullOrBlank()) "ATM - $atmLoc" else "ATM Cash Withdrawal"
        }

        val iciciMatch = Regex(";\\s*([A-Za-z0-9 .&'_-]{2,45}?)\\s+credited\\b", RegexOption.IGNORE_CASE)
            .find(body)?.groupValues?.getOrNull(1)?.trim()
        if (!iciciMatch.isNullOrBlank() && iciciMatch.length >= 2) return iciciMatch

        val patterns = listOf(
            Regex("(?:to|towards|paid to|sent to|trf to)\\s+([A-Za-z0-9@._&' -]{2,45}?)(?=\\s+(?:from|on|via|ref|upi|avl|bal|if\\s+not)|\\.|,|;|$)", RegexOption.IGNORE_CASE),
            Regex("\\bat\\s+([A-Za-z0-9._&' -]{2,45}?)(?=\\s+(?:from|on|via|ref|upi|avl|bal|if\\s+not)|\\.|,|;|$)", RegexOption.IGNORE_CASE),
            Regex("(?:from)\\s+([A-Za-z0-9@._&' -]{2,40}?)(?=\\s+(?:via|on|ref|upi|avl|bal)|\\.|,|;|$)", RegexOption.IGNORE_CASE)
        )
        for (regex in patterns) {
            val raw = regex.find(body)?.groupValues?.getOrNull(1) ?: continue
            val cleaned = raw
                .replace(Regex("\\b(on|via|using|from|ref|upi|avl|bal|balance|not\\s+you|if\\s+not).*$", RegexOption.IGNORE_CASE), "")
                .trim(' ', '.', ',', ';', ')')
            if (
                cleaned.length >= 2 &&
                !Regex("^(your|a/c|acct|account|bank|xx\\d+|\\d+)$", RegexOption.IGNORE_CASE).matches(cleaned) &&
                !Regex("\\b(?:a/c|acct|ac|account)\\b", RegexOption.IGNORE_CASE).containsMatchIn(cleaned)
            ) {
                return cleaned
            }
        }

        val vpa = Regex("\\b([a-zA-Z0-9._-]{2,}@[a-zA-Z0-9]{2,})\\b").find(body)?.groupValues?.getOrNull(1)
        if (vpa != null) {
            return vpa.substringBefore("@").replace(Regex("[._-]+"), " ").trim()
        }
        return "Unknown Merchant"
    }
}
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/domain/budget/SafeToSpendCalculator.kt',
    phase: 'Phase 5: Safe-to-Spend Calculator',
    description: 'Pure-Kotlin Safe-to-Spend cycle calculator using Asia/Kolkata and Long paise.',
    content: `package com.finmate.app.domain.budget

import com.finmate.app.domain.model.SavingsGoal
import com.finmate.app.domain.model.Settings
import com.finmate.app.domain.model.Transaction
import com.finmate.app.domain.model.TransactionDirection
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlin.math.ceil
import kotlin.math.max

/**
 * Computes the student's daily safe-to-spend budget in Asia/Kolkata timezone.
 *
 * Formula:
 * dailyLimit = max(0, (monthlyAllowance + otherIncomeThisCycle - spentThisCycle - fixedCommitmentsRemaining - savingsContributionsPlanned) / daysLeftInCycle)
 */
object SafeToSpendCalculator {

    val KOLKATA_ZONE: ZoneId = ZoneId.of("Asia/Kolkata")

    data class CycleWindow(
        val startDate: LocalDate,
        val nextCycleStartDate: LocalDate,
        val daysLeftInCycle: Int
    )

    data class BudgetSnapshot(
        val dailyLimitPaise: Long,
        val todayRemainingPaise: Long,
        val spentThisCyclePaise: Long,
        val spentTodayPaise: Long,
        val remainingPoolPaise: Long,
        val daysLeftInCycle: Int,
        val cycleStartDate: LocalDate,
        val cycleEndDate: LocalDate
    )

    /**
     * Resolves the active allowance cycle containing [today], clamping 29th-31st
     * allowance days to each month's length (handling leap years safely).
     */
    fun resolveCycleWindow(allowanceDay: Int, today: LocalDate): CycleWindow {
        val safeDay = allowanceDay.coerceIn(1, 31)
        val currentYm = YearMonth.from(today)
        val currentAllowanceDate = currentYm.atDay(minOf(safeDay, currentYm.lengthOfMonth()))

        val (startDate, nextStart) = if (!today.isBefore(currentAllowanceDate)) {
            val nextYm = currentYm.plusMonths(1)
            currentAllowanceDate to nextYm.atDay(minOf(safeDay, nextYm.lengthOfMonth()))
        } else {
            val prevYm = currentYm.minusMonths(1)
            prevYm.atDay(minOf(safeDay, prevYm.lengthOfMonth())) to currentAllowanceDate
        }

        val daysLeft = ChronoUnit.DAYS.between(today, nextStart).toInt().coerceAtLeast(1)
        return CycleWindow(
            startDate = startDate,
            nextCycleStartDate = nextStart,
            daysLeftInCycle = daysLeft
        )
    }

    /**
     * Calculates [BudgetSnapshot] using integer paise arithmetic with zero floating-point drift.
     */
    fun calculate(
        settings: Settings,
        transactions: List<Transaction>,
        savingsGoal: SavingsGoal?,
        nowMillis: Long = System.currentTimeMillis()
    ): BudgetSnapshot {
        val today = Instant.ofEpochMilli(nowMillis).atZone(KOLKATA_ZONE).toLocalDate()
        val window = resolveCycleWindow(settings.allowanceDay, today)

        val cycleStartMillis = window.startDate.atStartOfDay(KOLKATA_ZONE).toInstant().toEpochMilli()
        val cycleEndMillis = window.nextCycleStartDate.atStartOfDay(KOLKATA_ZONE).toInstant().toEpochMilli()
        val todayStartMillis = today.atStartOfDay(KOLKATA_ZONE).toInstant().toEpochMilli()
        val tomorrowStartMillis = today.plusDays(1).atStartOfDay(KOLKATA_ZONE).toInstant().toEpochMilli()

        var grossDebitCycle = 0L
        var refundsCycle = 0L
        var otherIncomeCycle = 0L
        var netSpentToday = 0L

        for (tx in transactions) {
            if (tx.needsReview) continue
            if (tx.timestamp < cycleStartMillis || tx.timestamp >= cycleEndMillis) continue
            val isToday = tx.timestamp in todayStartMillis until tomorrowStartMillis

            when (tx.direction) {
                TransactionDirection.DEBIT -> {
                    grossDebitCycle += tx.amountPaise
                    if (isToday) netSpentToday += tx.amountPaise
                }
                TransactionDirection.REFUND -> {
                    refundsCycle += tx.amountPaise
                    if (isToday) netSpentToday -= tx.amountPaise
                }
                TransactionDirection.CREDIT -> {
                    otherIncomeCycle += tx.amountPaise
                }
            }
        }

        val netSpentCycle = max(0L, grossDebitCycle - refundsCycle)
        val savingsPlanned = computeSavingsPlannedPaise(savingsGoal, today)

        val remainingPool = settings.allowancePaise +
            otherIncomeCycle -
            netSpentCycle -
            settings.fixedCommitmentsPaise -
            savingsPlanned

        val dailyLimit = max(0L, remainingPool / window.daysLeftInCycle)
        val safeSpentToday = max(0L, netSpentToday)
        val todayRemaining = dailyLimit - safeSpentToday

        return BudgetSnapshot(
            dailyLimitPaise = dailyLimit,
            todayRemainingPaise = todayRemaining,
            spentThisCyclePaise = netSpentCycle,
            spentTodayPaise = safeSpentToday,
            remainingPoolPaise = max(0L, remainingPool),
            daysLeftInCycle = window.daysLeftInCycle,
            cycleStartDate = window.startDate,
            cycleEndDate = window.nextCycleStartDate.minusDays(1)
        )
    }

    private fun computeSavingsPlannedPaise(goal: SavingsGoal?, today: LocalDate): Long {
        if (goal == null) return 0L
        val remaining = max(0L, goal.targetPaise - goal.savedPaise)
        if (remaining == 0L) return 0L
        val targetDate = runCatching { LocalDate.parse(goal.targetDateIso) }.getOrNull() ?: return 0L
        val daysToTarget = ChronoUnit.DAYS.between(today, targetDate).coerceAtLeast(1L)
        val monthsLeft = max(1L, ceil(daysToTarget / 30.0).toLong())
        return remaining / monthsLeft
    }
}
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/domain/format/InrFormatter.kt',
    phase: 'Phase 5: Formatting',
    description: 'Indian digit grouping currency formatter (₹1,23,456).',
    content: `package com.finmate.app.domain.format

import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs

object InrFormatter {
    private val indianLocale: Locale = Locale.Builder().setLanguage("en").setRegion("IN").build()

    fun format(paise: Long, showPlusForPositive: Boolean = false): String {
        val negative = paise < 0L
        val absPaise = abs(paise)
        val rupees = absPaise / 100L
        val remPaise = absPaise % 100L

        val grouped = NumberFormat.getIntegerInstance(indianLocale).format(rupees)
        val decimalSuffix = if (remPaise > 0L) ".\${remPaise.toString().padStart(2, '0')}" else ""
        val sign = when {
            negative -> "-₹"
            showPlusForPositive && paise > 0L -> "+₹"
            else -> "₹"
        }
        return "$sign$grouped$decimalSuffix"
    }
}
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/data/local/db/FinMateEntities.kt',
    phase: 'Phase 2: Room Entities',
    description: 'Room entities for Transaction, MerchantCategoryOverride, SavingsGoal, and AnalyticsEvent.',
    content: `package com.finmate.app.data.local.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "transactions",
    indices = [
        Index(value = ["upiRef"]),
        Index(value = ["timestamp"])
    ]
)
data class TransactionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val amountPaise: Long,
    val direction: String,
    val mode: String,
    val merchant: String,
    val category: String,
    val categorySource: String,
    val timestamp: Long,
    val upiRef: String? = null,
    val accountLast4: String? = null,
    val needsReview: Boolean = false
)

@Entity(tableName = "merchant_category_overrides")
data class MerchantCategoryOverrideEntity(
    @PrimaryKey val merchantKey: String,
    val category: String
)

@Entity(tableName = "savings_goals")
data class SavingsGoalEntity(
    @PrimaryKey val id: Long = 1L,
    val name: String,
    val targetPaise: Long,
    val targetDateIso: String,
    val savedPaise: Long
)

@Entity(tableName = "analytics_events")
data class AnalyticsEventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val eventName: String,
    val variant: String,
    val metadataJson: String,
    val timestamp: Long
)
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/data/local/db/FinMateDaos.kt',
    phase: 'Phase 2: Room DAOs & Database',
    description: 'Room DAOs and FinMateDatabase.',
    content: `package com.finmate.app.data.local.db

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {
    @Query("SELECT * FROM transactions ORDER BY timestamp DESC")
    fun observeAll(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM transactions ORDER BY timestamp DESC")
    suspend fun getAllSnapshot(): List<TransactionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: TransactionEntity): Long

    @Query("UPDATE transactions SET category = :category, categorySource = 'USER' WHERE id = :id")
    suspend fun updateCategory(id: Long, category: String)

    @Query("UPDATE transactions SET amountPaise = :amountPaise, direction = :direction, needsReview = 0 WHERE id = :id")
    suspend fun resolveReview(id: Long, amountPaise: Long, direction: String)

    @Query("SELECT COUNT(*) FROM transactions")
    suspend fun count(): Int
}

@Dao
interface MerchantOverrideDao {
    @Query("SELECT * FROM merchant_category_overrides")
    fun observeAll(): Flow<List<MerchantCategoryOverrideEntity>>

    @Query("SELECT * FROM merchant_category_overrides")
    suspend fun getAllSnapshot(): List<MerchantCategoryOverrideEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: MerchantCategoryOverrideEntity)
}

@Dao
interface SavingsGoalDao {
    @Query("SELECT * FROM savings_goals WHERE id = 1 LIMIT 1")
    fun observeGoal(): Flow<SavingsGoalEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(goal: SavingsGoalEntity)

    @Query("UPDATE savings_goals SET savedPaise = savedPaise + :deltaPaise WHERE id = 1")
    suspend fun addContribution(deltaPaise: Long)

    @Query("DELETE FROM savings_goals WHERE id = 1")
    suspend fun clear()
}

@Dao
interface AnalyticsDao {
    @Insert
    suspend fun insert(event: AnalyticsEventEntity)

    @Query("SELECT * FROM analytics_events ORDER BY timestamp DESC")
    fun observeAll(): Flow<List<AnalyticsEventEntity>>

    @Query("SELECT * FROM analytics_events ORDER BY timestamp ASC")
    suspend fun getAllSnapshot(): List<AnalyticsEventEntity>
}

@Database(
    entities = [
        TransactionEntity::class,
        MerchantCategoryOverrideEntity::class,
        SavingsGoalEntity::class,
        AnalyticsEventEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class FinMateDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun merchantOverrideDao(): MerchantOverrideDao
    abstract fun savingsGoalDao(): SavingsGoalDao
    abstract fun analyticsDao(): AnalyticsDao
}
`,
  },
  {
    path: 'app/src/main/java/com/finmate/app/data/sms/SmsSyncPipeline.kt',
    phase: 'Phase 4: Inbox Backfill, BroadcastReceiver & WorkManager',
    description: '60-day SmsInboxReader, SmsBroadcastReceiver handing off to WorkManager HiltWorker.',
    content: `package com.finmate.app.data.sms

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.finmate.app.data.local.db.TransactionDao
import com.finmate.app.data.local.db.TransactionEntity
import com.finmate.app.data.local.db.MerchantOverrideDao
import com.finmate.app.data.repository.AnalyticsRepository
import com.finmate.app.domain.model.SpendCategory
import com.finmate.app.domain.model.Transaction
import com.finmate.app.domain.model.TransactionDirection
import com.finmate.app.domain.model.PaymentMode
import com.finmate.app.domain.model.CategorySource
import com.finmate.app.domain.parser.SmsParser
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import javax.inject.Inject

class SmsInboxReader @Inject constructor(
    private val context: Context
) {
    data class RawMessage(val sender: String, val body: String, val timestamp: Long)

    fun readLast60Days(): List<RawMessage> {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) return emptyList()

        val sixtyDaysAgo = System.currentTimeMillis() - (60L * 24 * 60 * 60 * 1000)
        val result = mutableListOf<RawMessage>()
        val projection = arrayOf(
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE
        )
        val selection = "\${Telephony.Sms.DATE} >= ?"
        val selectionArgs = arrayOf(sixtyDaysAgo.toString())

        context.contentResolver.query(
            Telephony.Sms.Inbox.CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            "\${Telephony.Sms.DATE} ASC"
        )?.use { cursor ->
            val addrIdx = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
            val bodyIdx = cursor.getColumnIndex(Telephony.Sms.BODY)
            val dateIdx = cursor.getColumnIndex(Telephony.Sms.DATE)
            while (cursor.moveToNext()) {
                val sender = cursor.getString(addrIdx).orEmpty()
                val body = cursor.getString(bodyIdx).orEmpty()
                val ts = cursor.getLong(dateIdx)
                result.add(RawMessage(sender, body, ts))
            }
        }
        return result
    }
}

class SmsBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val request = OneTimeWorkRequestBuilder<SmsSyncWorker>().build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "finmate_sms_sync",
            ExistingWorkPolicy.APPEND_OR_REPLACE,
            request
        )
    }
}

@HiltWorker
class SmsSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val inboxReader: SmsInboxReader,
    private val transactionDao: TransactionDao,
    private val overrideDao: MerchantOverrideDao,
    private val analyticsRepository: AnalyticsRepository
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val parser = SmsParser()
        val overrides = overrideDao.getAllSnapshot().associate {
            it.merchantKey to SpendCategory.valueOf(it.category)
        }
        val existing = transactionDao.getAllSnapshot().map { it.toDomain() }.toMutableList()
        val hadZeroBefore = existing.isEmpty()

        val rawMessages = inboxReader.readLast60Days()
        var insertedCount = 0

        for (msg in rawMessages) {
            val outcome = parser.parse(msg.sender, msg.body, msg.timestamp, overrides)
            if (outcome is SmsParser.ParseResult.Parsed) {
                val tx = outcome.transaction
                if (!parser.isDuplicate(tx, existing)) {
                    transactionDao.insert(tx.toEntity())
                    existing.add(tx)
                    insertedCount++
                    if (tx.needsReview) {
                        analyticsRepository.logEvent("parse_needs_review")
                    }
                }
            }
        }

        if (hadZeroBefore && insertedCount > 0) {
            analyticsRepository.logEvent("first_transaction_tracked")
        }
        return Result.success()
    }

    private fun TransactionEntity.toDomain() = Transaction(
        id = id,
        amountPaise = amountPaise,
        direction = TransactionDirection.valueOf(direction),
        mode = PaymentMode.valueOf(mode),
        merchant = merchant,
        category = SpendCategory.valueOf(category),
        categorySource = CategorySource.valueOf(categorySource),
        timestamp = timestamp,
        upiRef = upiRef,
        accountLast4 = accountLast4,
        needsReview = needsReview
    )

    private fun Transaction.toEntity() = TransactionEntity(
        amountPaise = amountPaise,
        direction = direction.name,
        mode = mode.name,
        merchant = merchant,
        category = category.name,
        categorySource = categorySource.name,
        timestamp = timestamp,
        upiRef = upiRef,
        accountLast4 = accountLast4,
        needsReview = needsReview
    )
}
`,
  },
];
