package com.dumpit.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Image
import com.dumpit.shared.model.DumpItem
import com.dumpit.shared.model.DumpKind

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun InboxScreen(
    items: List<DumpItem>,
    hydrated: Boolean,
    onOpen: (String) -> Unit,
    onDelete: (String) -> Unit,
    onOpenLogs: () -> Unit,
    onToggleTodoDone: (String) -> Unit,
) {
    val palette = rememberPalette()
    var deleteTarget by remember { mutableStateOf<DumpItem?>(null) }
    var filter by remember { mutableStateOf("ALL") } // ALL | TODO | DUMP

    val visible = remember(items, filter) {
        when (filter) {
            "TODO" -> items.filter { it.isTodo }
            "DUMP" -> items.filterNot { it.isTodo }
            else -> items
        }
    }

    if (!hydrated) {
        Box(Modifier.fillMaxSize().background(palette.bg), contentAlignment = Alignment.Center) {
            LoadingIndicator(color = palette.accent)
        }
        return
    }

    Column(Modifier.fillMaxSize().background(palette.bg)) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "DumpIT",
                    fontSize = 32.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 2.sp,
                    color = palette.text,
                )
                Text(
                    "Share it. Dump it. Deal with it later.",
                    fontSize = 13.sp,
                    color = palette.muted,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(palette.card)
                    .border(1.dp, palette.border, RoundedCornerShape(999.dp))
                    .clickable(onClick = onOpenLogs)
                    .padding(horizontal = 12.dp, vertical = 6.dp)
                    .height(28.dp)
                    .testTag("logs"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "LOGS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.2.sp,
                    color = palette.accent,
                )
            }
            Spacer(Modifier.width(10.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(palette.card)
                    .border(1.dp, palette.border, RoundedCornerShape(999.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
                    .height(28.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "${items.size}",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = palette.accent,
                )
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(palette.border))

        FilterChips(filter, onFilter = { filter = it }, palette = palette)

        if (visible.isEmpty()) {
            EmptyState(palette)
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(visible, key = { it.id }) { item ->
                    DumpCard(
                        item = item,
                        palette = palette,
                        onOpen = { onOpen(item.id) },
                        onRequestDelete = { deleteTarget = item },
                        onToggleTodoDone = onToggleTodoDone,
                    )
                }
            }
        }
    }

    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete dump?") },
            text = { Text("This removes it from your phone.") },
            confirmButton = {
                TextButton(onClick = {
                    onDelete(target.id)
                    deleteTarget = null
                }) { Text("Delete", color = palette.danger) }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun EmptyState(palette: Palette) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 72.dp, start = 32.dp, end = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("↡", fontSize = 56.sp, color = palette.faint)
        Text("Nothing here yet", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = palette.text)
        Text(
            "Share a tweet, a link, an article or a screenshot to DumpIT — it lands here, stored on your phone.",
            fontSize = 14.sp,
            lineHeight = 21.sp,
            color = palette.muted,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
    }
}

@Composable
private fun DumpCard(
    item: DumpItem,
    palette: Palette,
    onOpen: () -> Unit,
    onRequestDelete: () -> Unit,
    onToggleTodoDone: (String) -> Unit,
) {
    val bitmap = rememberImageBitmap(if (item.kind == DumpKind.IMAGE) item.imageUri else null)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(palette.card)
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .clickable(onClick = onOpen)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Badge(item, palette)
            Spacer(Modifier.weight(1f))
            Text(timeAgo(item.createdAt), fontSize = 12.sp, color = palette.faint)
            Spacer(Modifier.width(12.dp))
            if (item.isTodo) {
                Box(
                    modifier = Modifier
                        .clickable { onToggleTodoDone(item.id) }
                        .padding(horizontal = 6.dp, vertical = 4.dp)
                        .testTag("todo-${item.id}"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        if (item.done) "✓" else "◯",
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (item.done) palette.accent else palette.muted,
                    )
                }
            }
            Text(
                "✕",
                fontSize = 17.sp,
                color = palette.muted,
                modifier = Modifier
                    .clickable(onClick = onRequestDelete)
                    .padding(horizontal = 6.dp, vertical = 4.dp)
                    .testTag("delete-${item.id}"),
            )
        }

        if (item.kind == DumpKind.IMAGE) {
            if (bitmap != null) {
                Image(
                    bitmap = bitmap,
                    contentDescription = item.title,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(palette.border),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(palette.border),
                )
            }
        }

        Text(
            item.title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            lineHeight = 22.sp,
            maxLines = 2,
            color = if (item.done) palette.faint else palette.text,
            textDecoration = if (item.done) TextDecoration.LineThrough else TextDecoration.None,
        )

        // About the dump: shared text first, else the AI summary of it.
        val snippet = item.text.takeIf { it.isNotBlank() }
            ?: item.summary?.takeIf { it.isNotBlank() }
        if (snippet != null) {
            Text(
                snippet,
                fontSize = 13.sp,
                lineHeight = 18.sp,
                maxLines = 3,
                color = palette.muted,
            )
        }
        item.urlHost?.let { host ->
            Text(
                "$host ↗",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = palette.accent,
            )
        }
    }
}


@Composable
private fun FilterChips(current: String, onFilter: (String) -> Unit, palette: Palette) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        listOf("ALL" to "ALL", "TODO" to "TODO", "DUMP" to "DUMPS").forEach { (value, label) ->
            val selected = current == value
            Text(
                label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                color = if (selected) palette.onAccent else palette.muted,
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (selected) palette.accent else palette.card)
                    .border(1.dp, if (selected) palette.accent else palette.border, RoundedCornerShape(999.dp))
                    .clickable { onFilter(value) }
                    .padding(horizontal = 14.dp, vertical = 6.dp),
            )
        }
    }
}
