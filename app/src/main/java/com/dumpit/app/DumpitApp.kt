package com.dumpit.app

import android.app.Application
import android.content.Context
import com.dumpit.shared.agent.ResearchAgent
import com.dumpit.shared.android.AndroidImageStore
import com.dumpit.shared.android.AndroidItemStorage
import com.dumpit.shared.android.MediaPipeSummarizer
import com.dumpit.shared.link.LinkReader
import com.dumpit.shared.store.DumpStore

/** Process-wide wiring — the DumpProvider equivalent for Compose. */
class AppContainer(context: Context) {
    val appContext: Context = context.applicationContext

    val storage = AndroidItemStorage(appContext.filesDir)
    val imageStore = AndroidImageStore(appContext)
    val summarizer = MediaPipeSummarizer(appContext)
    private val reader = LinkReader()
    val agent = ResearchAgent(reader, summarizer)
    val dumpStore = DumpStore(storage, imageStore, agent)
}

class DumpitApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
