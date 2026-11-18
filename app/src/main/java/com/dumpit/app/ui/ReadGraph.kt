package com.dumpit.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dumpit.shared.model.AgentStatus
import com.dumpit.shared.model.DumpItem

/**
 * The read graph, printed as a compact tree — root = the share, children = the
 * pages the agent opened, in order. Status is a colored dot; details are one
 * line. No URLs longer than a line, no raw evidence.
 */
@Composable
fun ReadGraph(item: DumpItem, palette: Palette) {
    val reads = item.steps.filter { it.label.startsWith("Reading ") }

    Column(Modifier.fillMaxWidth(), verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(0.dp)) {
        // Root — the share itself
        GraphRow(
            glyph = "●",
            glyphColor = palette.accent,
            title = item.urlHost ?: item.title.take(48),
            subtitle = "THE SHARE",
            palette = palette,
        )

        reads.forEachIndexed { index, step ->
            val url = step.label.removePrefix("Reading ").trim()
            val host = runCatching { Uri.parse(url)?.host }.getOrNull()?.takeIf { it.isNotBlank() } ?: url
            val path = runCatching { Uri.parse(url)?.path?.trimStart('/') }.getOrNull()?.take(48)
            val ok = step.status == AgentStatus.DONE
            val failed = step.status == AgentStatus.FAILED
            val glyph = if (index == reads.lastIndex) "└─" else "├─"
            val context = androidx.compose.ui.platform.LocalContext.current

            // Tap any read node — opens the page in the browser.
            Box(modifier = Modifier.fillMaxWidth().clickable {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }) {
                GraphRow(
                    glyph = glyph,
                    glyphColor = if (failed) palette.danger else palette.accent,
                    title = if (path.isNullOrBlank()) host else "$host/$path",
                    subtitle = when {
                        failed -> step.detail ?: "unreadable"
                        ok -> step.detail ?: "read"
                        else -> "reading…"
                    },
                    dot = when {
                        failed -> palette.danger
                        ok -> palette.accent
                        else -> palette.faint
                    },
                    palette = palette,
                )
            }
        }

        if (reads.isEmpty()) {
            GraphRow(
                glyph = "└─",
                glyphColor = palette.faint,
                title = "No links to read",
                subtitle = "TEXT ONLY",
                palette = palette,
            )
        }
    }
}

@Composable
private fun GraphRow(
    glyph: String,
    glyphColor: androidx.compose.ui.graphics.Color,
    title: String,
    subtitle: String,
    palette: Palette,
    dot: androidx.compose.ui.graphics.Color? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = glyph,
            color = glyphColor,
            fontSize = 15.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(30.dp),
        )
        if (dot != null) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(dot),
            )
            Spacer(Modifier.width(8.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(
                title,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = palette.text,
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
            Text(
                subtitle,
                fontSize = 10.sp,
                color = palette.faint,
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )
        }
    }
}
