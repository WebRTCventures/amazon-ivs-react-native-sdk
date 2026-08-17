#import "IvsStageManager.h"
#import "IvsAppLifecycle.h"
#import "IvsAudioSession.h"
#import "IvsDevices.h"
#import "IvsMapping.h"
#import "IvsParticipantStreams.h"

#import <AmazonIVSBroadcast/AmazonIVSBroadcast.h>

@interface IvsParticipantRecord : NSObject
@property(nonatomic, strong) IVSParticipantInfo *info;
@property(nonatomic, assign) IVSParticipantPublishState publishState;
@property(nonatomic, assign) IVSParticipantSubscribeState subscribeState;
@property(nonatomic, strong) NSMutableArray<IVSStageStream *> *streams;
@end

@implementation IvsParticipantRecord

- (instancetype)init
{
  if (self = [super init]) {
    _streams = [NSMutableArray array];
    _publishState = IVSParticipantPublishStateNotPublished;
    _subscribeState = IVSParticipantSubscribeStateNotSubscribed;
  }
  return self;
}

@end

@interface IvsStageManager () <IvsAppLifecycleDelegate>
@property(nonatomic, strong, nullable) IVSStage *stage;
@property(nonatomic, strong, nullable) IVSLocalStageStream *cameraStream;
@property(nonatomic, strong, nullable) IVSLocalStageStream *microphoneStream;
@property(nonatomic, strong, nullable) IVSLocalStageStreamConfiguration *videoStreamConfig;
@property(nonatomic, strong) NSMutableDictionary<NSString *, IvsParticipantRecord *> *participants;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *subscribeOverrides;
@property(nonatomic, copy) NSString *connectionStateValue;
@property(nonatomic, assign) BOOL microphoneEnabled;
@property(nonatomic, assign) BOOL cameraEnabled;
@property(nonatomic, assign) BOOL publishEnabledValue;
@property(nonatomic, assign) BOOL cameraEnabledBeforeBackground;
@property(nonatomic, assign) BOOL isInBackground;
@property(nonatomic, assign) IVSDevicePosition cameraPositionValue;
@property(nonatomic, assign) IVSStageSubscribeType defaultSubscribeType;
@property(nonatomic, copy, nullable) void (^pendingLeaveResolve)(void);
@property(nonatomic, copy, nullable) dispatch_block_t pendingLeaveTimeoutWork;
@end

@implementation IvsStageManager

+ (instancetype)shared
{
  static IvsStageManager *manager;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    manager = [[IvsStageManager alloc] init];
  });
  return manager;
}

- (instancetype)init
{
  if (self = [super init]) {
    _participants = [NSMutableDictionary dictionary];
    _subscribeOverrides = [NSMutableDictionary dictionary];
    _connectionStateValue = @"disconnected";
    _microphoneEnabled = YES;
    _cameraEnabled = YES;
    _publishEnabledValue = NO;
    _cameraEnabledBeforeBackground = YES;
    _isInBackground = NO;
    _cameraPositionValue = IVSDevicePositionFront;
    _defaultSubscribeType = IVSStageSubscribeTypeAudioVideo;

    __weak __typeof(self) weakSelf = self;
    [IvsParticipantStreams shared].streamLookup = ^IVSStageStream *(NSString *participantId) {
      return [weakSelf videoStreamForParticipantId:participantId];
    };

    [IvsAppLifecycle shared].delegate = self;
  }
  return self;
}

#pragma mark - Events

- (void)emitEvent:(NSString *)eventName body:(NSDictionary *)body
{
  if (self.eventHandler != nil) {
    self.eventHandler(eventName, body);
  }
}

- (void)emitError:(NSString *)code message:(NSString *)message nativeError:(NSError *_Nullable)error
{
  NSMutableDictionary *body = [@{
    @"code" : code,
    @"message" : message ?: @"",
  } mutableCopy];
  NSDictionary *native = [IvsMapping nativeErrorDictionary:error];
  if (native != nil) {
    body[@"nativeError"] = native;
  }
  [self emitEvent:@"onStageError" body:body];
}

- (NSDictionary *)participantDictionary:(IvsParticipantRecord *)record
{
  IVSParticipantInfo *participant = record.info;
  NSMutableArray *streams = [NSMutableArray arrayWithCapacity:record.streams.count];
  for (IVSStageStream *stream in record.streams) {
    [streams addObject:[IvsMapping streamToDictionary:stream]];
  }

  return @{
    @"participantId" : participant.participantId ?: @"",
    @"userId" : participant.userId ?: @"",
    @"isLocal" : @(participant.isLocal),
    @"attributes" : participant.attributes ?: @{},
    @"publishState" : [IvsMapping publishStateToString:record.publishState],
    @"subscribeState" : [IvsMapping subscribeStateToString:record.subscribeState],
    @"streams" : streams,
  };
}

- (void)emitParticipantUpdated:(IvsParticipantRecord *)record
{
  [self emitEvent:@"onParticipantUpdated" body:[self participantDictionary:record]];
}

- (void)emitStreamsChanged:(IvsParticipantRecord *)record
{
  [[IvsParticipantStreams shared] notifyStreamsChangedForParticipantId:record.info.participantId
                                                               streams:record.streams];
}

#pragma mark - State

- (NSDictionary *)readState
{
  __block NSDictionary *state = nil;
  if ([NSThread isMainThread]) {
    state = [self buildReadState];
  } else {
    dispatch_sync(dispatch_get_main_queue(), ^{
      state = [self buildReadState];
    });
  }
  return state;
}

- (NSDictionary *)buildReadState
{
  IvsParticipantRecord *local = [self localParticipantRecord];
  NSString *publishState = @"notPublished";
  if (local != nil) {
    publishState = [IvsMapping publishStateToString:local.publishState];
  }

  return @{
    @"connectionState" : self.connectionStateValue ?: @"disconnected",
    @"publishEnabled" : @(self.publishEnabledValue),
    @"publishState" : publishState,
    @"microphoneEnabled" : @(self.microphoneEnabled),
    @"cameraEnabled" : @(self.cameraEnabled),
    @"cameraPosition" : [IvsMapping cameraPositionToString:self.cameraPositionValue],
    @"audioOutput" : [IvsAudioSession shared].requestedOutput ?: @"auto",
  };
}

#pragma mark - Devices / streams

- (nullable IVSLocalStageStreamConfiguration *)buildStreamConfigurationFromDict:(NSDictionary *)config
                                                                          error:(NSError *_Nullable *_Nullable)error
{
  if (config == nil || config.count == 0) {
    return nil;
  }

  IVSLocalStageStreamConfiguration *streamConfig = [[IVSLocalStageStreamConfiguration alloc] init];
  IVSLocalStageStreamVideoConfiguration *video = streamConfig.video;

  NSNumber *width = config[@"width"];
  NSNumber *height = config[@"height"];
  if (width != nil && height != nil) {
    if (![video setSize:CGSizeMake(width.doubleValue, height.doubleValue) error:error]) {
      return nil;
    }
  }

  NSNumber *framerate = config[@"targetFramerate"];
  if (framerate != nil) {
    if (![video setTargetFramerate:framerate.integerValue error:error]) {
      return nil;
    }
  }

  NSNumber *minBitrate = config[@"minBitrate"];
  if (minBitrate != nil) {
    if (![video setMinBitrate:minBitrate.integerValue error:error]) {
      return nil;
    }
  }

  NSNumber *maxBitrate = config[@"maxBitrate"];
  if (maxBitrate != nil) {
    if (![video setMaxBitrate:maxBitrate.integerValue error:error]) {
      return nil;
    }
  }

  return streamConfig;
}

- (void)applyCameraPositionToDevice:(id<IVSCamera>)camera
{
  IVSDevicePosition wanted = self.cameraPositionValue;
  for (IVSDeviceDescriptor *source in [camera listAvailableInputSources]) {
    if (source.position == wanted) {
      [camera setPreferredInputSource:source onComplete:nil];
      break;
    }
  }
}

- (BOOL)ensureLocalStreamsWithError:(NSError *_Nullable *_Nullable)error
{
  if (self.cameraStream != nil && self.microphoneStream != nil) {
    return YES;
  }

  id<IVSCamera> camera = [IvsDevices acquireCamera];
  id<IVSMicrophone> microphone = [IvsDevices acquireMicrophone];
  if (camera == nil || microphone == nil) {
    // Partial acquire must not leave the OS camera/mic indicators on.
    [self releaseLocalMedia];
    if (error != nil) {
      *error = [NSError errorWithDomain:@"IvsStageManager"
                                   code:1
                               userInfo:@{NSLocalizedDescriptionKey : @"Camera or microphone unavailable."}];
    }
    return NO;
  }

  [self applyCameraPositionToDevice:camera];

  if (self.cameraStream == nil) {
    self.cameraStream = [[IVSLocalStageStream alloc] initWithDevice:camera config:self.videoStreamConfig];
    [self.cameraStream setMuted:!self.cameraEnabled || self.isInBackground];
  }

  if (self.microphoneStream == nil) {
    self.microphoneStream = [[IVSLocalStageStream alloc] initWithDevice:microphone];
    [self.microphoneStream setMuted:!self.microphoneEnabled];
  }

  return YES;
}

- (void)clearLocalStreams
{
  self.cameraStream = nil;
  self.microphoneStream = nil;
}

- (void)releaseLocalMedia
{
  [self clearLocalStreams];
  [IvsDevices releaseDevices];
}

/// Ignore callbacks from a Stage that is no longer current (e.g. after renewToken).
- (BOOL)isCurrentStage:(IVSStage *)stage
{
  return stage != nil && stage == self.stage;
}

#pragma mark - Join / leave / renew

- (void)completePendingLeaveAfterDisconnect
{
  if (self.pendingLeaveTimeoutWork != nil) {
    dispatch_block_cancel(self.pendingLeaveTimeoutWork);
    self.pendingLeaveTimeoutWork = nil;
  }

  void (^resolve)(void) = self.pendingLeaveResolve;
  self.pendingLeaveResolve = nil;

  IVSStage *stage = self.stage;
  if (stage != nil) {
    [stage removeRenderer:self];
    self.stage = nil;
  }

  [self.participants removeAllObjects];
  [self.subscribeOverrides removeAllObjects];
  self.publishEnabledValue = NO;
  [self releaseLocalMedia];
  [[IvsParticipantStreams shared]
      notifyAllViewsWithLookup:^IVSStageStream *(NSString *participantId) {
        return nil;
      }];

  if (resolve != nil) {
    resolve();
  }
}

- (void)finishPendingLeaveDueToTimeout
{
  if (self.pendingLeaveResolve == nil) {
    return;
  }

  self.connectionStateValue = @"disconnected";
  [self emitError:@"unknown"
            message:@"Stage did not report disconnect after leave()."
        nativeError:nil];
  [self completePendingLeaveAfterDisconnect];
}

- (BOOL)createAndJoinStageWithToken:(NSString *)token error:(NSError *_Nullable *_Nullable)error
{
  IVSStage *stage = [[IVSStage alloc] initWithToken:token strategy:self error:error];
  if (stage == nil) {
    return NO;
  }

  [stage addRenderer:self];
  if (![stage joinWithError:error]) {
    [stage removeRenderer:self];
    return NO;
  }

  self.stage = stage;
  return YES;
}

- (void)joinWithToken:(NSString *)token
              options:(nullable NSDictionary *)options
              resolve:(void (^)(void))resolve
               reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.stage != nil) {
      reject(@"stage-in-use", @"Already connected to a stage. Call leave() first.", nil);
      return;
    }

    BOOL publish = NO;
    if ([options[@"publish"] isKindOfClass:[NSNumber class]]) {
      publish = [options[@"publish"] boolValue];
    }
    self.publishEnabledValue = publish;

    if (publish) {
      NSError *deviceError = nil;
      if (![self ensureLocalStreamsWithError:&deviceError]) {
        self.publishEnabledValue = NO;
        // ensureLocalStreams already released on partial acquire failure.
        reject(@"device-unavailable",
               deviceError.localizedDescription ?: @"Failed to prepare local media.",
               [IvsMapping nativeErrorDictionary:deviceError]);
        return;
      }
    }

    NSError *error = nil;
    if (![self createAndJoinStageWithToken:token error:&error]) {
      NSString *code = [IvsMapping mapErrorCode:error fallback:@"token-invalid"];
      self.publishEnabledValue = NO;
      if (publish) {
        [self releaseLocalMedia];
      }
      reject(code, error.localizedDescription ?: @"Failed to join stage.", [IvsMapping nativeErrorDictionary:error]);
      return;
    }

    resolve();
  });
}

- (void)leaveWithResolve:(void (^)(void))resolve
                  reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.stage == nil) {
      resolve();
      return;
    }

    if (self.pendingLeaveResolve != nil) {
      resolve();
      return;
    }

    self.pendingLeaveResolve = [resolve copy];

    __weak __typeof(self) weakSelf = self;
    dispatch_block_t timeoutWork = dispatch_block_create((dispatch_block_flags_t)0, ^{
      [weakSelf finishPendingLeaveDueToTimeout];
    });
    self.pendingLeaveTimeoutWork = timeoutWork;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(5 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(),
                   timeoutWork);

    [self.stage leave];
  });
}

- (void)renewToken:(NSString *)token
           resolve:(void (^)(void))resolve
            reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.stage == nil) {
      reject(@"join-failed", @"Not connected to a stage.", nil);
      return;
    }

    IvsParticipantRecord *localBefore = [self localParticipantRecord];
    NSString *oldParticipantId = localBefore != nil ? (localBefore.info.participantId ?: @"") : @"";

    BOOL publishEnabled = self.publishEnabledValue;
    BOOL microphoneEnabled = self.microphoneEnabled;
    BOOL cameraEnabled = self.cameraEnabled;
    IVSDevicePosition cameraPosition = self.cameraPositionValue;
    IVSStageSubscribeType defaultSubscribe = self.defaultSubscribeType;
    NSDictionary *subscribeOverrides = [self.subscribeOverrides copy];
    IVSLocalStageStreamConfiguration *videoConfig = self.videoStreamConfig;
    IVSLocalStageStream *cameraStream = self.cameraStream;
    IVSLocalStageStream *microphoneStream = self.microphoneStream;

    // Detach and clear `self.stage` before leave so sync/async callbacks from
    // the old Stage cannot mutate the replacement session.
    IVSStage *oldStage = self.stage;
    [oldStage removeRenderer:self];
    self.stage = nil;
    [oldStage leave];

    [self.participants removeAllObjects];

    self.publishEnabledValue = publishEnabled;
    self.microphoneEnabled = microphoneEnabled;
    self.cameraEnabled = cameraEnabled;
    self.cameraPositionValue = cameraPosition;
    self.defaultSubscribeType = defaultSubscribe;
    [self.subscribeOverrides removeAllObjects];
    [self.subscribeOverrides addEntriesFromDictionary:subscribeOverrides];
    self.videoStreamConfig = videoConfig;
    self.cameraStream = cameraStream;
    self.microphoneStream = microphoneStream;

    if (oldParticipantId.length > 0) {
      [self emitEvent:@"onParticipantLeft" body:@{@"participantId" : oldParticipantId}];
    }

    NSError *error = nil;
    if (![self createAndJoinStageWithToken:token error:&error]) {
      self.connectionStateValue = @"disconnected";
      self.publishEnabledValue = NO;
      [self releaseLocalMedia];
      NSString *code = [IvsMapping mapErrorCode:error fallback:@"token-invalid"];
      reject(code, error.localizedDescription ?: @"Failed to renew token.", [IvsMapping nativeErrorDictionary:error]);
      return;
    }

    if (publishEnabled) {
      [self.stage refreshStrategy];
      [self.cameraStream setMuted:!cameraEnabled || self.isInBackground];
      [self.microphoneStream setMuted:!microphoneEnabled];
    }

    resolve();
  });
}

- (NSArray<NSDictionary *> *)listParticipants
{
  __block NSArray *result = nil;
  if ([NSThread isMainThread]) {
    result = [self buildParticipantsList];
  } else {
    dispatch_sync(dispatch_get_main_queue(), ^{
      result = [self buildParticipantsList];
    });
  }
  return result;
}

- (NSArray<NSDictionary *> *)buildParticipantsList
{
  NSMutableArray *result = [NSMutableArray arrayWithCapacity:self.participants.count];
  for (IvsParticipantRecord *record in self.participants.allValues) {
    [result addObject:[self participantDictionary:record]];
  }
  return result;
}

#pragma mark - Publish / media controls

- (void)setPublishEnabled:(BOOL)enabled
                  resolve:(void (^)(void))resolve
                   reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (enabled) {
      NSError *error = nil;
      if (![self ensureLocalStreamsWithError:&error]) {
        reject(@"device-unavailable",
               error.localizedDescription ?: @"Failed to prepare local media.",
               [IvsMapping nativeErrorDictionary:error]);
        return;
      }
    } else {
      [self.cameraStream setMuted:YES];
      [self.microphoneStream setMuted:YES];
    }

    self.publishEnabledValue = enabled;
    [self.stage refreshStrategy];

    if (enabled) {
      [self.cameraStream setMuted:!self.cameraEnabled || self.isInBackground];
      [self.microphoneStream setMuted:!self.microphoneEnabled];
    }

    IvsParticipantRecord *local = [self localParticipantRecord];
    if (local != nil) {
      [self emitParticipantUpdated:local];
    }
    resolve();
  });
}

- (void)setMicrophoneEnabled:(BOOL)enabled
                     resolve:(void (^)(void))resolve
                      reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    self.microphoneEnabled = enabled;

    if (self.publishEnabledValue && self.microphoneStream == nil) {
      NSError *error = nil;
      if (![self ensureLocalStreamsWithError:&error]) {
        reject(@"device-unavailable",
               error.localizedDescription ?: @"Microphone unavailable.",
               [IvsMapping nativeErrorDictionary:error]);
        return;
      }
    }

    [self.microphoneStream setMuted:!enabled];
    IvsParticipantRecord *local = [self localParticipantRecord];
    if (local != nil) {
      [self emitParticipantUpdated:local];
    }
    resolve();
  });
}

- (void)setCameraEnabled:(BOOL)enabled
                 resolve:(void (^)(void))resolve
                  reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    self.cameraEnabled = enabled;
    if (!self.isInBackground) {
      self.cameraEnabledBeforeBackground = enabled;
    }

    if (self.publishEnabledValue && self.cameraStream == nil) {
      NSError *error = nil;
      if (![self ensureLocalStreamsWithError:&error]) {
        reject(@"device-unavailable",
               error.localizedDescription ?: @"Camera unavailable.",
               [IvsMapping nativeErrorDictionary:error]);
        return;
      }
    }

    [self.cameraStream setMuted:!enabled || self.isInBackground];
    IvsParticipantRecord *local = [self localParticipantRecord];
    if (local != nil) {
      [self emitParticipantUpdated:local];
    }
    resolve();
  });
}

- (void)setCameraPosition:(NSString *)position
                  resolve:(void (^)(void))resolve
                   reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    IVSDevicePosition wanted = [IvsMapping cameraPositionFromString:position];
    if (self.cameraPositionValue == wanted) {
      resolve();
      return;
    }

    id<IVSCamera> camera = [IvsDevices camera] ?: [IvsDevices acquireCamera];
    if (camera == nil) {
      reject(@"device-unavailable", @"No camera available.", nil);
      return;
    }

    self.cameraPositionValue = wanted;

    for (IVSDeviceDescriptor *source in [camera listAvailableInputSources]) {
      if (source.position == wanted) {
        [camera setPreferredInputSource:source
                             onComplete:^(NSError *_Nullable error) {
                               dispatch_async(dispatch_get_main_queue(), ^{
                                 if (error != nil) {
                                   reject(@"device-unavailable", error.localizedDescription,
                                          [IvsMapping nativeErrorDictionary:error]);
                                   return;
                                 }
                                 resolve();
                               });
                             }];
        return;
      }
    }

    reject(@"device-unavailable", @"Requested camera position is not available.", nil);
  });
}

- (void)flipCameraWithResolve:(void (^)(void))resolve
                      reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  NSString *next = self.cameraPositionValue == IVSDevicePositionFront ? @"back" : @"front";
  [self setCameraPosition:next resolve:resolve reject:reject];
}

- (void)prepareDevicesWithOptions:(nullable NSDictionary *)options
                          resolve:(void (^)(void))resolve
                           reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    BOOL wantsCamera = YES;
    BOOL wantsMicrophone = YES;
    if ([options[@"camera"] isKindOfClass:[NSNumber class]]) {
      wantsCamera = [options[@"camera"] boolValue];
    }
    if ([options[@"microphone"] isKindOfClass:[NSNumber class]]) {
      wantsMicrophone = [options[@"microphone"] boolValue];
    }

    NSError *error = nil;
    if (![IvsDevices prepareDevicesWithCamera:wantsCamera microphone:wantsMicrophone error:&error]) {
      reject(@"device-unavailable", error.localizedDescription ?: @"Device unavailable.",
             [IvsMapping nativeErrorDictionary:error]);
      return;
    }

    if (wantsCamera) {
      id<IVSCamera> camera = [IvsDevices camera];
      [self applyCameraPositionToDevice:camera];
    }
    resolve();
  });
}

- (void)releaseDevicesWithResolve:(void (^)(void))resolve
                           reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.publishEnabledValue) {
      reject(@"device-unavailable",
             @"Cannot release devices while publishing. Call setPublishEnabled(false) first.", nil);
      return;
    }
    [self releaseLocalMedia];
    resolve();
  });
}

- (void)setVideoConfig:(NSDictionary *)config
               resolve:(void (^)(void))resolve
                reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSError *error = nil;
    IVSLocalStageStreamConfiguration *streamConfig =
        [self buildStreamConfigurationFromDict:config error:&error];
    if (config.count > 0 && streamConfig == nil) {
      reject(@"unknown", error.localizedDescription ?: @"Invalid video configuration.",
             [IvsMapping nativeErrorDictionary:error]);
      return;
    }

    self.videoStreamConfig = streamConfig;

    if (self.cameraStream != nil && streamConfig != nil) {
      [self.cameraStream setConfig:streamConfig];
    }
    resolve();
  });
}

- (void)setDefaultSubscribeType:(NSString *)type
                        resolve:(void (^)(void))resolve
                         reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (![IvsMapping isValidSubscribeType:type]) {
      reject(@"unknown", @"Invalid subscribe type. Use none, audio-only, or audio-video.", nil);
      return;
    }
    self.defaultSubscribeType = [IvsMapping subscribeTypeFromString:type];
    [self.stage refreshStrategy];
    resolve();
  });
}

- (void)setSubscribeType:(NSString *)type
           participantId:(NSString *)participantId
                 resolve:(void (^)(void))resolve
                  reject:(void (^)(NSString *code, NSString *message, NSDictionary *_Nullable nativeError))reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (![IvsMapping isValidSubscribeType:type]) {
      reject(@"unknown", @"Invalid subscribe type. Use none, audio-only, or audio-video.", nil);
      return;
    }
    if (participantId.length == 0) {
      reject(@"unknown", @"participantId is required.", nil);
      return;
    }
    self.subscribeOverrides[participantId] = @([IvsMapping subscribeTypeFromString:type]);
    [self.stage refreshStrategy];
    resolve();
  });
}

#pragma mark - Participants helpers

- (nullable IvsParticipantRecord *)localParticipantRecord
{
  for (IvsParticipantRecord *record in self.participants.allValues) {
    if (record.info.isLocal) {
      return record;
    }
  }
  return nil;
}

- (nullable IvsParticipantRecord *)recordForParticipant:(IVSParticipantInfo *)participant
{
  return self.participants[participant.participantId];
}

- (IvsParticipantRecord *)upsertParticipant:(IVSParticipantInfo *)participant
{
  IvsParticipantRecord *record = self.participants[participant.participantId];
  if (record == nil) {
    record = [[IvsParticipantRecord alloc] init];
    self.participants[participant.participantId] = record;
  }
  record.info = participant;
  return record;
}

- (nullable IVSStageStream *)videoStreamForParticipantId:(NSString *)participantId
{
  IvsParticipantRecord *record = self.participants[participantId];
  if (record == nil) {
    return nil;
  }
  return [[IvsParticipantStreams shared] videoStreamForParticipantId:participantId fromStreams:record.streams];
}

#pragma mark - IvsAppLifecycleDelegate

- (void)appLifecycleDidEnterBackground
{
  self.isInBackground = YES;
  self.cameraEnabledBeforeBackground = self.cameraEnabled;
  [self.cameraStream setMuted:YES];
}

- (void)appLifecycleWillEnterForeground
{
  self.isInBackground = NO;
  [self.cameraStream setMuted:!self.cameraEnabledBeforeBackground];
}

- (void)appLifecycleAudioInterruptionBegan
{
  [self.microphoneStream setMuted:YES];
  [self.cameraStream setMuted:YES];
}

- (void)appLifecycleAudioInterruptionEndedWithShouldResume:(BOOL)shouldResume
{
  if (!shouldResume) {
    return;
  }

  [[IvsAudioSession shared] recoverFromInterruption];
  [self.microphoneStream setMuted:!self.microphoneEnabled];
  [self.cameraStream setMuted:!self.cameraEnabled || self.isInBackground];
}

#pragma mark - IVSStageStrategy

- (BOOL)stage:(IVSStage *)stage shouldPublishParticipant:(IVSParticipantInfo *)participant
{
  if (![self isCurrentStage:stage]) {
    return NO;
  }
  return participant.isLocal && self.publishEnabledValue;
}

- (NSArray<IVSLocalStageStream *> *)stage:(IVSStage *)stage
             streamsToPublishForParticipant:(IVSParticipantInfo *)participant
{
  if (![self isCurrentStage:stage] || !participant.isLocal || !self.publishEnabledValue) {
    return @[];
  }

  NSMutableArray<IVSLocalStageStream *> *streams = [NSMutableArray array];
  if (self.cameraStream != nil) {
    [streams addObject:self.cameraStream];
  }
  if (self.microphoneStream != nil) {
    [streams addObject:self.microphoneStream];
  }
  return streams;
}

- (IVSStageSubscribeType)stage:(IVSStage *)stage shouldSubscribeToParticipant:(IVSParticipantInfo *)participant
{
  if (![self isCurrentStage:stage] || participant.isLocal) {
    return IVSStageSubscribeTypeNone;
  }
  NSNumber *override = self.subscribeOverrides[participant.participantId];
  if (override != nil) {
    return (IVSStageSubscribeType)override.integerValue;
  }
  return self.defaultSubscribeType;
}

#pragma mark - IVSStageRenderer

- (void)stage:(IVSStage *)stage
    didChangeConnectionState:(IVSStageConnectionState)connectionState
                   withError:(NSError *_Nullable)error
{
  if (![self isCurrentStage:stage]) {
    return;
  }

  self.connectionStateValue = [IvsMapping connectionStateToString:connectionState];
  NSMutableDictionary *body = [@{@"state" : self.connectionStateValue} mutableCopy];
  if (error != nil) {
    body[@"error"] = error.localizedDescription;
    NSString *code = [IvsMapping mapErrorCode:error
                                     fallback:connectionState == IVSStageConnectionStateDisconnected
                                                  ? @"disconnected"
                                                  : @"unknown"];
    [self emitError:code message:error.localizedDescription nativeError:error];
  }
  [self emitEvent:@"onStageConnectionStateChanged" body:body];

  if (connectionState == IVSStageConnectionStateDisconnected && self.pendingLeaveResolve != nil) {
    [self completePendingLeaveAfterDisconnect];
  }
}

- (void)stage:(IVSStage *)stage participantDidJoin:(IVSParticipantInfo *)participant
{
  if (![self isCurrentStage:stage]) {
    return;
  }
  IvsParticipantRecord *record = [self upsertParticipant:participant];
  [self emitEvent:@"onParticipantJoined" body:[self participantDictionary:record]];
}

- (void)stage:(IVSStage *)stage participantDidLeave:(IVSParticipantInfo *)participant
{
  if (![self isCurrentStage:stage]) {
    return;
  }
  NSString *participantId = participant.participantId ?: @"";
  [self.participants removeObjectForKey:participantId];
  [self.subscribeOverrides removeObjectForKey:participantId];
  [[IvsParticipantStreams shared] notifyStreamsChangedForParticipantId:participantId streams:@[]];
  [self emitEvent:@"onParticipantLeft" body:@{@"participantId" : participantId}];
}

- (void)stage:(IVSStage *)stage participantMetadataDidUpdate:(IVSParticipantInfo *)participant
{
  if (![self isCurrentStage:stage]) {
    return;
  }
  IvsParticipantRecord *record = [self upsertParticipant:participant];
  [self emitParticipantUpdated:record];
}

- (void)stage:(IVSStage *)stage
              participant:(IVSParticipantInfo *)participant
    didChangePublishState:(IVSParticipantPublishState)publishState
{
  if (![self isCurrentStage:stage]) {
    return;
  }
  IvsParticipantRecord *record = [self upsertParticipant:participant];
  record.publishState = publishState;
  [self emitParticipantUpdated:record];
}

- (void)stage:(IVSStage *)stage
                participant:(IVSParticipantInfo *)participant
    didChangeSubscribeState:(IVSParticipantSubscribeState)subscribeState
{
  if (![self isCurrentStage:stage]) {
    return;
  }
  IvsParticipantRecord *record = [self upsertParticipant:participant];
  record.subscribeState = subscribeState;
  [self emitParticipantUpdated:record];
}

- (void)stage:(IVSStage *)stage
              participant:(IVSParticipantInfo *)participant
          didAddStreams:(NSArray<IVSStageStream *> *)streams
{
  if (![self isCurrentStage:stage]) {
    return;
  }
  IvsParticipantRecord *record = [self upsertParticipant:participant];
  for (IVSStageStream *stream in streams) {
    if (![record.streams containsObject:stream]) {
      [record.streams addObject:stream];
    }
  }
  [self emitParticipantUpdated:record];
  [self emitStreamsChanged:record];
}

- (void)stage:(IVSStage *)stage
              participant:(IVSParticipantInfo *)participant
       didRemoveStreams:(NSArray<IVSStageStream *> *)streams
{
  if (![self isCurrentStage:stage]) {
    return;
  }
  IvsParticipantRecord *record = [self recordForParticipant:participant];
  if (record == nil) {
    return;
  }
  [record.streams removeObjectsInArray:streams];
  [self emitParticipantUpdated:record];
  [self emitStreamsChanged:record];
}

- (void)stage:(IVSStage *)stage
              participant:(IVSParticipantInfo *)participant
    didChangeMutedStreams:(NSArray<IVSStageStream *> *)streams
{
  if (![self isCurrentStage:stage]) {
    return;
  }
  IvsParticipantRecord *record = [self recordForParticipant:participant];
  if (record == nil) {
    return;
  }
  [self emitParticipantUpdated:record];
  [self emitStreamsChanged:record];
}

@end
