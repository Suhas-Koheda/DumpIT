package com.dumpit.shared.agent

import com.dumpit.shared.classify.makeId
import com.dumpit.shared.link.LinkReader
import com.dumpit.shared.link.extractAllUrls
import com.dumpit.shared.model.AgentStatus
import com.dumpit.shared.model.AgentStep
import com.dumpit.shared.model.StepKind

/**
 * Port of the LangGraph StateGraph (agent.ts): scan → read (× up to 3) →
 * summarize → finalize, same state shape, same reducers (steps/evidence/sources
 * concat), same continuation condition, same step labels. Deterministic — no
 * LLM-driven branching. The summarizer itself is pluggable (on-device MediaPipe
 * LLM on Android), exactly like llama.rn was behind `modelReady()`.
 */

private const val MAX_READS = 3

enum class Continuation { READ, SUMMARIZE }

data class AgentInput(val title: String, val text: String, val url: String?)

data class AgentState(
    val input: AgentInput,
    val candidates: List<String> = emptyList(),
    val reads: Int = 0,
    val evidenceBlocks: List<String> = emptyList(),
    val sources: List<String> = emptyList(),
    val steps: List<AgentStep> = emptyList(),
    val summary: String? = null,
)

data class AgentResult(
    val steps: List<AgentStep>,
    val summary: String?,
    val sources: List<String>,
    val extracted: String?,
)

/** Implemented on Android by MediaPipeSummarizer; falls back to evidence slice. */
interface EvidenceSummarizer {
    suspend fun summarize(title: String, text: String, evidence: String): String?
}

private fun step(label: String, kind: StepKind, status: AgentStatus = AgentStatus.RUNNING) =
    AgentStep(id = makeId(), label = label, status = status, kind = kind)

class ResearchAgent(
    private val reader: LinkReader,
    private val summarizer: EvidenceSummarizer?,
) {
    /** Build the summarize prompt — shared so it stays testable headless. */
    fun buildSummaryPrompt(title: String, text: String, evidence: String): String {
        val body = listOfNotNull(
            title.takeIf { it.isNotBlank() }?.let { "Item: $it" },
            text.takeIf { it.isNotBlank() }?.let { "Shared text: $it" },
            evidence.takeIf { it.isNotBlank() }?.let { "Page content found by the reader:\n$it" },
        ).joinToString("\n\n")

        return listOf(
            "You summarize saved content (tweets, posts, articles, docs). Reply with ONE or TWO short sentences describing what the content actually says — facts, not meta commentary. No preamble, no quotes.",
            body,
        ).joinToString("\n\n")
    }

    private suspend fun scanNode(state: AgentState): AgentState {
        val s = step("Scanning for links", StepKind.TOOL)
        val seedText = listOfNotNull(state.input.title.ifBlank { null }, state.input.text.ifBlank { null }, state.input.url)
            .joinToString(" ")
        val fromText = findLinks(seedText)
        val candidates = LinkedHashSet<String>().apply {
            state.input.url?.let { add(it) }
            addAll(fromText)
        }.toList()

        val done = s.copy(
            status = AgentStatus.DONE,
            detail = if (candidates.isNotEmpty()) "${candidates.size} link(s) found" else "No links — text only",
        )
        return state.copy(candidates = candidates, steps = state.steps + done)
    }

    private suspend fun readNode(state: AgentState): AgentState {
        val next = state.candidates.firstOrNull { url -> state.evidenceBlocks.none { it.contains(url) } }
            ?: return state.copy(reads = state.reads + 1)

        val s = step("Reading $next", StepKind.TOOL)

        return try {
            val read = reader.read(next)
            if (read.pageText.isNotBlank()) {
                val title = read.pageTitle ?: next
                val newEvidence = listOf("[${state.sources.size + 1}] $title — $next\n${read.pageText}")
                val newSources = listOf(title)
                val nested = extractAllUrls(read.pageText + " " + next)
                val newCandidates = LinkedHashSet<String>().apply {
                    addAll(state.candidates)
                    addAll(nested)
                }.toList()
                val done = s.copy(
                    status = AgentStatus.DONE,
                    detail = "${read.pageText.length} chars of evidence",
                )
                state.copy(
                    candidates = newCandidates,
                    reads = state.reads + 1,
                    evidenceBlocks = state.evidenceBlocks + newEvidence,
                    sources = state.sources + newSources,
                    steps = state.steps + done,
                )
            } else {
                val done = s.copy(status = AgentStatus.FAILED, detail = "Unreadable — ${read.error ?: "link blocked or offline"}")
                state.copy(reads = state.reads + 1, steps = state.steps + done)
            }
        } catch (e: Exception) {
            val done = s.copy(status = AgentStatus.FAILED, detail = "Unreadable — ${e.message ?: e::class.simpleName}")
            state.copy(reads = state.reads + 1, steps = state.steps + done)
        }
    }

    private suspend fun summarizeNode(state: AgentState): AgentState {
        val s = step("Summarizing…", StepKind.THINK)
        val evidence = state.evidenceBlocks.joinToString("\n\n")

        // Pure data: if the on-device model can't handle the context, there is no
        // heuristic fallback — summary stays null and the evidence is kept as-is.
        val summary = summarizer?.summarize(state.input.title, state.input.text, evidence)

        val done = s.copy(
            status = AgentStatus.DONE,
            detail = summary ?: "No summary — on-device model not available",
        )
        return state.copy(summary = summary, steps = state.steps + done)
    }

    private fun finalizeNode(state: AgentState): AgentState {
        val s = step("Research complete", StepKind.DONE, AgentStatus.DONE)
        return state.copy(steps = state.steps + s)
    }

    private fun shouldContinue(state: AgentState): Continuation {
        val unread = state.candidates.any { url -> state.evidenceBlocks.none { it.contains(url) } }
        return if (unread && state.reads < MAX_READS) Continuation.READ else Continuation.SUMMARIZE
    }

    /** find_links tool — extract URLs from a block of text. */
    fun findLinks(text: String): List<String> = extractAllUrls(text)

    suspend fun run(
        input: AgentInput,
        onSteps: (List<AgentStep>) -> Unit = {},
    ): AgentResult {
        var state = AgentState(input = input)

        state = scanNode(state)
        onSteps(state.steps)

        while (shouldContinue(state) == Continuation.READ) {
            state = readNode(state)
            onSteps(state.steps)
        }

        state = summarizeNode(state)
        onSteps(state.steps)

        state = finalizeNode(state)
        onSteps(state.steps)

        return AgentResult(
            steps = state.steps,
            summary = state.summary,
            sources = state.sources,
            extracted = state.evidenceBlocks.takeIf { it.isNotEmpty() }?.joinToString("\n\n"),
        )
    }
}
