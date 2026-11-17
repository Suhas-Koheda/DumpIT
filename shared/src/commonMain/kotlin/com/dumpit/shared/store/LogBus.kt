package com.dumpit.shared.store

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class LogLine(
    val id: Long,
    val timestamp: Long,
    val tag: String,
    val message: String,
)

/**
 * In-memory ring buffer of app events — feeds the on-device LOGS screen.
 * Not persisted across process restarts (kept deliberately small, last ~300).
 */
object LogBus {
    private const val MAX = 300
    private var nextId = 1L

    private val _lines = MutableStateFlow<List<LogLine>>(emptyList())
    val lines: StateFlow<List<LogLine>> = _lines.asStateFlow()

    fun log(tag: String, message: String) {
        val line = LogLine(
            id = nextId++,
            timestamp = System.currentTimeMillis(),
            tag = tag,
            message = message,
        )
        val current = _lines.value
        _lines.value = if (current.size >= MAX) current.drop(current.size - MAX + 1) + line else current + line
    }

    fun clear() {
        _lines.value = emptyList()
    }
}
