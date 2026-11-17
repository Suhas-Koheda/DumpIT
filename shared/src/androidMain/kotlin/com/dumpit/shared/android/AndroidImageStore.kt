package com.dumpit.shared.android

import android.content.Context
import android.net.Uri
import com.dumpit.shared.classify.makeId
import com.dumpit.shared.store.ImageStore
import com.dumpit.shared.store.StoredImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** Copies shared images (content:// URIs) into filesDir/images so they survive cache eviction/share-intent grants expiring. */
class AndroidImageStore(private val context: Context) : ImageStore {

    private val imagesDir: File
        get() = File(context.filesDir, "dumpit-images").apply { mkdirs() }

    override suspend fun store(sourceUri: String, mimeType: String?, originalName: String?): StoredImage =
        withContext(Dispatchers.IO) {
            val ext = extensionOf(sourceUri, originalName)
            val name = "shot-${makeId()}$ext"
            val target = File(imagesDir, name)
            val input = context.contentResolver.openInputStream(Uri.parse(sourceUri))
                ?: throw IllegalStateException("Unable to open shared image: $sourceUri")
            input.use { src -> target.outputStream().use { dst -> src.copyTo(dst) } }
            StoredImage(uri = target.absolutePath, name = name)
        }

    override fun delete(imageUri: String?) {
        if (imageUri.isNullOrBlank()) return
        try {
            File(imageUri).delete()
        } catch (_: Exception) {
            // Best effort — orphaned files are harmless.
        }
    }

    private fun extensionOf(uri: String, originalName: String?): String {
        val nameExt = originalName?.let { Regex("""\.[a-zA-Z0-9]{2,5}$""").find(it)?.value?.lowercase() }
        if (nameExt != null) return nameExt
        val uriExt = Regex("""\.[a-zA-Z0-9]{2,5}$""").find(uri.substringBefore('?'))?.value?.lowercase()
        return uriExt ?: ".jpg"
    }
}
