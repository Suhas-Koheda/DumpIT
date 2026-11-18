package com.dumpit.shared.android

import android.content.Context
import com.dumpit.shared.agent.EvidenceSummarizer
import com.dumpit.shared.store.LogBus
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.Properties

/**
 * Google's MediaPipe LLM Inference API (LiteRT) on Android — the on-device
 * summarizer. Models are NOT bundled in the APK; the user picks one from the
 * catalog (or uses a model already on the device) and it downloads into
 * filesDir/dumpit-models. If no usable model is selected or inference fails,
 * the agent keeps the evidence and reports no summary — no heuristic fallback.
 *
 * Already-present models are picked up by scanning:
 *   1. filesDir/dumpit-models  — .task (usable) and .gguf (legacy llama.rn, unusable)
 *   2. /sdcard/Download, /sdcard/Models — .task only, best effort (scoped storage)
 */
class MediaPipeSummarizer(private val context: Context) : EvidenceSummarizer {

    private val modelDir: File get() = File(context.filesDir, "dumpit-models").apply { mkdirs() }
    private val selectionFile: File get() = File(modelDir, "selected.properties")

    companion object {
        /** Prompt budget in chars that safely fits maxTokens=2048 (input+output, any script). */
        private const val SAFE_PROMPT_CHARS = 2800
        private const val CHUNK_CHARS = 2400
    }

    fun catalog(): List<CatalogModel> = MODEL_CATALOG

    /** Files on the device that look like models. .task = usable, .gguf = legacy. */
    fun foundModels(): List<FoundModel> {
        val found = mutableListOf<FoundModel>()

        modelDir.listFiles()?.filter { it.isFile }?.forEach { file ->
            classify(file, "app storage")?.let { found += it }
        }

        listOf("/sdcard/Download", "/sdcard/Models").forEach { dir ->
            runCatching { File(dir).listFiles() }.getOrNull()?.filter { it.isFile }?.forEach { file ->
                val name = file.name.lowercase()
                if (name.endsWith(".task")) {
                    found += FoundModel(
                        fileName = file.name,
                        sizeBytes = file.length(),
                        usable = true,
                        location = dir,
                        path = file.absolutePath,
                    )
                }
            }
        }

        return found.sortedByDescending { it.sizeBytes }
    }

    private fun classify(file: File, location: String): FoundModel? {
        val name = file.name.lowercase()
        val usable = name.endsWith(".task")
        val legacy = name.endsWith(".gguf")
        if (!usable && !legacy) return null
        if (file.length() == 0L) return null
        return FoundModel(
            fileName = file.name,
            sizeBytes = file.length(),
            usable = usable,
            location = location,
            path = file.absolutePath,
        )
    }

    /** The selected .task file, or the first usable one found, or null. */
    fun activeModelFile(): File? {
        val selected = readSelection()
        val selectedFile = selected?.let { File(modelDir, it) }
        if (selectedFile != null && selectedFile.exists() && selectedFile.length() > 0) return selectedFile
        return foundModels().firstOrNull { it.usable && it.location == "app storage" }
            ?.let { File(it.path) }
    }

    fun activeModelName(): String? = activeModelFile()?.name

    fun modelReady(): Boolean = activeModelFile() != null

    fun selectModel(fileName: String) {
        val props = Properties()
        props.setProperty("selected", fileName)
        selectionFile.outputStream().use { props.store(it, "DumpIT model selection") }
        release()
        LogBus.log("model", "selected $fileName")
    }

    private fun readSelection(): String? = runCatching {
        if (!selectionFile.exists()) return@runCatching null
        val props = Properties()
        selectionFile.inputStream().use { props.load(it) }
        props.getProperty("selected")?.takeIf { it.isNotBlank() }
    }.getOrNull()

    @Volatile
    private var llm: LlmInference? = null

    override suspend fun summarize(title: String, text: String, evidence: String): String? =
        withContext(Dispatchers.IO) {
            val engine = getLlm() ?: return@withContext null
            val full = buildPrompt(title, text, evidence)

            // The task's maxTokens covers input + output. If the full prompt does not
            // fit, chunk the evidence losslessly (every section gets summarized, the
            // summaries are then merged). Never abort the process with an oversized prompt.
            if (full.length > SAFE_PROMPT_CHARS) {
                LogBus.log("model", "evidence too large for single prompt (${full.length} chars) — chunked summarize")
                return@withContext summarizeChunked(engine, title, text, evidence)
            }

            runCatching { engine.generateResponse(full) }
                .getOrNull()
                ?.trim()
                ?.takeIf { it.isNotBlank() }
        }

    private fun summarizeChunked(
        engine: LlmInference,
        title: String,
        text: String,
        evidence: String,
    ): String? {
        val chunks = chunkText(evidence, CHUNK_CHARS)
        LogBus.log("model", "chunked summarize: ${chunks.size} chunk(s)")

        val partials = chunks.mapNotNull { chunk ->
            runCatching {
                engine.generateResponse(
                    listOf(
                        "Summarize ONLY this section of a longer saved item in ONE or TWO short sentences — the facts, ideas and claims in it, not the author or platform.",
                        "Section:\n$chunk",
                    ).joinToString("\n\n")
                )
            }.getOrNull()?.trim()?.takeIf { it.isNotBlank() }
        }
        if (partials.isEmpty()) return null

        val joined = partials.mapIndexed { index, part -> "Section ${index + 1}: $part" }
            .joinToString("\n")
            .take(2200) // merge prompt must also fit the context window

        return runCatching {
            engine.generateResponse(
                listOf(
                    "These are summaries of consecutive sections of one saved item. Combine them into ONE or TWO short sentences describing what the item actually says — facts and claims, not the author, not the platform. Do NOT describe the author.",
                    title.takeIf { it.isNotBlank() }?.let { "Item: $it" },
                    "Section summaries:\n$joined",
                ).filterNotNull().joinToString("\n\n")
            )
        }.getOrNull()?.trim()?.takeIf { it.isNotBlank() }
    }

    /** Greedy pack on paragraph/line boundaries; hard-split anything over budget. */
    private fun chunkText(input: String, maxChars: Int): List<String> {
        val chunks = mutableListOf<String>()
        var current = StringBuilder()
        for (paragraph in input.split("\n\n", "\n")) {
            if (paragraph.isBlank()) continue
            if (current.length + paragraph.length + 2 > maxChars) {
                if (current.isNotEmpty()) {
                    chunks += current.toString()
                    current = StringBuilder()
                }
                var rest = paragraph
                while (rest.length > maxChars) {
                    chunks += rest.take(maxChars)
                    rest = rest.drop(maxChars)
                }
                current.append(rest)
            } else {
                if (current.isNotEmpty()) current.append("\n\n")
                current.append(paragraph)
            }
        }
        if (current.isNotEmpty()) chunks += current.toString()
        return chunks
    }

    private fun buildPrompt(title: String, text: String, evidence: String): String {
        val body = listOfNotNull(
            title.takeIf { it.isNotBlank() }?.let { "Item: $it" },
            text.takeIf { it.isNotBlank() }?.let { "Shared text: $it" },
            evidence.takeIf { it.isNotBlank() }?.let { "Page content found by the reader:\n$it" },
        ).joinToString("\n\n")

        return listOf(
            "You summarize saved content (tweets, posts, articles, docs). Reply with ONE or TWO short sentences describing what the content itself says — the facts, ideas and claims it contains. Do NOT describe the author, their handle, job title, the platform, or call the content a tweet. Never start with a name or a platform name.",
            "BAD example — never write this: \"Tilak is an AI Engineer who shared a link to his roadmap.\" (describes the person, not the content)",
            "GOOD example — write like this: \"The post links a 2026 AI Engineer roadmap aimed at builders shipping RAG, agents, tools and evals on foundation models.\" (describes what the content says)",
            body,
        ).joinToString("\n\n")
    }

    private fun getLlm(): LlmInference? {
        val file = activeModelFile() ?: return null
        llm?.let { return it }
        return synchronized(this) {
            llm ?: runCatching {
                val options = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(file.absolutePath)
                    .setMaxTokens(2048)
                    .setMaxTopK(1) // greedy decode
                    .build()
                LlmInference.createFromOptions(context, options)
            }.getOrNull().also { llm = it }
        }
    }

    /** Download a catalog model with progress. Selects it on success. */
    suspend fun downloadModel(model: CatalogModel, onProgress: (bytesDone: Long, totalBytes: Long) -> Unit): Unit =
        withContext(Dispatchers.IO) {
            val target = File(modelDir, model.fileName)
            if (target.exists() && target.length() > 0) {
                selectModel(model.fileName)
                return@withContext
            }
            LogBus.log("model", "download started: ${model.name}")
            val tmp = File(modelDir, "${target.name}.part")
            if (tmp.exists()) tmp.delete()

            val connection = (URL(model.url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15_000
                readTimeout = 30_000
                instanceFollowRedirects = true
            }
            try {
                connection.connect()
                if (connection.responseCode !in 200..299) {
                    throw IOException("Download failed: HTTP ${connection.responseCode}")
                }
                val total = connection.contentLengthLong
                var done = 0L
                val buffer = ByteArray(64 * 1024)
                connection.inputStream.use { input ->
                    tmp.outputStream().use { output ->
                        while (true) {
                            val read = input.read(buffer)
                            if (read == -1) break
                            output.write(buffer, 0, read)
                            done += read
                            onProgress(done, total)
                        }
                    }
                }
                if (!tmp.renameTo(target)) {
                    tmp.copyTo(target, overwrite = true)
                    tmp.delete()
                }
                LogBus.log("model", "download complete: ${model.name} (${target.length()} bytes)")
                selectModel(model.fileName)
            } catch (error: Throwable) {
                tmp.delete()
                LogBus.log("model", "download failed: ${model.name} — ${error.message ?: error::class.simpleName}")
                throw error
            } finally {
                connection.disconnect()
            }
        }

    fun release() {
        try {
            llm?.close()
        } catch (_: Throwable) {
            // ignore
        }
        llm = null
    }
}
