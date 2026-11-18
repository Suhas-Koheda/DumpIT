package com.dumpit.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dumpit.shared.model.DumpItem
import com.dumpit.shared.model.DumpKind
import com.dumpit.shared.model.Platform

/** Small pill — what the dump is. Port of Badge.tsx. TODO dumps get their own pill. */
@Composable
fun Badge(item: DumpItem, palette: Palette, modifier: Modifier = Modifier) {
    val label = when {
        item.isTodo -> "TODO"
        item.kind == DumpKind.TEXT -> "TEXT"
        item.kind == DumpKind.IMAGE -> "SCREENSHOT"
        else -> when (item.platform) {
            Platform.X -> "X / TWITTER"
            Platform.LINKEDIN -> "LINKEDIN"
            else -> "LINK"
        }
    }
    Text(
        text = label,
        modifier = modifier
            .clip(RoundedCornerShape(5.dp))
            .background(palette.accent)
            .padding(horizontal = 8.dp, vertical = 3.dp),
        fontSize = 9.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.2.sp,
        color = palette.onAccent,
    )
}
