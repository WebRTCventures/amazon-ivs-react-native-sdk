#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface IvsLocalPreviewView : RCTViewComponentView

/// Re-attach every mounted local preview (publish / camera change).
+ (void)notifyMountedViews;

@end

NS_ASSUME_NONNULL_END
