package com.dumpit.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.dumpit.app.AppContainer

private enum class Screen { INBOX, DETAIL, LOGS }

@Composable
fun DumpitAppUi(container: AppContainer) {
    val items by container.dumpStore.items.collectAsState()
    val hydrated by container.dumpStore.hydrated.collectAsState()
    val palette = rememberPalette()

    var screen by remember { mutableStateOf(Screen.INBOX) }
    var selectedId by remember { mutableStateOf<String?>(null) }

    val selected = selectedId?.let { id -> items.find { it.id == id } }

    Box(Modifier.fillMaxSize().background(palette.bg).systemBarsPadding()) {
        when {
            screen == Screen.LOGS -> {
                BackHandler { screen = Screen.INBOX }
                LogsScreen(onBack = { screen = Screen.INBOX })
            }
            selected != null -> {
                BackHandler { screen = Screen.INBOX; selectedId = null }
                DetailScreen(
                    item = selected,
                    container = container,
                    onBack = { screen = Screen.INBOX; selectedId = null },
                    onDelete = { id ->
                        container.dumpStore.removeItem(id)
                        screen = Screen.INBOX
                        selectedId = null
                    },
                )
            }
            else -> {
                InboxScreen(
                    items = items,
                    hydrated = hydrated,
                    onOpen = { id -> selectedId = id; screen = Screen.DETAIL },
                    onDelete = { id -> container.dumpStore.removeItem(id) },
                    onOpenLogs = { screen = Screen.LOGS },
                )
            }
        }
    }
}
