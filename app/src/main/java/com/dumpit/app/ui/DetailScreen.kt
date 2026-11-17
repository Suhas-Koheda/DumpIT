package com.dumpit.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dumpit.app.AppContainer
import com.dumpit.shared.model.AgentStatus
import com.dumpit.shared.model.AgentStep
import com.dumpit.shared.model.DumpItem
import com.dumpit.shared.model.DumpKind
import com.dumpit.shared.model.StepKind
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun DetailScreen(
    item: DumpItem,
    container: AppContainer,
    onBack: () -> Unit,
    onDelete: (String) -> Unit,
) {
    val palette = rememberPalette()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val bitmap = rememberImageBitmap(if (item.kind == DumpKind.IMAGE) item.imageUri else null)

    var confirmDelete by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.bg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Top row: back + badge + date
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

        // Hero image
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

        // Link card
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

        // Title + body
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

        // The Agent
        AgentPanel(
            item = item,
            container = container,
            palette = palette,
        )

        // Delete
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

@Composable
private fun AgentPanel(
    item: DumpItem,
    container: AppContainer,
    palette: Palette,
) {
    val scope = rememberCoroutineScope()
    var downloading by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }
    var downloadError by remember { mutableStateOf<String?>(null) }
    var modelReady by remember { mutableStateOf(container.summarizer.modelReady()) }

    val active = item.agent == AgentStatus.RUNNING || item.agent == AgentStatus.PENDING

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

        // Steps
        if (item.steps.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item.steps.forEach { step -> StepRow(step, palette) }
            }
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

        // On-device model download (Google MediaPipe LLM Inference)
        if (!modelReady) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.fillMaxWidth().height(1.dp).background(palette.border))
                if (downloading) {
                    Text(
                        "Downloading on-device model… ${(progress * 100).toInt()}%",
                        fontSize = 12.sp,
                        color = palette.muted,
                    )
                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier.fillMaxWidth(),
                        color = palette.accent,
                        trackColor = palette.border,
                    )
                } else {
                    Text(
                        "DOWNLOAD ON-DEVICE MODEL (Qwen2.5 0.5B)",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = palette.accent,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable {
                                downloadError = null
                                downloading = true
                                progress = 0f
                                scope.launch(Dispatchers.IO) {
                                    try {
                                        container.summarizer.downloadModel { done, total ->
                                            if (total > 0) progress = (done.toFloat() / total).coerceIn(0f, 1f)
                                        }
                                        withContext(Dispatchers.Main) {
                                            downloading = false
                                            modelReady = true
                                        }
                                    } catch (e: Exception) {
                                        withContext(Dispatchers.Main) {
                                            downloading = false
                                            downloadError = e.message ?: "Download failed"
                                        }
                                    }
                                }
                            }
                            .padding(vertical = 6.dp),
                    )
                }
                downloadError?.let { Text(it, fontSize = 12.sp, color = palette.danger) }
            }
        }
    }
}

@Composable
private fun StepRow(step: AgentStep, palette: Palette) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(vertical = 2.dp),
    ) {
        StepStatusDot(step, palette)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                step.label,
                fontSize = 13.sp,
                color = palette.text,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            step.detail?.let {
                Text(
                    it,
                    fontSize = 12.sp,
                    color = palette.muted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun StepStatusDot(step: AgentStep, palette: Palette) {
    when (step.status) {
        AgentStatus.RUNNING -> {
            val pulse = if (step.kind == StepKind.THINK) {
                val infinite = rememberInfiniteTransition(label = "pulse")
                infinite.animateFloat(
                    initialValue = 0.3f,
                    targetValue = 1f,
                    animationSpec = infiniteRepeatable(tween(700), RepeatMode.Reverse),
                    label = "alpha",
                ).value
            } else {
                1f
            }
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .background(palette.accent.copy(alpha = pulse)),
            )
        }
        AgentStatus.DONE -> Box(
            modifier = Modifier
                .size(10.dp)
                .clip(androidx.compose.foundation.shape.CircleShape)
                .background(palette.accent),
        )
        AgentStatus.FAILED -> Box(
            modifier = Modifier
                .size(10.dp)
                .clip(androidx.compose.foundation.shape.CircleShape)
                .background(palette.danger),
        )
        else -> Box(
            modifier = Modifier
                .size(10.dp)
                .clip(androidx.compose.foundation.shape.CircleShape)
                .background(palette.faint.copy(alpha = 0.4f)),
        )
    }
}
