package com.dumpit.shared.classify

import com.dumpit.shared.model.DumpEntity

/**
 * Regex-level entity extraction from shared text — offline, deterministic.
 * URLs are intentionally excluded (already first-class in the app).
 */
private val EMAIL_RE = Regex("""[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}""")
private val PHONE_RE = Regex("""\+?\d[\d\s().-]{6,}\d""")
private val ISO_DATE_RE = Regex("""\b\d{4}-\d{2}-\d{2}\b""")
private val SLASH_DATE_RE = Regex("""\b\d{1,2}/\d{1,2}/\d{2,4}\b""")
private val MONTH_DATE_RE = Regex(
    """\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?""",
    RegexOption.IGNORE_CASE,
)
private val MENTION_RE = Regex("""(?<![A-Za-z0-9_])@[A-Za-z0-9_]{1,30}""")
private val HASHTAG_RE = Regex("""(?<![A-Za-z0-9_])#[A-Za-z0-9_]{1,50}""")
private val MONEY_RE = Regex("""(?:₹|\$|€|£)\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:INR|USD|EUR|GBP)\b""")

fun extractEntities(text: String?): List<DumpEntity> {
    if (text.isNullOrBlank()) return emptyList()
    val out = LinkedHashSet<DumpEntity>()

    for (match in EMAIL_RE.findAll(text)) out.add(DumpEntity("EMAIL", match.value))
    val dateValues = mutableSetOf<String>()
    for (match in ISO_DATE_RE.findAll(text)) { out.add(DumpEntity("DATE", match.value)); dateValues += match.value }
    for (match in SLASH_DATE_RE.findAll(text)) { out.add(DumpEntity("DATE", match.value)); dateValues += match.value }
    for (match in MONTH_DATE_RE.findAll(text)) { out.add(DumpEntity("DATE", match.value)); dateValues += match.value }
    for (match in MENTION_RE.findAll(text)) out.add(DumpEntity("MENTION", match.value))
    for (match in HASHTAG_RE.findAll(text)) out.add(DumpEntity("HASHTAG", match.value))
    for (match in MONEY_RE.findAll(text)) out.add(DumpEntity("MONEY", match.value))
    for (match in PHONE_RE.findAll(text)) {
        if (dateValues.any { match.value.contains(it) }) continue // not a phone, it's the date
        val digits = match.value.count { it.isDigit() }
        if (digits in 8..15) out.add(DumpEntity("PHONE", match.value.trim().replace(Regex("""\s{2,}"""), " ")))
    }

    return out.take(24)
}
