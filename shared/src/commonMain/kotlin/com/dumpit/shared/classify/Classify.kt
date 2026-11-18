package com.dumpit.shared.classify

import com.dumpit.shared.model.Platform
import kotlin.random.Random

private val URL_RE = Regex("""https?://[^\s)>\]"']+""", RegexOption.IGNORE_CASE)
private val X_HOSTS = Regex("""^(www\.|mobile\.)?(twitter|x)\.com$""", RegexOption.IGNORE_CASE)
private val TCO_HOST = Regex("""^t\.co$""", RegexOption.IGNORE_CASE)
private val LINKEDIN_HOST = Regex("""^(www\.|m\.)?linkedin\.com$""", RegexOption.IGNORE_CASE)
private val LINKEDIN_SHORT = Regex("""^lnkd\.in$""", RegexOption.IGNORE_CASE)
private val REDDIT_HOSTS = Regex("""^(www\.|old\.|new\.|m\.)?reddit\.com$""", RegexOption.IGNORE_CASE)
private val REDDIT_SHORT = Regex("""^redd\.it$""", RegexOption.IGNORE_CASE)
private val WHATSAPP_HOSTS = Regex("""^(wa\.me|chat\.whatsapp\.com|api\.whatsapp\.com)$""", RegexOption.IGNORE_CASE)
private val TRAILING_PUNCT = Regex("""[.,!?;:]+$""")

/** First http(s) URL found in a string, if any. */
fun extractUrl(text: String?): String? {
    if (text.isNullOrBlank()) return null
    val match = URL_RE.find(text) ?: return null
    // Strip trailing punctuation that rides along in shared blurbs.
    return match.value.replace(TRAILING_PUNCT, "")
}

/** Host of a URL, lowercased, no port/userinfo — or null if unparseable. */
fun hostOf(url: String): String? {
    val match = Regex("""^https?://([^/\s?#]+)""", RegexOption.IGNORE_CASE).find(url) ?: return null
    var host = match.groupValues[1]
    host = host.substringAfter('@') // strip userinfo
    host = host.substringBefore(':') // strip port
    return host.lowercase().ifBlank { null }
}

fun detectPlatform(url: String): Platform {
    val host = hostOf(url) ?: return Platform.WEB
    if (X_HOSTS.matches(host) || TCO_HOST.matches(host)) return Platform.X
    if (LINKEDIN_HOST.matches(host) || LINKEDIN_SHORT.matches(host)) return Platform.LINKEDIN
    if (REDDIT_HOSTS.matches(host) || REDDIT_SHORT.matches(host)) return Platform.REDDIT
    if (WHATSAPP_HOSTS.matches(host)) return Platform.WHATSAPP
    return Platform.WEB
}

/** Strip the URL out of shared text to keep the readable blurb. */
fun readableBlurb(text: String?, url: String?): String {
    if (text.isNullOrBlank()) return ""
    val cleaned = if (url != null) text.replace(url, "") else text
    return cleaned
        .replace(Regex("""\s{2,}"""), " ")
        .replace(Regex("""^[\s\-–—:|,]+|[\s\-–—:|,]+$"""), "")
        .trim()
}

fun makeId(): String {
    val time = System.currentTimeMillis().toString(36)
    val random = (1..6).map { "abcdefghijklmnopqrstuvwxyz0123456789"[Random.nextInt(36)] }.joinToString("")
    return "$time-$random"
}
