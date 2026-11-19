import AVFoundation
import Metal
import QuartzCore
import SwiftUI
import UIKit

/*
  The clip's camera: AVFoundation, a live viewfinder through the look, and 4:3
  photos at the sensor's full size — the app's `film-camera.tsx` and
  `camera.tsx` in native form.

  Frames arrive upright (the connection rotates them to portrait) and the
  front camera's are mirrored on the connection, so the picture is the same in
  the viewfinder and in the photo: selfies are saved mirrored, as previewed,
  like the app's. The photo connection follows how the phone is held
  (`RotationCoordinator`), so a sideways phone takes a landscape picture.
*/

/// The viewfinder: a Metal layer the camera's queue draws every frame into,
/// through the look, without grain. No SwiftUI on the frame path.
final class ViewfinderView: UIView {
  override class var layerClass: AnyClass { CAMetalLayer.self }
  var metalLayer: CAMetalLayer { layer as! CAMetalLayer }

  private let lock = NSLock()
  private var drawableSize = CGSize.zero
  private var look: FilmLook = .fallback

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .black
    metalLayer.device = LookRenderer.shared?.device
    metalLayer.pixelFormat = .bgra8Unorm
    metalLayer.framebufferOnly = true
    metalLayer.contentsGravity = .resizeAspectFill
    isOpaque = true
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

  override func layoutSubviews() {
    super.layoutSubviews()
    let scale = window?.screen.scale ?? UIScreen.main.scale
    let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
    metalLayer.drawableSize = size
    lock.lock(); drawableSize = size; lock.unlock()
  }

  /// Called on the camera's video queue.
  func draw(_ pixelBuffer: CVPixelBuffer) {
    lock.lock(); let size = drawableSize; let look = self.look; lock.unlock()
    guard size.width > 0, let renderer = LookRenderer.shared,
          let frame = renderer.texture(from: pixelBuffer),
          let drawable = metalLayer.nextDrawable(),
          let buffer = renderer.queue.makeCommandBuffer()
    else { return }
    let (source, cvTexture) = frame
    let w = Int(size.width), h = Int(size.height)
    let crop = LookRenderer.fillCrop(sourceW: source.width, sourceH: source.height, targetW: w, targetH: h)
    renderer.encode(buffer, source: source, target: drawable.texture,
                    uniforms: LookUniforms(look: look, width: w, height: h, crop: crop, live: true))
    buffer.addCompletedHandler { _ in _ = cvTexture }
    buffer.present(drawable)
    buffer.commit()
  }

  func setLook(_ look: FilmLook) {
    lock.lock(); self.look = look; lock.unlock()
  }
}

enum CameraPermission {
  case unknown, granted, denied
}

/// One of the phone's own lenses, as a ratio to the wide one ("0.5×", "1×",
/// "3×") — `lib/zoom.ts`. Never a digital crop.
struct ZoomStop: Equatable, Identifiable {
  let label: String
  let factor: CGFloat
  var id: String { label }
}

/// "0.5×", "1×", "2.5×" — one decimal, none when whole.
func zoomLabel(_ ratio: CGFloat) -> String {
  let rounded = (ratio * 10).rounded() / 10
  return rounded == rounded.rounded() ? "\(Int(rounded))×" : String(format: "%.1f×", rounded)
}

final class CameraController: NSObject, ObservableObject, AVCaptureVideoDataOutputSampleBufferDelegate {
  @Published private(set) var permission: CameraPermission = .unknown
  /// The session runs *and* is configured for the selected camera — the
  /// shutter's gate, as in the app.
  @Published private(set) var ready = false
  @Published private(set) var position: AVCaptureDevice.Position = .back
  @Published private(set) var hasFlash = false
  /// The lenses to offer; empty with one lens and on the front camera.
  @Published private(set) var stops: [ZoomStop] = []
  /// The selected stop's label, or "" after a pinch.
  @Published private(set) var selectedStop = ""
  /// The pinched zoom ("1.2×"), shown alone while no stop is selected.
  @Published private(set) var liveZoom = ""

  let viewfinder = ViewfinderView(frame: .zero)

  private let session = AVCaptureSession()
  private let sessionQueue = DispatchQueue(label: "left.clip.camera.session")
  private let videoQueue = DispatchQueue(label: "left.clip.camera.video")
  private let videoOutput = AVCaptureVideoDataOutput()
  private let photoOutput = AVCapturePhotoOutput()
  private var input: AVCaptureDeviceInput?
  private var rotation: AVCaptureDevice.RotationCoordinator?
  private var pending: [Int64: PhotoDelegate] = [:]
  private var configured = false
  /// The selected camera, as the session queue knows it.
  private var activePosition: AVCaptureDevice.Position = .back
  private var zoomStart: CGFloat = 1
  /// Main-thread copies of the device's range: the pinch reads them per frame.
  private var zoomRange: ClosedRange<CGFloat> = 1...1
  private var wideFactor: CGFloat = 1
  private var currentZoom: CGFloat = 1

  // MARK: Lifecycle

  func start() {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
      permission = .granted
      run()
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { granted in
        DispatchQueue.main.async {
          self.permission = granted ? .granted : .denied
          if granted { self.run() }
        }
      }
    default:
      permission = .denied
    }
  }

  func stop() {
    sessionQueue.async {
      if self.session.isRunning { self.session.stopRunning() }
      DispatchQueue.main.async { self.ready = false }
    }
  }

  private func run() {
    sessionQueue.async {
      if !self.configured {
        self.configure(position: .back)
        self.configured = true
      }
      if !self.session.isRunning { self.session.startRunning() }
      let running = self.session.isRunning
      DispatchQueue.main.async { self.ready = running && self.input != nil }
    }
  }

  // MARK: Configuration

  /// The back camera is the phone's virtual multi-lens device where there is
  /// one, so pinching travels across lenses as in the system camera.
  private func device(for position: AVCaptureDevice.Position) -> AVCaptureDevice? {
    let types: [AVCaptureDevice.DeviceType] = position == .back
      ? [.builtInTripleCamera, .builtInDualWideCamera, .builtInDualCamera, .builtInWideAngleCamera]
      : [.builtInWideAngleCamera]
    return AVCaptureDevice.DiscoverySession(deviceTypes: types, mediaType: .video, position: position)
      .devices.first
  }

  /// The 4:3 format with 1920x1440 video (or the nearest larger 4:3 one up to
  /// 4032 wide) that can take a photo of at least 3024x4032; nil keeps the
  /// `.photo` preset's choice.
  private static func viewfinderFormat(_ device: AVCaptureDevice) -> AVCaptureDevice.Format? {
    let candidates = device.formats.filter { format in
      let dims = CMVideoFormatDescriptionGetDimensions(format.formatDescription)
      let fourThree = Int(dims.width) * 3 == Int(dims.height) * 4
      let photo = format.supportedMaxPhotoDimensions.contains { Int($0.width) * Int($0.height) >= 4032 * 3024 }
      let fps = format.videoSupportedFrameRateRanges.contains { $0.maxFrameRate >= 30 }
      return fourThree && photo && fps && dims.width >= 1920 && dims.width <= 4032
    }
    return candidates.min { a, b in
      let wa = CMVideoFormatDescriptionGetDimensions(a.formatDescription).width
      let wb = CMVideoFormatDescriptionGetDimensions(b.formatDescription).width
      if wa != wb { return wa < wb }
      // Full range (420f) over video range: the frames are converted to BGRA.
      return CMFormatDescriptionGetMediaSubType(a.formatDescription) == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange
    }
  }

  /// On the session queue.
  private func configure(position: AVCaptureDevice.Position) {
    session.beginConfiguration()
    defer { session.commitConfiguration() }
    session.sessionPreset = .photo

    if let input { session.removeInput(input) }
    input = nil
    guard let device = device(for: position),
          let newInput = try? AVCaptureDeviceInput(device: device),
          session.canAddInput(newInput)
    else { return }
    session.addInput(newInput)
    input = newInput
    activePosition = position

    if !session.outputs.contains(videoOutput), session.canAddOutput(videoOutput) {
      videoOutput.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
      videoOutput.alwaysDiscardsLateVideoFrames = true
      videoOutput.setSampleBufferDelegate(self, queue: videoQueue)
      session.addOutput(videoOutput)
    }
    if !session.outputs.contains(photoOutput), session.canAddOutput(photoOutput) {
      session.addOutput(photoOutput)
      // iOS's full processing (Deep Fusion, Smart HDR), as the app asks for.
      photoOutput.maxPhotoQualityPrioritization = .quality
    }

    // A sharp viewfinder (2026-11-19, the user): pick the 4:3 format whose
    // video frames are 1920x1440 — about the screen's own pixels — and that
    // still takes 12 MP photos. `.photo` left the frame size to the system.
    // The frames go to Metal without a copy, so the size costs little.
    if let format = Self.viewfinderFormat(device), (try? device.lockForConfiguration()) != nil {
      device.activeFormat = format
      device.unlockForConfiguration()
    }

    // The largest photo up to 12 MP (3024x4032). A 48 MP frame would only be
    // scaled down to the 3000 px print, at four times the memory and time.
    let sizes = device.activeFormat.supportedMaxPhotoDimensions
    let fitting = sizes.filter { Int($0.width) * Int($0.height) <= 4032 * 3024 }
    if let largest = (fitting.isEmpty ? sizes : fitting).max(by: { Int($0.width) * Int($0.height) < Int($1.width) * Int($1.height) }) {
      photoOutput.maxPhotoDimensions = largest
    }

    // The lens stops (`stopsForDevice()` in lib/zoom.ts). With an ultra wide
    // the range starts below the wide lens, so 1× is the first switch-over;
    // without one (wide + tele) the range starts on it. Start on 1×.
    let minZoom = device.minAvailableVideoZoomFactor
    let maxZoom = min(device.maxAvailableVideoZoomFactor, 10)
    let switches = device.virtualDeviceSwitchOverVideoZoomFactors
      .map { CGFloat(truncating: $0) }
      .filter { $0 > minZoom && $0 <= maxZoom }
    let hasUltraWide = device.constituentDevices.contains { $0.deviceType == .builtInUltraWideCamera }
    let wide = hasUltraWide ? (switches.first ?? minZoom) : minZoom
    let stops = position == .back && !switches.isEmpty
      ? ([minZoom] + switches).map { ZoomStop(label: zoomLabel($0 / wide), factor: $0) }
      : []
    if (try? device.lockForConfiguration()) != nil {
      device.videoZoomFactor = wide
      device.unlockForConfiguration()
    }

    // The preview is pinned upright (portrait-locked app) and mirrored for
    // selfies; the photo connection mirrors too, and is rotated at capture.
    if let connection = videoOutput.connection(with: .video) {
      if connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
      if connection.isVideoMirroringSupported {
        connection.automaticallyAdjustsVideoMirroring = false
        connection.isVideoMirrored = position == .front
      }
    }
    if let connection = photoOutput.connection(with: .video), connection.isVideoMirroringSupported {
      connection.automaticallyAdjustsVideoMirroring = false
      connection.isVideoMirrored = position == .front
    }
    rotation = AVCaptureDevice.RotationCoordinator(device: device, previewLayer: nil)

    let flash = position == .front || photoOutput.supportedFlashModes.contains(.on)
    DispatchQueue.main.async {
      self.position = position
      self.hasFlash = flash
      self.zoomRange = minZoom...max(minZoom, maxZoom)
      self.wideFactor = wide
      self.currentZoom = wide
      self.stops = stops
      self.selectedStop = stops.first(where: { abs($0.factor - wide) < 0.01 })?.label ?? ""
      self.liveZoom = ""
    }
  }

  func flip() {
    DispatchQueue.main.async { self.ready = false }
    sessionQueue.async {
      let next: AVCaptureDevice.Position = self.activePosition == .back ? .front : .back
      self.configure(position: next)
      let running = self.session.isRunning
      DispatchQueue.main.async { self.ready = running && self.input != nil }
    }
  }

  // MARK: Zoom

  func beginZoom() {
    zoomStart = currentZoom
  }

  /// Pinch: `scale` is relative to where the pinch began. The stops step
  /// aside for one lit pill with the live zoom, as the system camera does.
  func zoom(_ scale: CGFloat) {
    let factor = min(zoomRange.upperBound, max(zoomRange.lowerBound, zoomStart * scale))
    apply(factor)
    let text = zoomLabel(factor / wideFactor)
    if selectedStop != "" { selectedStop = "" }
    if liveZoom != text { liveZoom = text }
  }

  /// A tap on a lens stop.
  func select(_ stop: ZoomStop) {
    apply(stop.factor)
    liveZoom = ""
    selectedStop = stop.label
  }

  /// A tap on the live pill: back to 1× and the stops.
  func resetZoom() {
    apply(wideFactor)
    liveZoom = ""
    selectedStop = stops.first(where: { abs($0.factor - wideFactor) < 0.01 })?.label ?? ""
  }

  private func apply(_ factor: CGFloat) {
    currentZoom = factor
    guard let device = input?.device else { return }
    sessionQueue.async {
      let clamped = max(device.minAvailableVideoZoomFactor, min(factor, device.maxAvailableVideoZoomFactor))
      guard (try? device.lockForConfiguration()) != nil else { return }
      device.videoZoomFactor = clamped
      device.unlockForConfiguration()
    }
  }

  // MARK: Frames

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    viewfinder.draw(pixelBuffer)
  }

  // MARK: Capture

  /// Take one photo. `flash` uses the LED on the back camera; the front
  /// camera's flash is the white screen the caller draws before calling this.
  /// Completes on the main queue with the encoded photo.
  func capture(flash: Bool, completion: @escaping (Result<Data, Error>) -> Void) {
    sessionQueue.async {
      let settings: AVCapturePhotoSettings
      if self.photoOutput.availablePhotoCodecTypes.contains(.jpeg) {
        settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
      } else {
        settings = AVCapturePhotoSettings()
      }
      settings.maxPhotoDimensions = self.photoOutput.maxPhotoDimensions
      settings.photoQualityPrioritization = .quality
      if flash, self.activePosition == .back, self.photoOutput.supportedFlashModes.contains(.on) {
        settings.flashMode = .on
      }
      if let connection = self.photoOutput.connection(with: .video), let rotation = self.rotation {
        let angle = rotation.videoRotationAngleForHorizonLevelCapture
        if connection.isVideoRotationAngleSupported(angle) { connection.videoRotationAngle = angle }
      }

      let id = settings.uniqueID
      let delegate = PhotoDelegate { [weak self] result in
        self?.sessionQueue.async { self?.pending[id] = nil }
        DispatchQueue.main.async { completion(result) }
      }
      self.pending[id] = delegate
      self.photoOutput.capturePhoto(with: settings, delegate: delegate)
    }
  }
}

private final class PhotoDelegate: NSObject, AVCapturePhotoCaptureDelegate {
  private let done: (Result<Data, Error>) -> Void

  init(done: @escaping (Result<Data, Error>) -> Void) {
    self.done = done
  }

  func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
    if let error { done(.failure(error)); return }
    guard let data = photo.fileDataRepresentation() else {
      done(.failure(DevelopError.unreadable))
      return
    }
    done(.success(data))
  }
}

/// The viewfinder in SwiftUI. Pinch zooms.
struct ViewfinderRepresentable: UIViewRepresentable {
  let camera: CameraController

  func makeUIView(context: Context) -> ViewfinderView {
    let view = camera.viewfinder
    let pinch = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pinch(_:)))
    view.addGestureRecognizer(pinch)
    return view
  }

  func updateUIView(_ uiView: ViewfinderView, context: Context) {}

  func makeCoordinator() -> Coordinator { Coordinator(camera: camera) }

  final class Coordinator: NSObject {
    let camera: CameraController
    init(camera: CameraController) { self.camera = camera }

    @objc func pinch(_ gesture: UIPinchGestureRecognizer) {
      switch gesture.state {
      case .began: camera.beginZoom()
      case .changed: camera.zoom(gesture.scale)
      default: break
      }
    }
  }
}
