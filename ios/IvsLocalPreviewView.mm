#import "IvsLocalPreviewView.h"
#import "IvsDevices.h"
#import "IvsPreviewHostView.h"

#import <AmazonIVSBroadcast/AmazonIVSBroadcast.h>

#import <react/renderer/components/AmazonIvsRealTimeSpec/ComponentDescriptors.h>
#import <react/renderer/components/AmazonIvsRealTimeSpec/Props.h>
#import <react/renderer/components/AmazonIvsRealTimeSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

static NSHashTable<IvsLocalPreviewView *> *IvsMountedLocalPreviews(void)
{
  static NSHashTable<IvsLocalPreviewView *> *mounted;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    mounted = [NSHashTable weakObjectsHashTable];
  });
  return mounted;
}

@implementation IvsLocalPreviewView {
  IvsPreviewHostView *_hostView;
  NSString *_source;
  NSString *_aspectMode;
  BOOL _mirror;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<IvsLocalPreviewViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const IvsLocalPreviewViewProps>();
    _props = defaultProps;
    _hostView = [[IvsPreviewHostView alloc] initWithFrame:self.bounds];
    _hostView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    [self addSubview:_hostView];
    _source = @"camera";
    _aspectMode = @"fill";
    _mirror = NO;
    _hostView.aspectMode = _aspectMode;
    _hostView.mirror = _mirror;
  }
  return self;
}

- (nullable id<IVSImageDevice>)imageDeviceForSource:(NSString *)source
{
  if ([source isEqualToString:@"camera"]) {
    id<IVSCamera> camera = [IvsDevices camera] ?: [IvsDevices acquireCamera];
    return camera;
  }

  if ([source isEqualToString:@"screen"]) {
    return nil;
  }

  IVSDeviceDiscovery *discovery = [IvsDevices discovery];
  if (discovery == nil) {
    discovery = [[IVSDeviceDiscovery alloc] init];
  }

  for (id<IVSDevice> device in [discovery listLocalDevices]) {
    if ([device conformsToProtocol:@protocol(IVSMultiSourceDevice)]) {
      id<IVSMultiSourceDevice> multiSource = (id<IVSMultiSourceDevice>)device;
      for (IVSDeviceDescriptor *descriptor in [multiSource listAvailableInputSources]) {
        if ([descriptor.urn isEqualToString:source]) {
          if ([device conformsToProtocol:@protocol(IVSCamera)]) {
            return (id<IVSImageDevice>)device;
          }
        }
      }
    }
    if ([[device descriptor].urn isEqualToString:source] &&
        [device conformsToProtocol:@protocol(IVSImageDevice)]) {
      return (id<IVSImageDevice>)device;
    }
  }

  return nil;
}

- (void)rebuildPreview
{
  id<IVSImageDevice> device = [self imageDeviceForSource:_source];
  if (device == nil) {
    [_hostView clearPreview];
    return;
  }

  if (_hostView.previewView != nil) {
    [_hostView applyMirror];
    return;
  }

  NSError *error = nil;
  IVSImagePreviewView *preview = [device previewViewWithAspectMode:[_hostView ivsAspectMode] error:&error];
  if (preview == nil) {
    NSLog(@"IvsLocalPreviewView: failed to create preview: %@", error);
    return;
  }

  [_hostView attachPreview:preview];
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  _hostView.frame = self.bounds;
  if (self.window != nil && !CGRectIsEmpty(self.bounds) && _hostView.previewView == nil) {
    [self rebuildPreview];
  }
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (self.window != nil) {
    [IvsMountedLocalPreviews() addObject:self];
    if (!CGRectIsEmpty(self.bounds)) {
      [self rebuildPreview];
    }
  } else {
    [IvsMountedLocalPreviews() removeObject:self];
  }
}

+ (void)notifyMountedViews
{
  for (IvsLocalPreviewView *view in IvsMountedLocalPreviews()) {
    [view->_hostView clearPreview];
    [view rebuildPreview];
  }
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newViewProps = *std::static_pointer_cast<IvsLocalPreviewViewProps const>(props);

  NSString *source = [NSString stringWithUTF8String:newViewProps.source.c_str()];
  NSString *aspectMode = [NSString stringWithUTF8String:toString(newViewProps.aspectMode).c_str()];
  NSString *mirrorMode = [NSString stringWithUTF8String:toString(newViewProps.mirror).c_str()];
  BOOL mirror = [mirrorMode isEqualToString:@"on"];

  BOOL sourceChanged = ![source isEqualToString:_source];
  BOOL aspectModeChanged = ![aspectMode isEqualToString:_aspectMode];

  _source = source;
  _aspectMode = aspectMode;
  _mirror = mirror;
  _hostView.aspectMode = aspectMode;
  _hostView.mirror = mirror;

  if (self.window != nil) {
    if (sourceChanged || aspectModeChanged || (_hostView.previewView == nil)) {
      [_hostView clearPreview];
      [self rebuildPreview];
    }
    [_hostView applyMirror];
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  [_hostView clearPreview];
  _source = @"camera";
  _aspectMode = @"fill";
  _mirror = NO;
  _hostView.aspectMode = _aspectMode;
  _hostView.mirror = _mirror;
}

@end

Class<RCTComponentViewProtocol> IvsLocalPreviewViewCls(void)
{
  return IvsLocalPreviewView.class;
}
