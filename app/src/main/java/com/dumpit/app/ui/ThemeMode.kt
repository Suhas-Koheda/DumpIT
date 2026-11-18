package com.dumpit.app.ui

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.util.Properties

enum class ThemeMode(val label: String) {
    SYSTEM("◐ AUTO"),
    LIGHT("☀ LIGHT"),
    DARK("☾ DARK"),
}

/**
 * App-wide theme mode. SYSTEM follows the phone; LIGHT/DARK force it.
 * Persisted in filesDir/theme-mode.properties so it survives restarts.
 */
object ThemeState {
    private var file: File? = null
    private val _mode = MutableStateFlow(ThemeMode.SYSTEM)
    val mode: StateFlow<ThemeMode> = _mode.asStateFlow()

    fun init(filesDir: File) {
        file = File(filesDir, "theme-mode.properties")
        val saved = runCatching {
            if (file?.exists() == true) {
                val props = Properties()
                file!!.inputStream().use { props.load(it) }
                props.getProperty("mode")
            } else {
                null
            }
        }.getOrNull()
        _mode.value = try {
            ThemeMode.valueOf(saved ?: "SYSTEM")
        } catch (_: Exception) {
            ThemeMode.SYSTEM
        }
    }

    fun cycle() {
        val next = when (_mode.value) {
            ThemeMode.SYSTEM -> ThemeMode.LIGHT
            ThemeMode.LIGHT -> ThemeMode.DARK
            ThemeMode.DARK -> ThemeMode.SYSTEM
        }
        _mode.value = next
        runCatching {
            file?.let { f ->
                val props = Properties()
                props.setProperty("mode", next.name)
                f.outputStream().use { props.store(it, "DumpIT theme") }
            }
        }
    }
}
