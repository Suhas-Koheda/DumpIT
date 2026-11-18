package com.dumpit.shared.android

import android.content.Context
import com.dumpit.shared.model.AgentStatus
import com.dumpit.shared.model.DumpItem
import com.dumpit.shared.store.ItemStorage
import com.dumpit.shared.store.LogBus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.withLock
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
    private val saveMutex = Mutex()

    override suspend fun load(): List<DumpItem>? = withContext(Dispatchers.IO) {
        if (!file.exists()) {
            LogBus.log("store", "no persisted dumps file — first run")
            return@withContext emptyList()
        }
        try {
            json.decodeFromString<List<DumpItem>>(file.readText())
                // A dump killed mid-agent comes back as PENDING instead of
                // being stuck in RUNNING forever.
                .map { item -> if (item.agent == AgentStatus.RUNNING) item.copy(agent = AgentStatus.PENDING) else item }
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
        saveMutex.withLock {
            val tmp = File(file.parentFile, "${file.name}.${System.nanoTime()}.tmp")
            try {
                tmp.writeText(json.encodeToString(items))
                if (!tmp.renameTo(file)) {
                    tmp.copyTo(file, overwrite = true)
                    tmp.delete()
                }
            } catch (error: Throwable) {
                runCatching { tmp.delete() }
                LogBus.log("store", "FAILED to persist dumps: ${error.message}")
                throw error
            }
        }
    }
}
