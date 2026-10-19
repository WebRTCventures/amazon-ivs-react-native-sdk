package com.amazonivsrealtime

/**
 * Binds a device's preview, skipping the re-bind when the device and aspect mode are unchanged.
 */
internal class PreviewBinder<D : Any>(
  private val attach: (D?) -> Unit,
  private val hasPreview: () -> Boolean,
  private val applyMirror: (Boolean) -> Unit,
) {
  private var boundDevice: D? = null
  private var boundAspectMode: String? = null

  fun apply(device: D?, aspectMode: String, mirror: Boolean) {
    // Mute updates re-push the same device; re-binding would blank the tile.
    if (device != null && device === boundDevice && aspectMode == boundAspectMode && hasPreview()) {
      applyMirror(mirror)
      return
    }
    reset()
    attach(device)
    if (device != null && hasPreview()) {
      boundDevice = device
      boundAspectMode = aspectMode
    }
  }

  fun reset() {
    boundDevice = null
    boundAspectMode = null
  }
}
