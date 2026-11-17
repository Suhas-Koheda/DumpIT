package com.dumpit.shared.android

import com.dumpit.shared.model.DumpItem
import com.dumpit.shared.store.ItemStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File

private val json = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    encodeDefaults = true
}

/** Dumps persisted as one JSON array in a file under the app's files dir. */
class AndroidItemStorage(dir: File) : ItemStorage {

    private val file = File(dir, "dumpit.items.v1")

    override suspend fun load(): List<DumpItem>? = withContext(Dispatchers.IO) {
        if (!file.exists()) return@withContext emptyList()
        try {
            json.decodeFromString<List<DumpItem>>(file.readText())
        } catch (_: Exception) {
            // Corrupted data — start clean.
            null
        }
    }

    override suspend fun save(items: List<DumpItem>) = withContext(Dispatchers.IO) {
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeText(json.encodeToString(items))
        tmp.renameTo(file)
        Unit
    }
}
