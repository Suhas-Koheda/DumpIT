package com.dumpit.shared.android

import com.dumpit.shared.model.DumpItem
import com.dumpit.shared.store.ItemStorage
import com.dumpit.shared.store.LogBus
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
        if (!file.exists()) {
            LogBus.log("store", "no persisted dumps file — first run")
            return@withContext emptyList()
        }
        try {
            json.decodeFromString<List<DumpItem>>(file.readText())
        } catch (error: Exception) {
            // Never silently lose data: move the unreadable file aside before
            // anything can overwrite it, and scream in the log.
            val backup = File(file.parentFile, "${file.name}.corrupt-${System.currentTimeMillis()}")
            runCatching { file.renameTo(backup) }
            LogBus.log("store", "FAILED to decode dumps (${file.length()} bytes) — backed up to ${backup.name}: ${error.message}")
            emptyList()
        }
    }

    override suspend fun save(items: List<DumpItem>) = withContext(Dispatchers.IO) {
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeText(json.encodeToString(items))
        tmp.renameTo(file)
        Unit
    }
}
