package com.dumpit.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.foundation.layout.width
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dumpit.shared.store.LogBus
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun LogsScreen(onBack: () -> Unit) {
    val palette = rememberPalette()
    val lines by LogBus.lines.collectAsState()
    val listState = rememberLazyListState()

    // Keep the view pinned to the newest line while events arrive.
    LaunchedEffect(lines.size) {
        if (lines.isNotEmpty()) listState.animateScrollToItem(lines.size - 1)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.bg),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
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
            Text(
                "LOGS",
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 2.sp,
                color = palette.text,
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 8.dp),
            )
            Text(
                "CLEAR",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                color = palette.danger,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .border(1.dp, palette.border, RoundedCornerShape(8.dp))
                    .clickable { LogBus.clear() }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(palette.border))

        if (lines.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("No events yet", fontSize = 15.sp, color = palette.faint)
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp),
            ) {
                items(lines, key = { it.id }) { line ->
                    Row(verticalAlignment = Alignment.Top) {
                        Text(
                            SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(line.timestamp)),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            color = palette.faint,
                            modifier = Modifier.width(52.dp),
                        )
                        Text(
                            line.tag.uppercase(Locale.getDefault()),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = palette.accent,
                            modifier = Modifier.width(44.dp),
                        )
                        Text(
                            line.message,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            color = palette.text,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}
