package com.dumpit.app.ui

import android.graphics.BitmapFactory
import androidx.compose.runtime.Composable
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Decode an image file (app-private storage) off the main thread. */
@Composable
fun rememberImageBitmap(path: String?): ImageBitmap? {
    return produceState<ImageBitmap?>(initialValue = null, key1 = path) {
        if (path == null) return@produceState
        value = withContext(Dispatchers.IO) {
            runCatching { BitmapFactory.decodeFile(path)?.asImageBitmap() }.getOrNull()
        }
    }.value
}
