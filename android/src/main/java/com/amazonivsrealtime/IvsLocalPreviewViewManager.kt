package com.amazonivsrealtime

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.IvsLocalPreviewViewManagerDelegate
import com.facebook.react.viewmanagers.IvsLocalPreviewViewManagerInterface

@ReactModule(name = IvsLocalPreviewViewManager.NAME)
class IvsLocalPreviewViewManager :
  SimpleViewManager<IvsLocalPreviewView>(),
  IvsLocalPreviewViewManagerInterface<IvsLocalPreviewView> {

  private val delegate: ViewManagerDelegate<IvsLocalPreviewView> =
    IvsLocalPreviewViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<IvsLocalPreviewView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): IvsLocalPreviewView =
    IvsLocalPreviewView(context)

  override fun onDropViewInstance(view: IvsLocalPreviewView) {
    super.onDropViewInstance(view)
    view.release()
  }

  @ReactProp(name = "source")
  override fun setSource(view: IvsLocalPreviewView?, value: String?) {
    view?.setSourceProp(value)
  }

  @ReactProp(name = "mirror")
  override fun setMirror(view: IvsLocalPreviewView?, value: String?) {
    view?.setMirrorProp(value == "on")
  }

  @ReactProp(name = "aspectMode")
  override fun setAspectMode(view: IvsLocalPreviewView?, value: String?) {
    view?.setAspectModeProp(value)
  }

  companion object {
    const val NAME = "IvsLocalPreviewView"
  }
}
