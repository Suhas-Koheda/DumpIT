package com.dumpit.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** Port of theme.ts — same light/dark palettes. */
data class Palette(
    val bg: Color,
    val card: Color,
    val border: Color,
    val text: Color,
    val muted: Color,
    val faint: Color,
    val accent: Color,
    val onAccent: Color,
    val danger: Color,
)

val LightPalette = Palette(
    bg = Color(0xFFFAFAF7),
    card = Color(0xFFFFFFFF),
    border = Color(0xFFE4E3DD),
    text = Color(0xFF141414),
    muted = Color(0xFF5E5E5A),
    faint = Color(0xFF9A9A94),
    accent = Color(0xFF3E5C4C),
    onAccent = Color(0xFFFFFFFF),
    danger = Color(0xFFBA1A1A),
)

val DarkPalette = Palette(
    bg = Color(0xFF101013),
    card = Color(0xFF1B1B21),
    border = Color(0xFF2A2A33),
    text = Color(0xFFEDEDEF),
    muted = Color(0xFFA9A9B2),
    faint = Color(0xFF6E6E78),
    accent = Color(0xFF8FB893),
    onAccent = Color(0xFF10160F),
    danger = Color(0xFFFFB4AB),
)

@Composable
fun rememberPalette(): Palette = if (isSystemInDarkTheme()) DarkPalette else LightPalette

@Composable
fun DumpitTheme(content: @Composable () -> Unit) {
    val palette = rememberPalette()
    val scheme = if (isSystemInDarkTheme()) {
        darkColorScheme(
            primary = palette.accent,
            onPrimary = palette.onAccent,
            background = palette.bg,
            surface = palette.card,
            onSurface = palette.text,
            onSurfaceVariant = palette.muted,
            error = palette.danger,
            outline = palette.border,
        )
    } else {
        lightColorScheme(
            primary = palette.accent,
            onPrimary = palette.onAccent,
            background = palette.bg,
            surface = palette.card,
            onSurface = palette.text,
            onSurfaceVariant = palette.muted,
            error = palette.danger,
            outline = palette.border,
        )
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
