package com.dumpit.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.dumpit.app.ui.DumpitAppUi
import com.dumpit.app.ui.DumpitTheme
import com.dumpit.shared.model.ShareFile
import com.dumpit.shared.model.SharePayload
import android.content.Intent
import android.net.Uri
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val container: AppContainer
        get() = (application as DumpitApp).container

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleShareIntent(intent)
        setContent {
            DumpitTheme {
                DumpitAppUi(container)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleShareIntent(intent)
    }

    private fun handleShareIntent(intent: Intent?) {
        if (intent == null) return
        when (intent.action) {
            Intent.ACTION_SEND -> scopeAdd(intent, multiple = false)
            Intent.ACTION_SEND_MULTIPLE -> scopeAdd(intent, multiple = true)
            else -> Unit // Main launcher — nothing to ingest.
        }
    }

    private fun scopeAdd(intent: Intent, multiple: Boolean) {
        val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
        val mime = intent.type

        val files = mutableListOf<ShareFile>()
        if (multiple) {
            val uris: List<Uri> = if (Build.VERSION.SDK_INT >= 33) {
                intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java) ?: emptyList()
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM) ?: emptyList()
            }
            uris.forEach { files += ShareFile(path = it.toString(), mimeType = mime, fileName = fileNameOf(it)) }
        } else {
            val stream: Uri? = if (Build.VERSION.SDK_INT >= 33) {
                intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(Intent.EXTRA_STREAM)
            }
            if (stream != null) {
                files += ShareFile(path = stream.toString(), mimeType = mime, fileName = fileNameOf(stream))
            }
        }

        if (text.isNullOrBlank() && files.isEmpty()) return
        lifecycleScope.launch(Dispatchers.IO) {
            val created = container.dumpStore.addFromShare(
                SharePayload(text = text, files = files, metaTitle = subject)
            )
            // OCR every image the share produced — then the agent sees its text.
            for (item in created.filter { it.kind == com.dumpit.shared.model.DumpKind.IMAGE && it.imageUri != null }) {
                val ocr = com.dumpit.app.ocr.ScreenshotOcr.recognize(container.appContext, item.imageUri!!)
                if (!ocr.isNullOrBlank()) {
                    container.dumpStore.enrichFromOcr(item.id, ocr)
                }
            }
        }
    }

    private fun fileNameOf(uri: Uri): String? =
        uri.lastPathSegment?.substringAfterLast('/')?.takeIf { it.isNotBlank() }
}
