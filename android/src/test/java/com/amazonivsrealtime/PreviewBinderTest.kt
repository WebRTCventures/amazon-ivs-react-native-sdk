package com.amazonivsrealtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PreviewBinderTest {
  private class Device

  private class Host {
    val attached = mutableListOf<Device?>()
    var preview: Device? = null
    var mirror: Boolean? = null
    var attachFails = false

    val binder = PreviewBinder<Device>(
      attach = { device ->
        attached.add(device)
        preview = if (attachFails) null else device
      },
      hasPreview = { preview != null },
      applyMirror = { mirror = it },
    )
  }

  @Test
  fun sameDeviceAndAspectDoesNotRebind() {
    val host = Host()
    val device = Device()
    host.binder.apply(device, "fill", false)
    host.binder.apply(device, "fill", false)
    assertEquals(listOf(device), host.attached)
  }

  @Test
  fun mirrorOnlyUpdateAppliesWithoutRebind() {
    val host = Host()
    val device = Device()
    host.binder.apply(device, "fill", false)
    host.binder.apply(device, "fill", true)
    assertEquals(1, host.attached.size)
    assertEquals(true, host.mirror)
  }

  @Test
  fun deviceChangeRebinds() {
    val host = Host()
    val first = Device()
    val second = Device()
    host.binder.apply(first, "fill", false)
    host.binder.apply(second, "fill", false)
    assertEquals(listOf(first, second), host.attached)
  }

  @Test
  fun aspectChangeRebinds() {
    val host = Host()
    val device = Device()
    host.binder.apply(device, "fill", false)
    host.binder.apply(device, "fit", false)
    assertEquals(2, host.attached.size)
  }

  @Test
  fun streamRemovalClearsThenRebinds() {
    val host = Host()
    val device = Device()
    host.binder.apply(device, "fill", false)
    host.binder.apply(null, "fill", false)
    assertNull(host.attached.last())
    assertNull(host.preview)
    host.binder.apply(device, "fill", false)
    assertEquals(listOf(device, null, device), host.attached)
  }

  @Test
  fun failedAttachRetries() {
    val host = Host()
    val device = Device()
    host.attachFails = true
    host.binder.apply(device, "fill", false)
    host.attachFails = false
    host.binder.apply(device, "fill", false)
    assertEquals(2, host.attached.size)
    assertTrue(host.preview === device)
  }

  @Test
  fun previewClearedElsewhereRebinds() {
    val host = Host()
    val device = Device()
    host.binder.apply(device, "fill", false)
    host.preview = null
    host.binder.apply(device, "fill", false)
    assertEquals(2, host.attached.size)
  }

  @Test
  fun resetRebinds() {
    val host = Host()
    val device = Device()
    host.binder.apply(device, "fill", false)
    host.binder.reset()
    host.binder.apply(device, "fill", false)
    assertEquals(2, host.attached.size)
  }
}
