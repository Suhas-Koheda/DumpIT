package com.dumpit.shared.link

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.timeout
import io.ktor.client.request.get
import io.ktor.client.request.head
import io.ktor.client.request.header
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import com.dumpit.shared.store.LogBus
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Link reading for the on-device agent. Ports link-reader.ts. Handles
 * X/Twitter via the fxtwitter JSON API (post text, no auth), public
 * Google Docs via their export endpoint, and everything else via
 * OpenGraph scraping. Redirects (t.co) are followed and re-dispatched.
 */

private const val TIMEOUT_MS = 5_000L
private const val DOC_TIMEOUT_MS = 30_000L

private val X_HOSTS = Regex("""^(www\.|mobile\.)?(twitter|x)\.com$""", RegexOption.IGNORE_CASE)
private val URL_RE = Regex("""https?://[^\s)>\]"']+""", RegexOption.IGNORE_CASE)

data class LinkRead(
    val pageTitle: String?,
    val pageText: String,
    val source: String, // 'tweet' | 'googledoc' | 'opengraph' | 'none'
    val error: String? = null,
)

/** All URLs in a blob of text, deduplicated, trailing punctuation stripped. */
fun extractAllUrls(text: String): List<String> {
    val seen = LinkedHashSet<String>()
    val out = ArrayList<String>()
    for (raw in URL_RE.findAll(text)) {
        val url = raw.value.trimEnd(')', '>', ']', '"', '\'').replace(Regex("""[.,!?;:]+$"""), "")
        if (seen.add(url)) out.add(url)
    }
    return out
}

fun matchGoogleDoc(host: String, path: String): String? {
    if (!host.equals("docs.google.com", ignoreCase = true)) return null
    return Regex("""/document/d/([a-zA-Z0-9_-]+)""").find(path)?.groupValues?.get(1)
}

private fun hostAndPath(rawUrl: String): Pair<String, String>? {
    val match = Regex("""^([a-zA-Z][a-zA-Z0-9+.-]*://)?([^/\s?#]+)([^?\s#]*)""").find(rawUrl) ?: return null
    val host = match.groupValues[2].substringAfter('@').substringBefore(':').lowercase()
    val path = match.groupValues[3].ifBlank { "/" }
    return host to path
}

private fun firstMatch(html: String, re: Regex): String? =
    re.find(html)?.groupValues?.getOrNull(1)?.trim()?.ifBlank { null }

private fun stripHtml(html: String): String = html
    .replace(Regex("""<\s*br\s*/?>""", RegexOption.IGNORE_CASE), "\n")
    .replace(Regex("""</(p|div|li|blockquote|h[1-6]|tr)>""", RegexOption.IGNORE_CASE), "\n")
    .replace(Regex("""<[^>]+>"""), " ")
    .replace("&amp;", "&")
    .replace("&lt;", "<")
    .replace("&gt;", ">")
    .replace("&quot;", "\"")
    .replace(Regex("""&#39;|&apos;"""), "'")
    .replace("&nbsp;", " ")
    .replace(Regex("""[ \t]+"""), " ")
    .replace(Regex("""\n\s+"""), "\n")
    .replace(Regex("""\n{3,}"""), "\n\n")
    .trim()

private fun parseOpenGraph(html: String): LinkRead {
    val title = firstMatch(html, Regex("""<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']""", RegexOption.IGNORE_CASE))
        ?: firstMatch(html, Regex("""<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']""", RegexOption.IGNORE_CASE))
        ?: firstMatch(html, Regex("""<title>([^<]+)</title>""", RegexOption.IGNORE_CASE))
    val description = firstMatch(html, Regex("""<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']""", RegexOption.IGNORE_CASE))
        ?: firstMatch(html, Regex("""<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']""", RegexOption.IGNORE_CASE))
        ?: firstMatch(html, Regex("""<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']""", RegexOption.IGNORE_CASE))

    val titleLower = (title ?: "").lowercase()
    val looksLikeLoginWall =
        Regex("""sign\s?in|log\s?in|login""", RegexOption.IGNORE_CASE).containsMatchIn(titleLower) &&
            !Regex("""post|tweet|article|docs""", RegexOption.IGNORE_CASE).containsMatchIn(titleLower)

    val parts = ArrayList<String>()
    if (title != null && !looksLikeLoginWall) parts.add("Title: $title")
    if (description != null && !looksLikeLoginWall) parts.add("Description: $description")

    if (parts.isEmpty()) {
        val p = firstMatch(html, Regex("""<p[^>]*>([\s\S]{80,1200}?)</p>""", RegexOption.IGNORE_CASE))
        val stripped = p?.let(::stripHtml).orEmpty()
        if (stripped.length > 60 && !Regex("""sign in|log in""", RegexOption.IGNORE_CASE).containsMatchIn(stripped.take(120))) {
            parts.add(stripped)
        }
    }

    val pageText = parts.joinToString("\n\n")
    return if (pageText.length > 20) {
        LinkRead(pageTitle = if (looksLikeLoginWall) null else title, pageText = pageText, source = "opengraph")
    } else {
        LinkRead(pageTitle = null, pageText = "", source = "none")
    }
}

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

@Serializable
private data class TweetAuthor(val name: String? = null, val screen_name: String? = null)

@Serializable
private data class Tweet(val text: String? = null, val author: TweetAuthor? = null)

@Serializable
private data class TweetResponse(val tweet: Tweet? = null)

class LinkReader(private val http: HttpClient) {

    constructor() : this(
        HttpClient {
            followRedirects = true
            install(HttpTimeout) {
                requestTimeoutMillis = TIMEOUT_MS
                connectTimeoutMillis = TIMEOUT_MS
                socketTimeoutMillis = TIMEOUT_MS
            }
        }
    )

    private val headClient by lazy {
        HttpClient {
            followRedirects = false
            install(HttpTimeout) {
                requestTimeoutMillis = 4_000
                connectTimeoutMillis = 4_000
                socketTimeoutMillis = 4_000
            }
        }
    }

    /**
     * Unfold shorteners and redirect chains to the real destination via a
     * cheap HEAD walk (no body). Falls back to the original URL on any error.
     */
    suspend fun resolveFinalUrl(rawUrl: String): String {
        var current = rawUrl
        repeat(5) {
            if (!current.startsWith("https://") && !current.startsWith("http://")) return current
            val hp = hostAndPath(current) ?: return current
            try {
                val response = headClient.head(current)
                val code = response.status.value
                if (code in 300..399) {
                    val location = response.headers["Location"] ?: return current
                    current = when {
                        location.startsWith("http://") || location.startsWith("https://") -> location
                        location.startsWith("/") -> "https://${hp.first}$location"
                        else -> "https://${hp.first}/$location"
                    }
                    LogBus.log("link", "redirect → $current")
                } else {
                    return current
                }
            } catch (_: Exception) {
                return current
            }
        }
        return current
    }

    suspend fun read(rawUrl: String): LinkRead {
        val (host, path) = hostAndPath(rawUrl) ?: return LinkRead(null, "", "none")

        matchGoogleDoc(host, path)?.let { return readGoogleDoc(it) }
        if (X_HOSTS.matches(host)) readTweet("https://$host$path")?.let { return it }

        return try {
            LogBus.log("link", "fetch: $rawUrl")
            val response: HttpResponse = http.get(rawUrl) {
                header("Accept", "text/html,application/xhtml+xml,application/json,text/plain")
            }
            LogBus.log("link", "response: HTTP ${response.status.value} for $rawUrl")
            if (response.status.value !in 200..299) {
                return LinkRead(null, "", "none", "HTTP ${response.status.value}")
            }
            val text = response.bodyAsText()
            val finalHostPath = hostAndPath(response.call.request.url.toString())
            if (finalHostPath != null) {
                matchGoogleDoc(finalHostPath.first, finalHostPath.second)?.let { return readGoogleDoc(it) }
                if (X_HOSTS.matches(finalHostPath.first)) {
                    readTweet("https://${finalHostPath.first}${finalHostPath.second}")?.let { return it }
                }
            }
            parseOpenGraph(text)
        } catch (error: Exception) {
            LogBus.log("link", "fetch failed: ${error::class.simpleName}: ${error.message}")
            LinkRead(null, "", "none", "${error::class.simpleName}: ${error.message}")
        }
    }

    private suspend fun readGoogleDoc(docId: String): LinkRead {
        return try {
            LogBus.log("link", "googledoc export fetch: $docId")
            val response = http.get("https://docs.google.com/document/d/$docId/export?format=txt") {
                header("Accept", "text/plain")
                timeout { requestTimeoutMillis = DOC_TIMEOUT_MS }
            }
            LogBus.log("link", "googledoc export response: HTTP ${response.status.value}")
            val cleaned = response.bodyAsText().replace("\r", "").trim()
            val looksLikeLogin = Regex("""sign in to continue|accounts\.google\.com""", RegexOption.IGNORE_CASE)
                .containsMatchIn(cleaned.take(500))
            if (cleaned.length > 60 && !looksLikeLogin) {
                val firstLine = cleaned.lines().map { it.trim() }.firstOrNull { it.length > 3 } ?: "Google Doc"
                LinkRead(
                    pageTitle = "Google Doc: ${firstLine.take(80)}",
                    pageText = cleaned,
                    source = "googledoc",
                )
            } else {
                LinkRead(null, "", "none")
            }
        } catch (error: Exception) {
            LogBus.log("link", "googledoc fetch failed: ${error::class.simpleName}: ${error.message}")
            LinkRead(null, "", "none", "googledoc: ${error::class.simpleName}: ${error.message}")
        }
    }

    private suspend fun readTweet(url: String): LinkRead? {
        val path = hostAndPath(url)?.second ?: return null
        val match = Regex("""^/(@?[A-Za-z0-9_]{1,15})/status/(\d+)""").find(path) ?: return null
        val handle = match.groupValues[1].removePrefix("@")
        val statusId = match.groupValues[2]
        return try {
            LogBus.log("link", "fxtwitter fetch: https://api.fxtwitter.com/$handle/status/$statusId")
            val response = http.get("https://api.fxtwitter.com/$handle/status/$statusId")
            LogBus.log("link", "fxtwitter response: HTTP ${response.status.value}")
            if (response.status.value !in 200..299) {
                LogBus.log("link", "fxtwitter HTTP ${response.status.value}")
                return null
            }
            val parsed = json.decodeFromString(TweetResponse.serializer(), response.bodyAsText())
            val tweetText = parsed.tweet?.text?.trim()
            if (!tweetText.isNullOrBlank() && tweetText.length > 5) {
                val author = parsed.tweet?.author
                val authorName = author?.name ?: "Unknown"
                // Evidence = what the source says. The author stays in SOURCES
                // (pageTitle) — not inside the evidence text, so a small model
                // cannot anchor the summary on who wrote it.
                LinkRead(
                    pageTitle = "$authorName on X",
                    pageText = tweetText,
                    source = "tweet",
                )
            } else {
                null
            }
        } catch (error: Exception) {
            LogBus.log("link", "fxtwitter failed: ${error::class.simpleName}: ${error.message}")
            null
        }
    }
}
