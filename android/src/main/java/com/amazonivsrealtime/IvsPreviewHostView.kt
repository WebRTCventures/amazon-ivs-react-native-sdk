package com.amazonivsrealtime

import android.content.Context
import android.util.AttributeSet
import android.util.Log
import android.view.Choreographer
import android.widget.FrameLayout
import com.amazonaws.ivs.broadcast.BroadcastConfiguration
import com.amazonaws.ivs.broadcast.ImageDevice
import com.amazonaws.ivs.broadcast.ImagePreviewView
import java.util.Collections
import java.util.WeakHashMap

/**
 * Shared preview host with mirror/aspectMode props and the RN layout workaround.
 */
abstract class IvsPreviewHostView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : FrameLayout(context, attrs) {

  protected var previewView: ImagePreviewView? = null
  protected var aspectMode: String = "fill"
  protected var mirror: Boolean = false
  private var applyScheduled = false

  private val measureAndLayout = Runnable {
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    layout(left, top, right, bottom)
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  fun setAspectModeProp(value: String?) {
    val next = value ?: "fill"
    if (next != aspectMode) {
      aspectMode = next
      scheduleApply()
    }
  }

  fun setMirrorProp(value: Boolean) {
    if (value != mirror) {
      mirror = value
      scheduleApply()
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attached.add(this)
    scheduleApply()
  }

  override fun onDetachedFromWindow() {
    attached.remove(this)
    super.onDetachedFromWindow()
  }

  fun clearPreview() {
    previewView?.let { removeView(it) }
    previewView = null
  }

  fun release() {
    clearPreview()
    onRelease()
  }

  protected open fun onRelease() {}

  protected fun scheduleApply() {
    if (applyScheduled) return
    applyScheduled = true
    Choreographer.getInstance().postFrameCallback {
      applyScheduled = false
      applyConfiguration()
    }
  }

  protected fun aspectModeEnum(): BroadcastConfiguration.AspectMode =
    if (aspectMode == "fit") {
      BroadcastConfiguration.AspectMode.FIT
    } else {
      BroadcastConfiguration.AspectMode.FILL
    }

  protected fun attachPreview(device: ImageDevice?) {
    clearPreview()
    if (device == null) return
    try {
      val newPreview = device.getPreviewView(aspectModeEnum())
      newPreview.layoutParams =
        LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
      newPreview.scaleX = if (mirror) -1f else 1f
      addView(newPreview)
      previewView = newPreview
    } catch (t: Throwable) {
      Log.w("IvsPreviewHostView", "attachPreview failed for ${device.descriptor?.deviceId}", t)
      clearPreview()
    }
  }

  protected abstract fun applyConfiguration()

  companion object {
    private val attached: MutableSet<IvsPreviewHostView> =
      Collections.newSetFromMap(WeakHashMap())

    /** Call on main before `Stage.release()`; overlapping them deadlocks the SDK. */
    fun detachAllPreviews() {
      for (view in attached.toList()) {
        view.clearPreview()
      }
    }
  }
}
