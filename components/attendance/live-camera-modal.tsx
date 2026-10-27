"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Camera,
  CameraOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  ScanFace,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AttendanceActionType } from "@/lib/attendance"
import {
  loadFaceRecognitionModels,
  extractFaceEmbedding,
  extractFaceEmbeddingFromDataUrl,
  verifyFaceMatch,
} from "@/lib/face-recognition"

interface LiveClockCameraModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionType: AttendanceActionType
  employeeName: string
  registeredProfileImage?: string | null
  registeredFaceEmbedding?: string | number[] | null
  onCaptureAndConfirm: (
    photoBase64: string | null,
    matchScore?: number | null,
    faceVerified?: boolean
  ) => Promise<void> | void
  isSubmitting?: boolean
}

export function LiveClockCameraModal({
  open,
  onOpenChange,
  actionType,
  employeeName,
  registeredProfileImage,
  registeredFaceEmbedding,
  onCaptureAndConfirm,
  isSubmitting = false,
}: LiveClockCameraModalProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = React.useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = React.useState<string | null>(null)
  const [capturedPhoto, setCapturedPhoto] = React.useState<string | null>(null)
  const [isFlashing, setIsFlashing] = React.useState<boolean>(false)
  const isVerifiedRef = React.useRef<boolean>(false)

  // Face recognition states
  const [modelReady, setModelReady] = React.useState<boolean>(false)
  const [targetEmbedding, setTargetEmbedding] = React.useState<number[] | null>(null)
  const [faceStatus, setFaceStatus] = React.useState<
    "idle" | "searching" | "detected" | "matched" | "mismatch" | "submitting"
  >("idle")
  const [matchScore, setMatchScore] = React.useState<number | null>(null)
  const [isScanningNow, setIsScanningNow] = React.useState<boolean>(false)
  const [statusMessage, setStatusMessage] = React.useState<string>(
    "Initializing biometric face verification..."
  )

  const isClockIn = actionType === "clock_in"
  const isClockOut = actionType === "clock_out"
  const actionTitle = isClockIn
    ? "Clock In Face Verification"
    : isClockOut
      ? "Clock Out Face Verification"
      : actionType === "break_start"
        ? "Start Break Verification"
        : "End Break Verification"

  const actionVerb = isClockIn
    ? "Clock In"
    : isClockOut
      ? "Clock Out"
      : actionType === "break_start"
        ? "Start Break"
        : "End Break"

  const hasRegisteredPhoto = Boolean(registeredProfileImage || registeredFaceEmbedding)

  // 1. Resolve registered face embedding vector
  React.useEffect(() => {
    if (!open) return

    let resolved = false

    if (registeredFaceEmbedding) {
      if (Array.isArray(registeredFaceEmbedding)) {
        setTargetEmbedding(registeredFaceEmbedding)
        resolved = true
      } else if (typeof registeredFaceEmbedding === "string") {
        try {
          const parsed = JSON.parse(registeredFaceEmbedding)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTargetEmbedding(parsed)
            resolved = true
          }
        } catch {
          // ignore json parse error
        }
      }
    }

    // If no embedding stored but registered photo exists, extract reference embedding on the fly
    if (!resolved && registeredProfileImage) {
      extractFaceEmbeddingFromDataUrl(registeredProfileImage).then((emb) => {
        if (emb) {
          setTargetEmbedding(emb)
        }
      })
    }
  }, [open, registeredFaceEmbedding, registeredProfileImage])

  // 2. Start webcam stream and load FaceNet models
  const startCamera = React.useCallback(async () => {
    isVerifiedRef.current = false
    setCameraError(null)
    setCapturedPhoto(null)

    if (!hasRegisteredPhoto) {
      setCameraError("No registered photo found. Please have your manager upload a profile photo before clocking in.")
      setFaceStatus("idle")
      return
    }

    setFaceStatus("searching")
    setStatusMessage("Position your face inside the circle...")

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser.")
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play().catch(() => {})
      }

      // Pre-load TensorFlow.js FaceNet models
      loadFaceRecognitionModels().then((ready) => {
        setModelReady(ready)
        if (ready) {
          setStatusMessage("FaceNet model active. Aligning face...")
        }
      })
    } catch (err: any) {
      console.warn("Live camera access issue:", err)
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Please allow camera access in browser settings.")
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera device found on this system.")
      } else {
        setCameraError(err.message || "Unable to access camera.")
      }
      setFaceStatus("idle")
    }
  }, [])

  // Stop stream
  const stopCamera = React.useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }, [stream])

  React.useEffect(() => {
    if (open) {
      startCamera()
    } else {
      stopCamera()
      setCapturedPhoto(null)
      setCameraError(null)
      setFaceStatus("idle")
      setMatchScore(null)
    }

    return () => {
      stopCamera()
    }
  }, [open])

  // Attach stream to video ref if available
  React.useEffect(() => {
    if (stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream])

  // Capture photo from video to canvas
  function takeSnapshot(): string | null {
    if (!videoRef.current) return null
    const video = videoRef.current
    const rawW = video.videoWidth || 640
    const rawH = video.videoHeight || 480
    const targetWidth = Math.min(rawW, 480)
    const targetHeight = Math.round(targetWidth * (rawH / rawW))

    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    // Mirror horizontally to match selfie view
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Export as compressed JPEG (~25-35KB)
    return canvas.toDataURL("image/jpeg", 0.75)
  }

  // 3. Real-time FaceNet face scanning & automatic verification loop
  React.useEffect(() => {
    if (!open || !stream || !modelReady || faceStatus === "matched" || faceStatus === "submitting") {
      return
    }

    let isScanning = false
    let scanTimeout: any = null

    async function scanFrame() {
      if (
        !videoRef.current ||
        videoRef.current.readyState < 2 ||
        isScanning ||
        faceStatus === "matched" ||
        faceStatus === "submitting"
      ) {
        scanTimeout = setTimeout(scanFrame, 300)
        return
      }

      isScanning = true

      try {
        const liveEmbedding = await extractFaceEmbedding(videoRef.current)

        if (!liveEmbedding) {
          setFaceStatus("searching")
          setStatusMessage("Position your face inside the circle guide...")
        } else {
          // Face detected! Check against registered embedding
          if (targetEmbedding) {
            const result = verifyFaceMatch(liveEmbedding, targetEmbedding, 0.48)
            setMatchScore(result.score)

            if (result.matched) {
              // SUCCESS MATCH! Trigger automatic clock-in
              isVerifiedRef.current = true
              setFaceStatus("matched")
              setStatusMessage(`✓ Face Verified (${result.score}% Match) — Automatically clocking in...`)
              setIsFlashing(true)

              const snapshot = takeSnapshot()
              setCapturedPhoto(snapshot)

              setTimeout(() => {
                setIsFlashing(false)
              }, 180)

              // Automatic submission with zero manual clicks required!
              setTimeout(async () => {
                setFaceStatus("submitting")
                await onCaptureAndConfirm(snapshot, result.score, true)
              }, 600)

              return // Stop scanning
            } else {
              setFaceStatus("mismatch")
              setStatusMessage(
                `Face mismatch (${result.score}% Match). Looking for ${employeeName}.`
              )
            }
          } else {
            // No registered embedding exists for comparison
            setFaceStatus("detected")
            setStatusMessage("Face detected. Click capture to record attendance.")
          }
        }
      } catch (err) {
        console.warn("Scan frame error:", err)
      } finally {
        isScanning = false
        if (!isVerifiedRef.current) {
          scanTimeout = setTimeout(scanFrame, 280)
        }
      }
    }

    scanTimeout = setTimeout(scanFrame, 400)

    return () => {
      if (scanTimeout) clearTimeout(scanTimeout)
    }
  }, [open, stream, modelReady, targetEmbedding, faceStatus, employeeName, onCaptureAndConfirm])

  // Manual trigger to scan face immediately
  async function handleTriggerScanNow() {
    if (!videoRef.current || isScanningNow || faceStatus === "matched" || faceStatus === "submitting") return
    setIsScanningNow(true)
    setStatusMessage("Analyzing facial biometrics against registered profile...")
    try {
      const liveEmbedding = await extractFaceEmbedding(videoRef.current)
      if (!liveEmbedding) {
        setStatusMessage("No face detected in camera view. Please align face in the circle guide.")
        return
      }

      if (targetEmbedding) {
        const result = verifyFaceMatch(liveEmbedding, targetEmbedding, 0.68)
        setMatchScore(result.score)

        if (result.matched) {
          isVerifiedRef.current = true
          setFaceStatus("matched")
          setStatusMessage(`✓ Face Verified (${result.score}% Match) — Automatically clocking in...`)
          setIsFlashing(true)

          const snapshot = takeSnapshot()
          setCapturedPhoto(snapshot)

          setTimeout(() => {
            setIsFlashing(false)
          }, 180)

          setTimeout(async () => {
            setFaceStatus("submitting")
            await onCaptureAndConfirm(snapshot, result.score, true)
          }, 600)
        } else {
          setFaceStatus("mismatch")
          setStatusMessage(
            `Face does not match registered profile (${result.score}% Match). Buddy punching is strictly blocked.`
          )
        }
      }
    } catch (err) {
      console.warn("Scan face error:", err)
    } finally {
      setIsScanningNow(false)
    }
  }

  function handleRetake() {
    isVerifiedRef.current = false
    setCapturedPhoto(null)
    setFaceStatus("searching")
    setStatusMessage("Position your face inside the circle...")
    if (!stream) {
      startCamera()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 overflow-hidden rounded-2xl">
        <DialogHeader className="text-left">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold font-heading flex items-center gap-2">
              <ScanFace className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              {actionTitle}
            </DialogTitle>
            <Badge
              variant="outline"
              className={cn(
                "text-xs transition-colors",
                !hasRegisteredPhoto
                  ? "border-destructive/40 bg-destructive/10 text-destructive font-semibold"
                  : faceStatus === "matched"
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold"
                  : faceStatus === "mismatch"
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-primary/40 bg-primary/10 text-primary"
              )}
            >
              {!hasRegisteredPhoto
                ? "Photo Required"
                : faceStatus === "matched"
                ? "✓ Face Verified"
                : faceStatus === "mismatch"
                  ? "⚠ Face Mismatch"
                  : modelReady
                    ? "FaceNet Active"
                    : "Loading Model..."}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {!hasRegisteredPhoto ? (
              <span className="text-destructive font-medium">Biometric profile missing. Clocking in/out is strictly blocked.</span>
            ) : (
              <>
                Looking for registered employee: <strong className="text-foreground">{employeeName}</strong>. Automatic
                biometric verification in progress.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Viewfinder / Camera Feed */}
        <div className="relative mt-2 overflow-hidden rounded-2xl bg-zinc-950 aspect-[4/3] flex items-center justify-center border border-border shadow-inner">
          {/* Shutter flash effect */}
          {isFlashing && (
            <div className="absolute inset-0 z-30 bg-white animate-[fadeOut_0.2s_ease-out_forwards]" />
          )}

          {!hasRegisteredPhoto ? (
            <div className="p-6 text-center flex flex-col items-center gap-3 text-zinc-300">
              <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-base font-semibold text-zinc-100">No Registered Photo Found</div>
              <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                No registered photo found. Please have your manager upload a profile photo before clocking in.
              </p>
            </div>
          ) : capturedPhoto && faceStatus !== "matched" && faceStatus !== "submitting" ? (
            <div className="relative w-full h-full">
              <img
                src={capturedPhoto}
                alt="Captured attendance verification"
                className="w-full h-full object-cover rounded-2xl"
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white text-xs">
                <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Live Image Captured
                </span>
                <span className="text-[11px] text-white/70">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            </div>
          ) : cameraError ? (
            <div className="p-6 text-center flex flex-col items-center gap-3 text-zinc-300">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-500">
                <CameraOff className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-zinc-200">Camera Unavailable</div>
              <p className="text-xs text-zinc-400 max-w-xs">{cameraError}</p>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startCamera}
                  className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 text-xs h-8"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Viewfinder Face Guide Overlay with biometric dynamic state */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={cn(
                    "w-48 h-60 rounded-[46%] border-2 transition-all duration-300 flex items-center justify-center relative",
                    faceStatus === "matched"
                      ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_35px_rgba(16,185,129,0.5)] scale-105"
                      : faceStatus === "mismatch"
                        ? "border-amber-400 border-dashed bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                        : faceStatus === "detected"
                          ? "border-emerald-400/80 border-dashed"
                          : "border-dashed border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                  )}
                >
                  {/* Scanning beam animation */}
                  {faceStatus === "searching" && (
                    <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                  )}
                  {faceStatus === "matched" && (
                    <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg animate-in zoom-in-75 duration-200">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </div>

              {/* Live badge overlay */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 text-xs text-white">
                <span className="relative flex h-2 w-2">
                  <span
                    className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      faceStatus === "matched"
                        ? "bg-emerald-400"
                        : faceStatus === "mismatch"
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                    )}
                  ></span>
                  <span
                    className={cn(
                      "relative inline-flex rounded-full h-2 w-2",
                      faceStatus === "matched"
                        ? "bg-emerald-500"
                        : faceStatus === "mismatch"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    )}
                  ></span>
                </span>
                <span className="text-[11px] font-medium tracking-wide uppercase">
                  {faceStatus === "matched"
                    ? "Face Verified"
                    : faceStatus === "mismatch"
                      ? "Mismatch"
                      : "FaceNet Scanner"}
                </span>
              </div>

              {/* Match Score Badge */}
              {matchScore !== null && (
                <div
                  className={cn(
                    "absolute top-3 right-3 backdrop-blur-md px-2.5 py-1 rounded-full border text-[11px] font-semibold flex items-center gap-1",
                    faceStatus === "matched"
                      ? "bg-emerald-500/80 border-emerald-400 text-white"
                      : "bg-amber-500/80 border-amber-400 text-white"
                  )}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {matchScore}% Match
                </div>
              )}

              {/* Dynamic Status prompt bar */}
              <div
                className={cn(
                  "absolute bottom-3 inset-x-3 text-center text-xs py-1.5 px-3 rounded-xl border backdrop-blur-md transition-colors",
                  faceStatus === "matched"
                    ? "bg-emerald-950/80 text-emerald-200 border-emerald-500/40 font-semibold"
                    : faceStatus === "mismatch"
                      ? "bg-amber-950/80 text-amber-200 border-amber-500/40"
                      : "bg-black/70 text-white/90 border-white/10"
                )}
              >
                {statusMessage}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls & Manual Options */}
        <div className="flex flex-col gap-2 mt-4">
          {!hasRegisteredPhoto ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-xl bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
            >
              Close
            </Button>
          ) : faceStatus === "matched" || faceStatus === "submitting" ? (
            <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold text-center flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
              <span>Face verified! Automatically clocking in...</span>
            </div>
          ) : faceStatus === "mismatch" ? (
            <div className="flex flex-col gap-2">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center flex flex-col items-center gap-1.5 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-xs font-bold">Face Mismatch ({matchScore}% Match)</span>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Live face does not match the registered profile for <strong>{employeeName}</strong>. Clocking in on another employee&apos;s behalf is blocked.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleTriggerScanNow}
                  disabled={isScanningNow}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="lg"
                onClick={handleTriggerScanNow}
                disabled={isSubmitting || !stream || isScanningNow}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg text-base h-12 transition-all"
              >
                {isScanningNow ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Scanning Face...
                  </>
                ) : (
                  <>
                    <ScanFace className="w-5 h-5 mr-2" />
                    Verify Face &amp; {actionVerb}
                  </>
                )}
              </Button>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>Employee: {employeeName}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Biometric Match Required</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
