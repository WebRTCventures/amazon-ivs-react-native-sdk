#import "IvsParticipantVideoView.h"
#import "IvsParticipantStreams.h"
#import "IvsPreviewHostView.h"

#import <AmazonIVSBroadcast/AmazonIVSBroadcast.h>

#import <react/renderer/components/AmazonIvsRealTimeSpec/ComponentDescriptors.h>
#import <react/renderer/components/AmazonIvsRealTimeSpec/Props.h>
#import <react/renderer/components/AmazonIvsRealTimeSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@implementation IvsParticipantVideoView {
  IvsPreviewHostView *_hostView;
  NSString *_participantId;
  NSString *_aspectMode;
  BOOL _mirror;
  BOOL _registered;
  IVSStageStream *_attachedVideoStream;
  NSString *_attachedAspectMode;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IvsParticipantVideoViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const IvsParticipantVideoViewProps>();
    _props = defaultProps;
    _hostView = [[IvsPreviewHostView alloc] initWithFrame:self.bounds];
    _hostView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [self addSubview:_hostView];
    _participantId = @"";
    _aspectMode = @"fill";
    _mirror = NO;
    _registered = NO;
    _hostView.aspectMode = _aspectMode;
    _hostView.mirror = _mirror;
  }
  return self;
}

- (nullable NSString *)participantId
{
  return _participantId;
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (self.window != nil) {
    [self registerIfNeeded];
  }
}

- (void)registerIfNeeded
{
  if (_registered || _participantId.length == 0) {
    return;
  }
  _registered = YES;
  [[IvsParticipantStreams shared] registerView:self participantId:_participantId];
}

- (void)deregisterIfNeeded
{
  if (!_registered) {
    return;
  }
  _registered = NO;
  [[IvsParticipantStreams shared] deregisterView:self];
}

- (void)attachVideoStream:(nullable IVSStageStream *)stream
{
  BOOL alreadyAttached =
      stream != nil && stream == _attachedVideoStream &&
      [_attachedAspectMode isEqualToString:_aspectMode] && _hostView.previewView != nil;
  if (alreadyAttached) {
    return;
  }

  _attachedVideoStream = nil;
  _attachedAspectMode = nil;
  [_hostView clearPreview];

  if (stream == nil) {
    return;
  }

  id<IVSDevice> device = stream.device;
  if (![device conformsToProtocol:@protocol(IVSImageDevice)]) {
    return;
  }

  id<IVSImageDevice> imageDevice = (id<IVSImageDevice>)device;
  NSError *error = nil;
  IVSImagePreviewView *preview = [imageDevice previewViewWithAspectMode:[_hostView ivsAspectMode] error:&error];
  if (preview == nil) {
    NSLog(@"IvsParticipantVideoView: failed to create preview: %@", error);
    return;
  }

  [_hostView attachPreview:preview];
  _attachedVideoStream = stream;
  _attachedAspectMode = [_aspectMode copy];
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newViewProps = *std::static_pointer_cast<IvsParticipantVideoViewProps const>(props);

  NSString *participantId = [NSString stringWithUTF8String:newViewProps.participantId.c_str()];
  NSString *aspectMode = [NSString stringWithUTF8String:toString(newViewProps.aspectMode).c_str()];
  BOOL mirror = newViewProps.mirror;

  BOOL participantChanged = ![participantId isEqualToString:_participantId];
  BOOL aspectModeChanged = ![aspectMode isEqualToString:_aspectMode];
  BOOL mirrorChanged = mirror != _mirror;

  if (participantChanged && _registered) {
    [self deregisterIfNeeded];
    _attachedVideoStream = nil;
    _attachedAspectMode = nil;
  }

  _participantId = participantId;
  _aspectMode = aspectMode;
  _mirror = mirror;
  _hostView.aspectMode = aspectMode;
  _hostView.mirror = mirror;

  if (self.window != nil) {
    if (participantChanged || !_registered) {
      [self registerIfNeeded];
    } else if (aspectModeChanged) {
      IVSStageStream *stream =
          [[IvsParticipantStreams shared] currentVideoStreamForParticipantId:_participantId];
      [self attachVideoStream:stream];
    } else if (mirrorChanged && _hostView.previewView != nil) {
      [_hostView applyMirror];
    }
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  [self deregisterIfNeeded];
  [_hostView clearPreview];
  _attachedVideoStream = nil;
  _attachedAspectMode = nil;
  _participantId = @"";
}

@end

Class<RCTComponentViewProtocol> IvsParticipantVideoViewCls(void)
{
  return IvsParticipantVideoView.class;
}
