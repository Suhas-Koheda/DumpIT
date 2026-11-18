package com.dumpit.app.ocr

import android.content.Context
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File

/**
 * On-device OCR via ML Kit Text Recognition v2 (bundled, Latin script).
 * Feeds screenshot/photo text into the dump + agent so the AI can read it.
 */
object ScreenshotOcr {

    fun recognize(context: Context, imagePath: String): String? {
        val file = File(imagePath)
        if (!file.exists()) return null
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        return try {
            val image = InputImage.fromFilePath(context, Uri.fromFile(file))
            // Block up to 10 s — screenshots are small.
            val result = Tasks.await(recognizer.process(image), 10_000, java.util.concurrent.TimeUnit.MILLISECONDS)
            result?.text?.trim()?.takeIf { it.isNotEmpty() }
        } catch (_: Exception) {
            null
        } finally {
            recognizer.close()
        }
    }
}
