package com.amazonivsrealtime

import android.content.Context
import com.amazonaws.ivs.broadcast.ImageDevice

/**
 * Remote (or local self-view) participant video. Stream updates are pushed from
 * [IvsParticipantStreams] — no streamVersion prop.
 */
class IvsParticipantVideoView(context: Context) : IvsPreviewHostView(context) {

  private var participantId: String? = null
  private var pendingDevice: ImageDevice? = null
  private var registered = false
  private val binder = PreviewBinder<ImageDevice>(
    attach = { attachPreview(it) },
    hasPreview = { previewView != null },
    applyMirror = { previewView?.scaleX = if (it) -1f else 1f },
  )

  fun setParticipantIdProp(value: String?) {
    val next = value?.takeIf { it.isNotEmpty() }
    if (next != participantId) {
      deregisterIfNeeded()
      binder.reset()
      participantId = next
      scheduleApply()
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    registerIfNeeded()
  }

  override fun onDetachedFromWindow() {
    deregisterIfNeeded()
    super.onDetachedFromWindow()
  }

  fun applyStream(device: ImageDevice?) {
    pendingDevice = device
    scheduleApply()
  }

  override fun applyConfiguration() {
    if (!isAttachedToWindow) return
    registerIfNeeded()
    val device = pendingDevice ?: participantId?.let { IvsParticipantStreams.videoDevice(it) }
    binder.apply(device, aspectMode, mirror)
  }

  override fun onRelease() {
    deregisterIfNeeded()
    pendingDevice = null
    binder.reset()
    participantId = null
  }

  private fun registerIfNeeded() {
    val id = participantId ?: return
    if (registered) return
    registered = true
    IvsParticipantStreams.registerView(id, this)
  }

  private fun deregisterIfNeeded() {
    if (!registered) return
    registered = false
    IvsParticipantStreams.unregisterView(this)
  }
}
