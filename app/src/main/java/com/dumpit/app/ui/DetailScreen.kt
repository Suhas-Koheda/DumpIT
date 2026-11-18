package com.dumpit.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.LinearWavyProgressIndicator
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dumpit.app.AppContainer
import com.dumpit.shared.model.AgentStatus
import com.dumpit.shared.model.DumpItem
import com.dumpit.shared.model.DumpKind
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun DetailScreen(
    item: DumpItem,
    container: AppContainer,
    onBack: () -> Unit,
    onDelete: (String) -> Unit,
) {
    val palette = rememberPalette()
    val context = LocalContext.current
    val bitmap = rememberImageBitmap(if (item.kind == DumpKind.IMAGE) item.imageUri else null)

    var confirmDelete by remember { mutableStateOf(false) }
    var showDatePicker by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.bg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "← INBOX",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                color = palette.muted,
                modifier = Modifier
                    .clickable(onClick = onBack)
                    .padding(vertical = 8.dp, horizontal = 4.dp),
            )
            Spacer(Modifier.weight(1f))
            Badge(item, palette)
        }
        Text(fullDate(item.createdAt), fontSize = 13.sp, color = palette.faint)

        if (item.kind == DumpKind.IMAGE && bitmap != null) {
            Image(
                bitmap = bitmap,
                contentDescription = item.title,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(380.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(palette.border),
                contentScale = ContentScale.Fit,
            )
        }

        item.url?.let { url ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(palette.card)
                    .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                    .clickable {
                        context.startActivity(
                            Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        )
                    }
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("↗", fontSize = 15.sp, color = palette.accent)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        item.urlHost ?: url,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = palette.accent,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Text("↗", fontSize = 14.sp, color = palette.muted)
                }
                Text(
                    url,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = palette.muted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "OPEN LINK →",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                    color = palette.accent,
                )
            }
        }

        Text(
            item.title,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            lineHeight = 29.sp,
            color = palette.text,
        )
        if (item.text.isNotBlank()) {
            Text(
                item.text,
                fontSize = 15.sp,
                lineHeight = 23.sp,
                color = palette.muted,
            )
        }

        // TODO + due date chips
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                if (item.isTodo) "MAKE DUMP" else "MAKE TODO",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                color = if (item.isTodo) palette.accent else palette.muted,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .border(1.dp, if (item.isTodo) palette.accent else palette.border, RoundedCornerShape(8.dp))
                    .clickable { container.dumpStore.toggleTodo(item.id) }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
            Text(
                if (item.dueAt != null) {
                    "DUE " + SimpleDateFormat("EEE, MMM d", Locale.getDefault()).format(Date(item.dueAt!!))
                } else {
                    "SET DUE DATE"
                },
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                color = if (item.dueAt != null) palette.accent else palette.muted,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .border(1.dp, if (item.dueAt != null) palette.accent else palette.border, RoundedCornerShape(8.dp))
                    .clickable { showDatePicker = true }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
            if (item.dueAt != null) {
                Text(
                    "CANCEL DUE",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    color = palette.faint,
                    modifier = Modifier
                        .clickable { container.dumpStore.setDueAt(item.id, null) }
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                )
            }
        }

        // ENTITIES
        if (item.entities.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                item.entities.forEach { entity ->
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(palette.card)
                            .border(1.dp, palette.border, RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            entity.kind,
                            fontSize = 8.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 1.sp,
                            color = palette.accent,
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            entity.value,
                            fontSize = 11.sp,
                            color = palette.text,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }

        AgentPanel(item = item, container = container, palette = palette)

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .border(1.dp, palette.danger, RoundedCornerShape(14.dp))
                .clickable { confirmDelete = true }
                .padding(vertical = 16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "Delete this dump",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = palette.danger,
            )
        }
        Spacer(Modifier.height(24.dp))
    }


    if (showDatePicker) {
        val initial = item.dueAt ?: System.currentTimeMillis()
        val dateState = rememberDatePickerState(initialSelectedDateMillis = initial)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    container.dumpStore.setDueAt(item.id, dateState.selectedDateMillis)
                    showDatePicker = false
                }) { Text("Set") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = dateState)
        }
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete dump?") },
            text = { Text("This removes it from your phone.") },
            confirmButton = {
                TextButton(onClick = {
                    onDelete(item.id)
                    confirmDelete = false
                }) { Text("Delete", color = palette.danger) }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
            },
        )
    }
}

private fun formatBytes(bytes: Long): String = when {
    bytes >= 1_000_000_000L -> String.format(java.util.Locale.US, "%.1f GB", bytes / 1_000_000_000.0)
    else -> String.format(java.util.Locale.US, "%d MB", bytes / 1_000_000)
}

@Composable
private fun AgentPanel(
    item: DumpItem,
    container: AppContainer,
    palette: Palette,
) {
    val scope = rememberCoroutineScope()
    var found by remember { mutableStateOf(container.summarizer.foundModels()) }
    var activeName by remember { mutableStateOf(container.summarizer.activeModelName()) }
    var downloadingName by remember { mutableStateOf<String?>(null) }
    var progress by remember { mutableFloatStateOf(0f) }
    var downloadError by remember { mutableStateOf<String?>(null) }

    val active = item.agent == AgentStatus.RUNNING || item.agent == AgentStatus.PENDING
    val catalog = remember { container.summarizer.catalog() }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(palette.card)
            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // Header: AGENT + RE-RUN
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "⚡ THE AGENT",
                fontSize = 13.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 1.4.sp,
                color = palette.accent,
            )
            Spacer(Modifier.weight(1f))
            Text(
                "RE-RUN",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                color = palette.muted,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .border(1.dp, palette.border, RoundedCornerShape(8.dp))
                    .clickable { container.dumpStore.rerunAgent(item.id) }
                    .padding(horizontal = 12.dp, vertical = 7.dp),
            )
        }

        // Read graph
        if (item.steps.isNotEmpty()) {
            ReadGraph(item, palette)
        } else if (active) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("●", fontSize = 12.sp, color = palette.accent)
                Spacer(Modifier.width(8.dp))
                Text("Starting…", fontSize = 13.sp, color = palette.muted)
            }
        }

        // Summary
        item.summary?.takeIf { it.isNotBlank() }?.let { summary ->
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(palette.border))
                Text(
                    "SUMMARY",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.4.sp,
                    color = palette.accent,
                )
                Text(summary, fontSize = 14.sp, lineHeight = 21.sp, color = palette.text)
            }
        }

        if (item.agent == AgentStatus.FAILED && item.summary.isNullOrBlank()) {
            Text(
                "The agent hit an error. Tap RE-RUN.",
                fontSize = 13.sp,
                color = palette.danger,
            )
        }

        // Sources
        if (item.sources.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(palette.border))
                Text(
                    "SOURCES",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.4.sp,
                    color = palette.accent,
                )
                item.sources.forEach { source ->
                    Text(source, fontSize = 12.sp, lineHeight = 17.sp, color = palette.muted)
                }
            }
        }

        // On-device models — pick one, or use what's already on the phone
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.fillMaxWidth().height(1.dp).background(palette.border))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "ON-DEVICE MODEL",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.4.sp,
                    color = palette.accent,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    activeName?.let { "ACTIVE: ${it.removeSuffix(".task").take(28)}" } ?: "NONE ACTIVE",
                    fontSize = 10.sp,
                    color = palette.faint,
                    maxLines = 1,
                )
            }

            found.forEach { model ->
                val selected = model.fileName == activeName
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .let { base ->
                            if (model.usable) base.clickable {
                                container.summarizer.selectModel(model.fileName)
                                activeName = container.summarizer.activeModelName()
                                found = container.summarizer.foundModels()
                            } else base
                        }
                        .padding(vertical = 6.dp, horizontal = 2.dp),
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(model.fileName.removeSuffix(".task"), fontSize = 12.sp, color = palette.text, lineHeight = 16.sp)
                        Text(
                            if (model.usable) "${formatBytes(model.sizeBytes)} · found in ${model.location}"
                            else "${formatBytes(model.sizeBytes)} · legacy GGUF — MediaPipe can't load it",
                            fontSize = 10.sp,
                            color = if (model.usable) palette.muted else palette.faint,
                        )
                    }
                    if (model.usable) {
                        Text(if (selected) "✓" else "", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = palette.accent)
                    }
                }
            }

            catalog.filter { entry -> found.none { it.fileName == entry.fileName } }.forEach { entry ->
                val isDownloading = downloadingName == entry.fileName
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp, horizontal = 2.dp),
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(entry.name, fontSize = 12.sp, color = palette.text, lineHeight = 16.sp)
                        Text(
                            "${formatBytes(entry.sizeBytes)} · ${entry.license} — ${entry.blurb}",
                            fontSize = 10.sp,
                            color = palette.muted,
                            lineHeight = 14.sp,
                        )
                    }
                    if (isDownloading) {
                        Text("${(progress * 100).toInt()}%", fontSize = 12.sp, color = palette.accent)
                    } else {
                        Text(
                            "DOWNLOAD",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = if (downloadingName == null) palette.accent else palette.faint,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .border(1.dp, palette.border, RoundedCornerShape(8.dp))
                                .let { m ->
                                    if (downloadingName == null) m.clickable {
                                        downloadError = null
                                        downloadingName = entry.fileName
                                        progress = 0f
                                        scope.launch(Dispatchers.IO) {
                                            try {
                                                container.summarizer.downloadModel(entry) { done, total ->
                                                    if (total > 0) progress = (done.toFloat() / total).coerceIn(0f, 1f)
                                                }
                                                withContext(Dispatchers.Main) {
                                                    downloadingName = null
                                                    found = container.summarizer.foundModels()
                                                    activeName = container.summarizer.activeModelName()
                                                }
                                            } catch (e: Exception) {
                                                withContext(Dispatchers.Main) {
                                                    downloadingName = null
                                                    downloadError = e.message ?: "Download failed"
                                                }
                                            }
                                        }
                                    } else m
                                }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                        )
                    }
                }
                if (isDownloading) {
                    LinearWavyProgressIndicator(
                        progress = { progress },
                        modifier = Modifier.fillMaxWidth(),
                        color = palette.accent,
                        trackColor = palette.border,
                    )
                }
            }
            downloadError?.let { Text(it, fontSize = 12.sp, color = palette.danger) }
        }
    }
}
