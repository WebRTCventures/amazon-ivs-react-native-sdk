import IvsLocalPreviewViewNativeComponent from '../spec/IvsLocalPreviewViewNativeComponent';
import type { ViewProps } from 'react-native';
import type { AspectMode } from '../core/types';

export interface IVSLocalPreviewViewProps extends ViewProps {
  /**
   * Local device source. Defaults to 'camera'.
   * Extensibility point for 'screen' or a device urn.
   */
  source?: 'camera' | 'screen' | (string & {});
  /** Horizontally mirror the preview. Defaults to true. */
  mirror?: boolean;
  /** How the video fills the view bounds. Defaults to 'fill'. */
  aspectMode?: AspectMode;
}

/**
 * Live local device preview (green room / permission screens / pre-join).
 * Camera position is controlled via `IVSStage.flipCamera()` / `setCameraPosition()` —
 * not via a prop — so flips are not silently reverted by React prop updates.
 */
export function IVSLocalPreviewView({
  source = 'camera',
  mirror = true,
  aspectMode = 'fill',
  ...viewProps
}: IVSLocalPreviewViewProps) {
  return (
    <IvsLocalPreviewViewNativeComponent
      source={source}
      mirror={mirror ? 'on' : 'off'}
      aspectMode={aspectMode}
      {...viewProps}
    />
  );
}
