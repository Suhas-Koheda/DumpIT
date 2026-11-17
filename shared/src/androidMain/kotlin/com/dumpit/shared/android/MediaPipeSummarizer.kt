package com.dumpit.shared.android

import android.content.Context
import com.dumpit.shared.agent.EvidenceSummarizer
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Google's MediaPipe LLM Inference API (LiteRT) on Android — the on-device
 * summarizer. The model is NOT bundled in the APK: it's the same Qwen2.5-0.5B
 * instructions model the old app used, in MediaPipe's .task format (q8,
 * Apache-2.0, ungated), downloaded on first use into filesDir/dumpit-models.
 * If the model isn't downloaded or inference fails, callers fall back to a
 * plain evidence slice — the agent works fully offline either way.
 */
class MediaPipeSummarizer(private val context: Context) : EvidenceSummarizer {

    companion object {
        const val MODEL_NAME = "Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task"
        const val MODEL_URL =
            "https://huggingface.co/litert-community/Qwen2.5-0.5B-Instruct/resolve/main/Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task"
    }

    private val modelDir: File get() = File(context.filesDir, "dumpit-models")

    fun modelFile(): File = File(modelDir, MODEL_NAME)

    fun modelReady(): Boolean = modelFile().let { it.exists() && it.length() > 0 }

    @Volatile
    private var llm: LlmInference? = null

    private fun buildPrompt(title: String, text: String, evidence: String): String {
        val body = listOfNotNull(
            title.takeIf { it.isNotBlank() }?.let { "Item: $it" },
            text.takeIf { it.isNotBlank() }?.let { "Shared text: $it" },
            evidence.takeIf { it.isNotBlank() }?.let { "Page content found by the reader:\n${it.take(3200)}" },
        ).joinToString("\n\n").take(4200)

        return listOf(
            "You summarize saved content (tweets, posts, articles, docs). Reply with ONE or TWO short sentences describing what the content actually says — facts, not meta commentary. No preamble, no quotes.",
            body,
        ).joinToString("\n\n")
    }

    override suspend fun summarize(title: String, text: String, evidence: String): String? =
        withContext(Dispatchers.IO) {
            val engine = getLlm() ?: return@withContext null
            try {
                engine.generateResponse(buildPrompt(title, text, evidence))
                    ?.trim()
                    ?.take(400)
                    ?.takeIf { it.isNotBlank() }
            } catch (_: Throwable) {
                null
            }
        }

    private fun getLlm(): LlmInference? {
        llm?.let { return it }
        if (!modelReady()) return null
        return synchronized(this) {
            llm ?: runCatching {
                val options = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(modelFile().absolutePath)
                    .setMaxTokens(512)
                    .setMaxTopK(1) // greedy decode — same as the old temperature=0
                    .build()
                LlmInference.createFromOptions(context, options)
            }.getOrNull().also { llm = it }
        }
    }

    /** Download the model with progress callbacks. Throws on failure, deletes partial files. */
    suspend fun downloadModel(onProgress: (bytesDone: Long, totalBytes: Long) -> Unit): Unit =
        withContext(Dispatchers.IO) {
            val target = modelFile()
            if (target.exists() && target.length() > 0) return@withContext
            modelDir.mkdirs()
            val tmp = File(modelDir, "${target.name}.part")
            if (tmp.exists()) tmp.delete()

            val connection = (URL(MODEL_URL).openConnection() as HttpURLConnection).apply {
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
            } catch (error: Throwable) {
                tmp.delete()
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
