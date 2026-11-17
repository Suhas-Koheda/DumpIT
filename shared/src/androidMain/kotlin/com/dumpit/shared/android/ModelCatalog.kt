package com.dumpit.shared.android

/** A model the user can download/select. MediaPipe LLM Inference (.task format). */
data class CatalogModel(
    val id: String,
    val name: String,
    val fileName: String,
    val url: String,
    val sizeBytes: Long,
    val license: String,
    val blurb: String,
)

/** A model file found on the device (app-private storage or shared storage). */
data class FoundModel(
    val fileName: String,
    val sizeBytes: Long,
    /** .task files load in MediaPipe LLM Inference. .gguf (llama.rn) does not. */
    val usable: Boolean,
    val location: String,
    val path: String,
)

/**
 * Models verified to exist, be ungated, and load in MediaPipe LLM Inference.
 * Gemma 3-1B was considered and excluded: it is license-gated on Hugging Face
 * and would fail to download without auth.
 */
val MODEL_CATALOG: List<CatalogModel> = listOf(
    CatalogModel(
        id = "qwen2.5-0.5b-q8",
        name = "Qwen2.5 0.5B Instruct (q8)",
        fileName = "Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task",
        url = "https://huggingface.co/litert-community/Qwen2.5-0.5B-Instruct/resolve/main/Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task",
        sizeBytes = 521_000_000L,
        license = "Apache-2.0",
        blurb = "Tiny and fast — good enough for one-sentence summaries.",
    ),
    CatalogModel(
        id = "qwen2.5-1.5b-q8",
        name = "Qwen2.5 1.5B Instruct (q8)",
        fileName = "Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv1280.task",
        url = "https://huggingface.co/litert-community/Qwen2.5-1.5B-Instruct/resolve/main/Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv1280.task",
        sizeBytes = 1_523_000_000L,
        license = "Apache-2.0",
        blurb = "Noticeably stronger summaries, still fully on-device.",
    ),
)
