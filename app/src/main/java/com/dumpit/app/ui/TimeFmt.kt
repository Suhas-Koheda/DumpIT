package com.dumpit.app.ui

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Port of time.ts. */
fun timeAgo(ts: Long): String {
    val diff = System.currentTimeMillis() - ts
    val seconds = diff / 1000
    if (seconds < 60) return "just now"
    val minutes = seconds / 60
    if (minutes < 60) return "${minutes}m ago"
    val hours = minutes / 60
    if (hours < 24) return "${hours}h ago"
    val days = hours / 24
    if (days < 7) return "${days}d ago"
    val pattern = if (SimpleDateFormat("yyyy", Locale.getDefault()).format(Date(ts)) ==
        SimpleDateFormat("yyyy", Locale.getDefault()).format(Date())
    ) {
        "MMM d"
    } else {
        "MMM d, yyyy"
    }
    return SimpleDateFormat(pattern, Locale.getDefault()).format(Date(ts))
}

fun fullDate(ts: Long): String =
    SimpleDateFormat("EEE, MMM d, yyyy, h:mm a", Locale.getDefault()).format(Date(ts))
