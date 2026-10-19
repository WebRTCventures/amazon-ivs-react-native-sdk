package com.amazonivsrealtime

import android.app.Application
import android.content.Context
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import com.amazonaws.ivs.broadcast.AudioLocalStageStream
import com.amazonaws.ivs.broadcast.BroadcastConfiguration
import com.amazonaws.ivs.broadcast.BroadcastException
import com.amazonaws.ivs.broadcast.BroadcastSession
import com.amazonaws.ivs.broadcast.Device
import com.amazonaws.ivs.broadcast.ImageDevice
import com.amazonaws.ivs.broadcast.ImageLocalStageStream
import com.amazonaws.ivs.broadcast.LocalStageStream
import com.amazonaws.ivs.broadcast.ParticipantInfo
import com.amazonaws.ivs.broadcast.Stage
import com.amazonaws.ivs.broadcast.StageRenderer
import com.amazonaws.ivs.broadcast.StageStream
import com.amazonaws.ivs.broadcast.StageVideoConfiguration
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

typealias Reject = (code: String, message: String, exception: BroadcastException?) -> Unit

object IvsStageManager : IvsAppLifecycleDelegate {
  interface EventHandler {
    fun onConnectionStateChanged(body: WritableMap)
    fun onParticipantJoined(body: WritableMap)
    fun onParticipantUpdated(body: WritableMap)
    fun onParticipantLeft(body: WritableMap)
    fun onParticipantStreamsChanged(body: WritableMap)
    fun onStageError(body: WritableMap)
  }

  private data class ParticipantRecord(
    var info: ParticipantInfo,
    var publishState: Stage.PublishState = Stage.PublishState.NOT_PUBLISHED,
    var subscribeState: Stage.SubscribeState = Stage.SubscribeState.NOT_SUBSCRIBED,
    val streams: MutableList<StageStream> = mutableListOf(),
  )

  var eventHandler: EventHandler? = null

  private var appContext: Context? = null
  private var stage: Stage? = null
  private var cameraStream: ImageLocalStageStream? = null
  private var micStream: AudioLocalStageStream? = null
  private var cameraDevice: ImageDevice? = null
  private var videoConfig: StageVideoConfiguration? = null

  private val participants = linkedMapOf<String, ParticipantRecord>()
  private val subscribeOverrides = mutableMapOf<String, Stage.SubscribeType>()

  private var connectionStateValue = "disconnected"
  private var publishEnabled = false
  private var microphoneEnabled = true
  private var cameraEnabled = true
  private var cameraEnabledBeforeBackground = true
  private var isInBackground = false
  private var cameraPositionValue = Device.Descriptor.Position.FRONT
  private var defaultSubscribeType = Stage.SubscribeType.AUDIO_VIDEO

  private var pendingLeaveResolve: (() -> Unit)? = null
  private var microphoneMutedBeforeFocusLoss: Boolean? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private var leaveTimeoutRunnable: Runnable? = null

  private const val LEAVE_TIMEOUT_MS = 5000L

  fun initialize(context: Context) {
    if (appContext != null) return
    appContext = context.applicationContext
    IvsAudioSession.initialize(appContext!!)
    IvsAudioSession.setFocusChangeHandler { focusChange ->
      runOnUi { handleAudioFocusChange(focusChange) }
    }
    val application = appContext as Application
    IvsAppLifecycle.install(application, this)
  }

  fun cameraPosition(): Device.Descriptor.Position = cameraPositionValue

  fun join(token: String, options: ReadableMap?, resolve: () -> Unit, reject: Reject) {
    runOnUi {
      if (stage != null) {
        reject("stage-in-use", "Already connected to a stage. Call leave() first.", null)
        return@runOnUi
      }

      val publish = if (options != null && options.hasKey("publish")) {
        options.getBoolean("publish")
      } else {
        false
      }
      publishEnabled = publish

      if (publish) {
        if (!ensureLocalStreams()) {
          publishEnabled = false
          // ensureLocalStreams already released on partial acquire failure.
          reject("device-unavailable", "Failed to prepare local media.", null)
          return@runOnUi
        }
      }

      var newStage: Stage? = null
      try {
        newStage = Stage(appContext!!, token, strategy)
        newStage.addRenderer(renderer)
        newStage.join()
        stage = newStage
        resolve()
      } catch (e: BroadcastException) {
        newStage?.removeRenderer(renderer)
        newStage?.release()
        publishEnabled = false
        if (publish) {
          releaseLocalMedia()
        }
        reject(IvsMapping.mapErrorCode(e, "token-invalid"), e.message ?: "Failed to join stage.", e)
      } catch (t: Throwable) {
        newStage?.removeRenderer(renderer)
        newStage?.release()
        publishEnabled = false
        if (publish) {
          releaseLocalMedia()
        }
        reject("join-failed", t.message ?: "Failed to join stage.", null)
      }
    }
  }

  fun leave(resolve: () -> Unit, reject: Reject) {
    runOnUi {
      val currentStage = stage
      if (currentStage == null) {
        resolve()
        return@runOnUi
      }
      if (pendingLeaveResolve != null) {
        reject("unknown", "Leave already in progress.", null)
        return@runOnUi
      }

      pendingLeaveResolve = resolve
      leaveTimeoutRunnable =
        Runnable {
          if (pendingLeaveResolve == null) {
            return@Runnable
          }
          val pendingResolve = pendingLeaveResolve!!
          clearPendingLeave()
          forceFinishLeave()
          pendingResolve()
          emitLeaveTimeoutError()
        }
      mainHandler.postDelayed(leaveTimeoutRunnable!!, LEAVE_TIMEOUT_MS)
      currentStage.leave()
    }
  }

  fun renewToken(token: String, resolve: () -> Unit, reject: Reject) {
    runOnUi {
      val currentStage = stage
      if (currentStage == null) {
        reject("join-failed", "Not connected to a stage.", null)
        return@runOnUi
      }

      val local = localParticipantRecord()
      val localId = local?.info?.participantId
      if (localId != null) {
        participants.remove(localId)
        IvsParticipantStreams.remove(localId)
        emitParticipantLeft(localId)
      }

      try {
        // Detach and clear `stage` before leave so callbacks from the old Stage
        // cannot mutate the replacement session.
        currentStage.removeRenderer(renderer)
        stage = null
        currentStage.leave()
        currentStage.release()

        val newStage = Stage(appContext!!, token, strategy)
        newStage.addRenderer(renderer)
        newStage.join()
        stage = newStage
        resolve()
      } catch (e: BroadcastException) {
        connectionStateValue = "disconnected"
        publishEnabled = false
        releaseStage(emitDisconnected = true)
        reject(IvsMapping.mapErrorCode(e, "token-invalid"), e.message ?: "Failed to renew token.", e)
      } catch (t: Throwable) {
        connectionStateValue = "disconnected"
        publishEnabled = false
        releaseStage(emitDisconnected = true)
        reject("token-invalid", t.message ?: "Failed to renew token.", null)
      }
    }
  }

  fun listParticipants(): WritableArray {
    val array = Arguments.createArray()
    for (record in participants.values) {
      array.pushMap(participantMap(record))
    }
    return array
  }

  fun readState(): WritableMap {
    val local = localParticipantRecord()
    return Arguments.createMap().apply {
      putString("connectionState", connectionStateValue)
      putBoolean("publishEnabled", publishEnabled)
      putString(
        "publishState",
        IvsMapping.publishStateToString(local?.publishState ?: Stage.PublishState.NOT_PUBLISHED),
      )
      putBoolean("microphoneEnabled", microphoneEnabled)
      putBoolean("cameraEnabled", cameraEnabled)
      putString("cameraPosition", IvsMapping.cameraPositionToString(cameraPositionValue))
      putString("audioOutput", IvsAudioSession.requestedOutput())
    }
  }

  fun setPublishEnabled(enabled: Boolean, resolve: () -> Unit, reject: Reject) {
    runOnUi {
      if (enabled) {
        if (!ensureLocalStreams()) {
          reject("device-unavailable", "Failed to prepare local media.", null)
          return@runOnUi
        }
      } else {
        cameraStream?.setMuted(true)
        micStream?.setMuted(true)
      }

      publishEnabled = enabled
      stage?.refreshStrategy()

      if (enabled) {
        cameraStream?.setMuted(!cameraEnabled || isInBackground)
        micStream?.setMuted(!microphoneEnabled)
      }

      localParticipantRecord()?.let { emitParticipantUpdated(it) }
      resolve()
    }
  }

  fun setMicrophoneEnabled(enabled: Boolean, resolve: () -> Unit, reject: Reject) {
    runOnUi {
      microphoneEnabled = enabled
      if (publishEnabled && micStream == null) {
        if (!ensureLocalStreams()) {
          reject("device-unavailable", "Microphone unavailable.", null)
          return@runOnUi
        }
      }
      micStream?.setMuted(!enabled)
      localParticipantRecord()?.let { emitParticipantUpdated(it) }
      resolve()
    }
  }

  fun setCameraEnabled(enabled: Boolean, resolve: () -> Unit, reject: Reject) {
    runOnUi {
      cameraEnabled = enabled
      if (!isInBackground) {
        cameraEnabledBeforeBackground = enabled
      }
      if (publishEnabled && cameraStream == null) {
        if (!ensureLocalStreams()) {
          reject("device-unavailable", "Camera unavailable.", null)
          return@runOnUi
        }
      }
      cameraStream?.setMuted(!enabled || isInBackground)
      localParticipantRecord()?.let { emitParticipantUpdated(it) }
      resolve()
    }
  }

  fun setCameraPosition(position: String, resolve: () -> Unit, reject: Reject) {
    runOnUi {
      val wanted = IvsMapping.cameraPositionFromString(position)
      if (wanted == cameraPositionValue) {
        resolve()
        return@runOnUi
      }
      val context = appContext ?: run {
        reject("device-unavailable", "Application context unavailable.", null)
        return@runOnUi
      }
      val camera = IvsDevices.selectCamera(context, wanted)
      if (camera == null) {
        reject("device-unavailable", "Requested camera position is not available.", null)
        return@runOnUi
      }
      cameraPositionValue = wanted
      rebuildCameraStream(camera)
      stage?.refreshStrategy()
      updateLocalCameraInRegistry()
      localParticipantRecord()?.let { emitParticipantUpdated(it) }
      resolve()
    }
  }

  fun flipCamera(resolve: () -> Unit, reject: Reject) {
    val next = if (cameraPositionValue == Device.Descriptor.Position.FRONT) "back" else "front"
    setCameraPosition(next, resolve, reject)
  }

  fun prepareDevices(options: ReadableMap?, resolve: () -> Unit, reject: Reject) {
    runOnUi {
      val context = appContext ?: run {
        reject("device-unavailable", "Application context unavailable.", null)
        return@runOnUi
      }
      val wantsCamera = options?.let { !it.hasKey("camera") || it.getBoolean("camera") } ?: true
      val wantsMicrophone =
        options?.let { !it.hasKey("microphone") || it.getBoolean("microphone") } ?: true

      if (wantsCamera) {
        val camera = IvsDevices.acquireCamera(context, cameraPositionValue)
        if (camera == null) {
          reject("device-unavailable", "Camera unavailable.", null)
          return@runOnUi
        }
      }
      if (wantsMicrophone) {
        val mic = IvsDevices.acquireMicrophone(context)
        if (mic == null) {
          reject("device-unavailable", "Microphone unavailable.", null)
          return@runOnUi
        }
      }
      resolve()
    }
  }

  fun releaseDevices(resolve: () -> Unit, reject: Reject) {
    runOnUi {
      if (publishEnabled) {
        reject(
          "device-unavailable",
          "Cannot release devices while publishing. Call setPublishEnabled(false) first.",
          null,
        )
        return@runOnUi
      }
      releaseLocalMedia()
      resolve()
    }
  }

  fun setVideoConfig(config: ReadableMap?, resolve: () -> Unit, reject: Reject) {
    runOnUi {
      try {
        val built = buildVideoConfiguration(config)
        videoConfig = built
        if (cameraStream != null && built != null) {
          cameraStream?.setVideoConfiguration(built)
        }
        resolve()
      } catch (e: IllegalArgumentException) {
        reject("unknown", e.message ?: "Invalid video configuration.", null)
      }
    }
  }

  fun setDefaultSubscribeType(type: String, resolve: () -> Unit, reject: Reject) {
    runOnUi {
      if (!IvsMapping.isValidSubscribeType(type)) {
        reject("unknown", "Invalid subscribe type. Use none, audio-only, or audio-video.", null)
        return@runOnUi
      }
      defaultSubscribeType = IvsMapping.subscribeTypeFromString(type)
      stage?.refreshStrategy()
      resolve()
    }
  }

  fun setSubscribeType(participantId: String, type: String, resolve: () -> Unit, reject: Reject) {
    runOnUi {
      if (!IvsMapping.isValidSubscribeType(type)) {
        reject("unknown", "Invalid subscribe type. Use none, audio-only, or audio-video.", null)
        return@runOnUi
      }
      if (participantId.isEmpty()) {
        reject("unknown", "participantId is required.", null)
        return@runOnUi
      }
      subscribeOverrides[participantId] = IvsMapping.subscribeTypeFromString(type)
      stage?.refreshStrategy()
      resolve()
    }
  }

  fun getSdkVersion(): String = BroadcastSession.getVersion()

  override fun onEnterBackground() {
    runOnUi {
      isInBackground = true
      cameraEnabledBeforeBackground = cameraEnabled
      cameraStream?.setMuted(true)
    }
  }

  override fun onEnterForeground() {
    runOnUi {
      isInBackground = false
      cameraStream?.setMuted(!cameraEnabledBeforeBackground)
    }
  }

  override fun onAudioFocusLost() {}

  override fun onAudioFocusGained() {}

  private fun handleAudioFocusChange(focusChange: Int) {
    if (!IvsAudioSession.ownsSession()) {
      return
    }
    when (focusChange) {
      AudioManager.AUDIOFOCUS_LOSS -> onAudioFocusLostPermanent()
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK,
      -> onAudioFocusLostTransient()
      AudioManager.AUDIOFOCUS_GAIN -> onAudioFocusGainedInternal()
    }
  }

  private fun onAudioFocusLostTransient() {
    if (!IvsAudioSession.ownsSession()) {
      return
    }
    rememberAndMuteMicrophoneForFocusLoss()
  }

  private fun onAudioFocusLostPermanent() {
    if (!IvsAudioSession.ownsSession()) {
      return
    }
    rememberAndMuteMicrophoneForFocusLoss()
    val body =
      Arguments.createMap().apply {
        putString("code", "unknown")
        putString("message", "Audio focus lost permanently.")
      }
    eventHandler?.onStageError(body)
    appContext?.let { IvsAudioSession.notifyRouteChange(it) }
  }

  private fun onAudioFocusGainedInternal() {
    if (!IvsAudioSession.ownsSession()) {
      return
    }
    restoreMicrophoneAfterFocusGain()
    appContext?.let { context ->
      IvsAudioSession.reapplyOutputOverrideIfNeeded(context)
      IvsAudioSession.notifyRouteChange(context)
    }
  }

  private fun rememberAndMuteMicrophoneForFocusLoss() {
    if (microphoneMutedBeforeFocusLoss != null) {
      return
    }
    microphoneMutedBeforeFocusLoss = micStream?.muted ?: !microphoneEnabled
    micStream?.setMuted(true)
  }

  private fun restoreMicrophoneAfterFocusGain() {
    val priorMuted = microphoneMutedBeforeFocusLoss ?: return
    microphoneMutedBeforeFocusLoss = null
    micStream?.setMuted(priorMuted)
  }

  private val strategy =
    object : Stage.Strategy {
      override fun stageStreamsToPublishForParticipant(
        stage: Stage,
        participant: ParticipantInfo,
      ): List<LocalStageStream> {
        if (!isCurrentStage(stage) || !participant.isLocal || !publishEnabled) {
          return emptyList()
        }
        return listOfNotNull(cameraStream, micStream)
      }

      override fun shouldPublishFromParticipant(
        stage: Stage,
        participant: ParticipantInfo,
      ): Boolean = isCurrentStage(stage) && participant.isLocal && publishEnabled

      override fun shouldSubscribeToParticipant(
        stage: Stage,
        participant: ParticipantInfo,
      ): Stage.SubscribeType {
        if (!isCurrentStage(stage) || participant.isLocal) {
          return Stage.SubscribeType.NONE
        }
        return subscribeOverrides[participant.participantId] ?: defaultSubscribeType
      }
    }

  private val renderer =
    object : StageRenderer {
      override fun onConnectionStateChanged(
        stage: Stage,
        state: Stage.ConnectionState,
        exception: BroadcastException?,
      ) {
        if (!isCurrentStage(stage)) {
          return
        }
        connectionStateValue = IvsMapping.connectionStateToString(state)
        val body = Arguments.createMap().apply {
          putString("state", connectionStateValue)
          if (exception != null) {
            putString("error", exception.message ?: "unknown error")
          }
        }
        eventHandler?.onConnectionStateChanged(body)

        if (state == Stage.ConnectionState.DISCONNECTED && pendingLeaveResolve != null) {
          val pendingResolve = pendingLeaveResolve!!
          clearPendingLeave()
          finishLeaveTeardown()
          pendingResolve()
        }

        if (exception != null) {
          val fallback =
            if (exception.code == 1300 || state == Stage.ConnectionState.DISCONNECTED) {
              "disconnected"
            } else {
              "unknown"
            }
          emitStageError(exception, fallback)
        }
      }

      override fun onParticipantJoined(stage: Stage, participant: ParticipantInfo) {
        if (!isCurrentStage(stage)) {
          return
        }
        val record = upsertParticipant(participant)
        eventHandler?.onParticipantJoined(participantMap(record))
      }

      override fun onParticipantMetadataUpdated(stage: Stage, participant: ParticipantInfo) {
        if (!isCurrentStage(stage)) {
          return
        }
        val record = upsertParticipant(participant)
        emitParticipantUpdated(record)
      }

      override fun onParticipantLeft(stage: Stage, participant: ParticipantInfo) {
        if (!isCurrentStage(stage)) {
          return
        }
        val participantId = participant.participantId
        participants.remove(participantId)
        subscribeOverrides.remove(participantId)
        IvsParticipantStreams.remove(participantId)
        emitParticipantLeft(participantId)
      }

      override fun onStreamsAdded(
        stage: Stage,
        participant: ParticipantInfo,
        streams: List<StageStream>,
      ) {
        if (!isCurrentStage(stage)) {
          return
        }
        val record = upsertParticipant(participant)
        for (stream in streams) {
          if (!record.streams.contains(stream)) {
            record.streams.add(stream)
          }
        }
        IvsParticipantStreams.addStreams(participant.participantId, streams)
        emitParticipantUpdated(record)
        eventHandler?.onParticipantStreamsChanged(
          IvsParticipantStreams.streamsChangedPayload(participant.participantId),
        )
      }

      override fun onStreamsRemoved(
        stage: Stage,
        participant: ParticipantInfo,
        streams: List<StageStream>,
      ) {
        if (!isCurrentStage(stage)) {
          return
        }
        val record = participants[participant.participantId] ?: return
        record.streams.removeAll(streams.toSet())
        IvsParticipantStreams.removeStreams(participant.participantId, streams)
        emitParticipantUpdated(record)
        eventHandler?.onParticipantStreamsChanged(
          IvsParticipantStreams.streamsChangedPayload(participant.participantId),
        )
      }

      override fun onStreamsMutedChanged(
        stage: Stage,
        participant: ParticipantInfo,
        streams: List<StageStream>,
      ) {
        if (!isCurrentStage(stage)) {
          return
        }
        val record = participants[participant.participantId] ?: return
        IvsParticipantStreams.updateMutedStreams(participant.participantId, streams)
        emitParticipantUpdated(record)
        eventHandler?.onParticipantStreamsChanged(
          IvsParticipantStreams.streamsChangedPayload(participant.participantId),
        )
      }

      override fun onParticipantPublishStateChanged(
        stage: Stage,
        participant: ParticipantInfo,
        state: Stage.PublishState,
      ) {
        if (!isCurrentStage(stage)) {
          return
        }
        val record = upsertParticipant(participant)
        record.publishState = state
        emitParticipantUpdated(record)
      }

      override fun onParticipantSubscribeStateChanged(
        stage: Stage,
        participant: ParticipantInfo,
        state: Stage.SubscribeState,
      ) {
        if (!isCurrentStage(stage)) {
          return
        }
        val record = upsertParticipant(participant)
        record.subscribeState = state
        emitParticipantUpdated(record)
      }

      override fun onError(exception: BroadcastException) {
        val fallback = if (exception.code == 1300) "disconnected" else "unknown"
        emitStageError(exception, fallback)
      }
    }

  private fun ensureLocalStreams(): Boolean {
    val context = appContext ?: return false
    if (cameraStream != null && micStream != null) {
      return true
    }

    val camera = IvsDevices.acquireCamera(context, cameraPositionValue)
    val microphone = IvsDevices.acquireMicrophone(context)
    if (camera == null || microphone == null) {
      // Partial acquire must not leave the OS camera/mic indicators on.
      releaseLocalMedia()
      return false
    }

    cameraDevice = camera
    if (cameraStream == null) {
      cameraStream = ImageLocalStageStream(camera, videoConfig)
      cameraStream?.setMuted(!cameraEnabled || isInBackground)
    }
    if (micStream == null) {
      micStream = AudioLocalStageStream(microphone)
      micStream?.setMuted(!microphoneEnabled)
    }
    return true
  }

  private fun rebuildCameraStream(camera: ImageDevice) {
    val muted = cameraStream?.muted ?: (!cameraEnabled || isInBackground)
    cameraDevice = camera
    cameraStream = ImageLocalStageStream(camera, videoConfig)
    cameraStream?.setMuted(muted)
    // The publish moved to the new device; the hold and previews still point at the old one.
    IvsDevices.retargetCamera(camera)
    IvsLocalPreviewView.onLocalCameraChanged()
  }

  private fun clearLocalStreams() {
    cameraStream = null
    micStream = null
    cameraDevice = null
  }

  private fun releaseLocalMedia() {
    clearLocalStreams()
    IvsDevices.releaseAllHolds()
  }

  private fun isCurrentStage(callbackStage: Stage): Boolean = callbackStage === stage

  private fun updateLocalCameraInRegistry() {
    val local = localParticipantRecord() ?: return
    val stream = cameraStream ?: return
    val participantId = local.info.participantId
    local.streams.removeAll { it.streamType == StageStream.Type.VIDEO }
    local.streams.add(stream)
    IvsParticipantStreams.updateLocalVideoStream(participantId, stream, cameraDevice)
    eventHandler?.onParticipantStreamsChanged(
      IvsParticipantStreams.streamsChangedPayload(participantId),
    )
  }

  private fun clearPendingLeave() {
    leaveTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
    leaveTimeoutRunnable = null
    pendingLeaveResolve = null
  }

  private fun finishLeaveTeardown() {
    stage?.let {
      it.removeRenderer(renderer)
      IvsPreviewHostView.detachAllPreviews()
      it.release()
    }
    stage = null
    participants.clear()
    subscribeOverrides.clear()
    publishEnabled = false
    connectionStateValue = "disconnected"
    releaseLocalMedia()
    IvsParticipantStreams.clear()
  }

  private fun forceFinishLeave() {
    stage?.let {
      it.removeRenderer(renderer)
      it.leave()
      IvsPreviewHostView.detachAllPreviews()
      it.release()
    }
    stage = null
    participants.clear()
    subscribeOverrides.clear()
    publishEnabled = false
    connectionStateValue = "disconnected"
    releaseLocalMedia()
    IvsParticipantStreams.clear()
  }

  private fun emitLeaveTimeoutError() {
    val body =
      Arguments.createMap().apply {
        putString("code", "disconnected")
        putString("message", "Stage did not report disconnect after leave().")
      }
    eventHandler?.onStageError(body)
  }

  private fun releaseStage(emitDisconnected: Boolean) {
    clearPendingLeave()
    stage?.let {
      it.removeRenderer(renderer)
      it.leave()
      IvsPreviewHostView.detachAllPreviews()
      it.release()
    }
    stage = null
    participants.clear()
    subscribeOverrides.clear()
    publishEnabled = false
    connectionStateValue = "disconnected"
    releaseLocalMedia()
    IvsParticipantStreams.clear()

    if (emitDisconnected) {
      eventHandler?.onConnectionStateChanged(
        Arguments.createMap().apply { putString("state", "disconnected") },
      )
    }
  }

  private fun upsertParticipant(participant: ParticipantInfo): ParticipantRecord {
    val existing = participants[participant.participantId]
    if (existing != null) {
      existing.info = participant
      return existing
    }
    val record = ParticipantRecord(info = participant)
    participants[participant.participantId] = record
    return record
  }

  private fun localParticipantRecord(): ParticipantRecord? =
    participants.values.firstOrNull { it.info.isLocal }

  private fun participantMap(record: ParticipantRecord): WritableMap {
    val participant = record.info
    val streamsArray = Arguments.createArray()
    for (stream in record.streams) {
      streamsArray.pushMap(IvsMapping.streamToMap(stream))
    }
    return Arguments.createMap().apply {
      putString("participantId", participant.participantId)
      putString("userId", participant.userId)
      putBoolean("isLocal", participant.isLocal)
      putMap("attributes", IvsMapping.attributesToMap(participant.attributes))
      putString("publishState", IvsMapping.publishStateToString(record.publishState))
      putString("subscribeState", IvsMapping.subscribeStateToString(record.subscribeState))
      putArray("streams", streamsArray)
    }
  }

  private fun emitParticipantUpdated(record: ParticipantRecord) {
    eventHandler?.onParticipantUpdated(participantMap(record))
  }

  private fun emitParticipantLeft(participantId: String) {
    eventHandler?.onParticipantLeft(
      Arguments.createMap().apply { putString("participantId", participantId) },
    )
  }

  private fun emitStageError(exception: BroadcastException, fallback: String) {
    val code = IvsMapping.mapErrorCode(exception, fallback)
    val body = Arguments.createMap().apply {
      putString("code", code)
      putString("message", exception.message ?: "")
      IvsMapping.nativeErrorMap(exception)?.let { putMap("nativeError", it) }
    }
    eventHandler?.onStageError(body)
  }

  private fun buildVideoConfiguration(config: ReadableMap?): StageVideoConfiguration? {
    if (config == null || !config.toHashMap().isNotEmpty()) {
      return null
    }
    val videoConfig = StageVideoConfiguration()
    if (config.hasKey("width") && config.hasKey("height")) {
      videoConfig.setSize(
        BroadcastConfiguration.Vec2(
          config.getDouble("width").toFloat(),
          config.getDouble("height").toFloat(),
        ),
      )
    }
    if (config.hasKey("targetFramerate")) {
      videoConfig.setTargetFramerate(config.getInt("targetFramerate"))
    }
    if (config.hasKey("minBitrate")) {
      videoConfig.setMinBitrate(config.getInt("minBitrate"))
      videoConfig.useMinBitrate(true)
    }
    if (config.hasKey("maxBitrate")) {
      videoConfig.setMaxBitrate(config.getInt("maxBitrate"))
    }
    return videoConfig
  }

  private fun runOnUi(block: () -> Unit) {
    if (UiThreadUtil.isOnUiThread()) {
      block()
    } else {
      UiThreadUtil.runOnUiThread(block)
    }
  }

}
