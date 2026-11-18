package com.dumpit.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
    bg = Color(0xFFFAFBFC),
    card = Color(0xFFFFFFFF),
    border = Color(0xFFDFE5E9),
    text = Color(0xFF10161D),
    muted = Color(0xFF55606C),
    faint = Color(0xFF9AA4AD),
    accent = Color(0xFF0891B2),
    onAccent = Color(0xFFFFFFFF),
    danger = Color(0xFFEA580C),
)

val DarkPalette = Palette(
    bg = Color(0xFF16161D),
    card = Color(0xFF1E1E26),
    border = Color(0xFF2C2C37),
    text = Color(0xFFEDEDF2),
    muted = Color(0xFFA9A9B8),
    faint = Color(0xFF71717E),
    accent = Color(0xFF22D3EE),
    onAccent = Color(0xFF16161D),
    danger = Color(0xFFFB923C),
)

@Composable
fun rememberPalette(): Palette {
    val mode = ThemeState.mode.collectAsState().value
    return when (mode) {
        ThemeMode.LIGHT -> LightPalette
        ThemeMode.DARK -> DarkPalette
        ThemeMode.SYSTEM -> if (isSystemInDarkTheme()) DarkPalette else LightPalette
    }
}

@Composable
fun DumpitTheme(content: @Composable () -> Unit) {
    val palette = rememberPalette()
    val mode = ThemeState.mode.collectAsState().value
    val dark = when (mode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }
    val scheme = if (dark) {
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
    MaterialExpressiveTheme(
        colorScheme = scheme,
        motionScheme = MotionScheme.expressive(),
        content = content,
    )
}
