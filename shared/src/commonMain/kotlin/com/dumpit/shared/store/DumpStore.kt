package com.dumpit.shared.store

import com.dumpit.shared.agent.AgentInput
import com.dumpit.shared.agent.ResearchAgent
import com.dumpit.shared.classify.detectPlatform
import com.dumpit.shared.classify.extractUrl
import com.dumpit.shared.classify.hostOf
import com.dumpit.shared.classify.makeId
import com.dumpit.shared.classify.readableBlurb
import com.dumpit.shared.model.AgentStatus
import com.dumpit.shared.model.DumpItem
import com.dumpit.shared.model.DumpKind
import com.dumpit.shared.model.Platform
import com.dumpit.shared.model.SharePayload
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/** Platform-agnostic contracts. Implemented in androidMain. */
interface ItemStorage {
    suspend fun load(): List<DumpItem>?
    suspend fun save(items: List<DumpItem>)
}

interface ImageStore {
    /** Copy an incoming shared file (content:// URI) into app-private storage. */
    suspend fun store(sourceUri: String, mimeType: String?, originalName: String?): StoredImage
    fun delete(imageUri: String?)
}

data class StoredImage(val uri: String, val name: String)

/**
 * Shared dump store — the DumpProvider equivalent. Holds items as a StateFlow,
 * persists on every mutation, and runs the research agent one item at a time
 * (latest share first), exactly like the RN effect-driven loop.
 */
class DumpStore(
    private val storage: ItemStorage,
    private val imageStore: ImageStore,
    private val agent: ResearchAgent,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val _items = MutableStateFlow<List<DumpItem>>(emptyList())
    val items: StateFlow<List<DumpItem>> = _items.asStateFlow()

    private val _hydrated = MutableStateFlow(false)
    val hydrated: StateFlow<Boolean> = _hydrated.asStateFlow()

    private val agentMutex = Mutex()

    init {
        scope.launch {
            LogBus.log("store", "loading persisted dumps")
            val persisted = runCatching { storage.load() }.getOrNull() ?: emptyList()
            _items.value = persisted
            _hydrated.value = true
            LogBus.log("store", "hydrated with ${persisted.size} dump(s)")
            triggerAgent()
        }
    }

    private fun persist() {
        val snapshot = _items.value
        scope.launch { runCatching { storage.save(snapshot) } }
    }

    private suspend fun updateItem(id: String, transform: (DumpItem) -> DumpItem) {
        _items.value = _items.value.map { if (it.id == id) transform(it) else it }
    }

    /** Creates dumps from a share payload. Returns the newly created items. */
    suspend fun addFromShare(payload: SharePayload): List<DumpItem> = withContext(Dispatchers.Default) {
        data class Built(
            val kind: DumpKind,
            val platform: Platform?,
            val title: String,
            val text: String,
            val url: String?,
            val urlHost: String?,
            val imageUri: String?,
            val imageName: String?,
            val agent: AgentStatus,
        )

        val built = mutableListOf<Built>()
        val now = System.currentTimeMillis()

        for (file in payload.files) {
            val mime = file.mimeType ?: ""
            if (mime.startsWith("image/")) {
                try {
                    val stored = imageStore.store(file.path, mime, file.fileName)
                    built += Built(
                        kind = DumpKind.IMAGE,
                        platform = null,
                        title = file.fileName?.takeIf { it.isNotBlank() } ?: "Image",
                        text = "",
                        url = null,
                        urlHost = null,
                        imageUri = stored.uri,
                        imageName = stored.name,
                        agent = AgentStatus.SKIPPED,
                    )
                } catch (_: Exception) {
                    built += Built(
                        kind = DumpKind.TEXT,
                        platform = null,
                        title = "Unreadable image",
                        text = "An image was shared but could not be read (${file.fileName ?: "unknown"}).",
                        url = null,
                        urlHost = null,
                        imageUri = null,
                        imageName = null,
                        agent = AgentStatus.SKIPPED,
                    )
                }
            } else {
                built += Built(
                    kind = DumpKind.TEXT,
                    platform = null,
                    title = file.fileName?.takeIf { it.isNotBlank() } ?: "Shared file",
                    text = "Shared file: ${file.fileName ?: file.path} (${file.mimeType ?: "unknown type"})",
                    url = null,
                    urlHost = null,
                    imageUri = null,
                    imageName = null,
                    agent = AgentStatus.SKIPPED,
                )
            }
        }

        val sharedUrl = payload.webUrl ?: extractUrl(payload.text)
        val blurb = readableBlurb(payload.text, sharedUrl)
        if (sharedUrl != null) {
            built += Built(
                kind = DumpKind.LINK,
                platform = detectPlatform(sharedUrl),
                title = payload.metaTitle?.trim()?.takeIf { it.isNotBlank() }
                    ?: blurb.takeIf { it.isNotBlank() }
                    ?: hostOf(sharedUrl)
                    ?: sharedUrl,
                text = blurb,
                url = sharedUrl,
                urlHost = hostOf(sharedUrl),
                imageUri = null,
                imageName = null,
                agent = AgentStatus.PENDING,
            )
        } else if (!payload.text.isNullOrBlank()) {
            val text = payload.text.trim()
            built += Built(
                kind = DumpKind.TEXT,
                platform = null,
                title = text.lineSequence().firstOrNull() ?: "",
                text = text,
                url = null,
                urlHost = null,
                imageUri = null,
                imageName = null,
                agent = AgentStatus.PENDING,
            )
        }

        val withIds = built.mapIndexed { index, item ->
            DumpItem(
                id = makeId(),
                kind = item.kind,
                platform = item.platform,
                title = item.title,
                text = item.text,
                url = item.url,
                urlHost = item.urlHost,
                imageUri = item.imageUri,
                imageName = item.imageName,
                createdAt = now + index,
                agent = item.agent,
            )
        }
        if (payload.files.isNotEmpty() || payload.text != null || payload.webUrl != null) {
            LogBus.log(
                "share",
                "share received: text=${payload.text ?: "∅"}, files=${payload.files.size}, webUrl=${payload.webUrl ?: "∅"}",
            )
        }
        withIds.forEach { item ->
            LogBus.log("dump", "created ${item.kind}${item.urlHost?.let { " link=$it" } ?: ""} — ${item.title}")
        }
        if (withIds.isNotEmpty()) {
            _items.value = withIds + _items.value
            persist()
            triggerAgent()
        }
        withIds
    }

    fun removeItem(id: String) {
        val target = _items.value.firstOrNull { it.id == id }
        if (target != null) imageStore.delete(target.imageUri)
        _items.value = _items.value.filterNot { it.id == id }
        persist()
    }

    fun rerunAgent(id: String) {
        _items.value = _items.value.map { item ->
            if (item.id == id) {
                item.copy(
                    agent = AgentStatus.PENDING,
                    steps = emptyList(),
                    summary = null,
                    sources = emptyList(),
                    extracted = null,
                )
            } else {
                item
            }
        }
        persist()
        triggerAgent()
    }

    private fun triggerAgent() {
        scope.launch { processPending() }
    }

    private suspend fun processPending() = agentMutex.withLock {
        while (true) {
            val next = _items.value.firstOrNull { it.agent == AgentStatus.PENDING } ?: break
            LogBus.log("agent", "started for dump ${next.id} — ${next.title}")
            updateItem(next.id) { it.copy(agent = AgentStatus.RUNNING) }
            persist()
            try {
                val result = agent.run(
                    AgentInput(title = next.title, text = next.text, url = next.url),
                ) { steps ->
                    _items.value = _items.value.map { item ->
                        if (item.id == next.id) item.copy(steps = steps) else item
                    }
                    persist()
                }
                updateItem(next.id) { item ->
                    item.copy(
                        agent = AgentStatus.DONE,
                        steps = result.steps,
                        summary = result.summary,
                        sources = result.sources,
                        extracted = result.extracted,
                    )
                }
                LogBus.log("agent", "done for dump ${next.id} — ${result.sources.size} source(s), summary ${result.summary?.length ?: 0} chars")
            } catch (_: Throwable) {
                updateItem(next.id) { it.copy(agent = AgentStatus.FAILED) }
                LogBus.log("agent", "FAILED for dump ${next.id}")
            }
            persist()
        }
    }
}
