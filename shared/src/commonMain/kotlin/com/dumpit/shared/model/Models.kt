package com.dumpit.shared.model

import kotlinx.serialization.Serializable

@Serializable
enum class DumpKind { TEXT, LINK, IMAGE }

@Serializable
enum class Platform { X, LINKEDIN, WEB }

@Serializable
enum class AgentStatus { PENDING, RUNNING, DONE, FAILED, SKIPPED }

@Serializable
enum class StepKind { TOOL, THINK, DONE }

@Serializable
data class AgentStep(
    val id: String,
    val label: String,
    val detail: String? = null,
    val status: AgentStatus = AgentStatus.RUNNING,
    val kind: StepKind = StepKind.TOOL,
)

@Serializable
data class DumpItem(
    val id: String,
    val kind: DumpKind,
    val platform: Platform? = null,
    val title: String = "",
    val text: String = "",
    val url: String? = null,
    val urlHost: String? = null,
    val imageUri: String? = null,
    val imageName: String? = null,
    val createdAt: Long,
    val agent: AgentStatus = AgentStatus.PENDING,
    val steps: List<AgentStep> = emptyList(),
    val summary: String? = null,
    val sources: List<String> = emptyList(),
    val extracted: String? = null,
)

/** What a share-intent payload carries in, mirroring the old RN SharePayload. */
@Serializable
data class ShareFile(
    val path: String,
    val mimeType: String? = null,
    val fileName: String? = null,
)

@Serializable
data class SharePayload(
    val text: String? = null,
    val webUrl: String? = null,
    val files: List<ShareFile> = emptyList(),
    val metaTitle: String? = null,
)
