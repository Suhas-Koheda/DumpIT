package com.dumpit.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.dumpit.app.AppContainer

@Composable
fun DumpitAppUi(container: AppContainer) {
    val items by container.dumpStore.items.collectAsState()
    val hydrated by container.dumpStore.hydrated.collectAsState()
    var selectedId by remember { mutableStateOf<String?>(null) }

    val selected = selectedId?.let { id -> items.find { it.id == id } }

    if (selected != null) {
        BackHandler { selectedId = null }
        DetailScreen(
            item = selected,
            container = container,
            onBack = { selectedId = null },
            onDelete = { id ->
                container.dumpStore.removeItem(id)
                selectedId = null
            },
        )
    } else {
        InboxScreen(
            items = items,
            hydrated = hydrated,
            onOpen = { id -> selectedId = id },
            onDelete = { id -> container.dumpStore.removeItem(id) },
        )
    }
}
