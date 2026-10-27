// lib/face-recognition.ts
// Client-side FaceNet-style embedding extractor and cosine similarity engine
// Uses @vladmandic/face-api (TensorFlow.js FaceNet 128-dimensional embeddings)

let faceapiInstance: any = null
let modelsLoaded = false
let loadingPromise: Promise<boolean> | null = null

export async function getFaceApi(): Promise<any> {
  if (typeof window === "undefined") return null
  if (faceapiInstance) return faceapiInstance

  try {
    // Dynamic import to avoid SSR evaluation issues
    const api = await import("@vladmandic/face-api")
    faceapiInstance = api
    return faceapiInstance
  } catch (error) {
    console.error("Failed to load face-api library:", error)
    return null
  }
}

/**
 * Load the FaceNet and TinyFaceDetector models from /models
 */
export async function loadFaceRecognitionModels(): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (modelsLoaded) return true
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      const faceapi = await getFaceApi()
      if (!faceapi) return false

      const MODEL_URL = "/models"

      // Load Tiny Face Detector, 68-point landmarks, and FaceNet Recognition models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])

      modelsLoaded = true
      return true
    } catch (error) {
      console.error("Failed to load face recognition models:", error)
      modelsLoaded = false
      return false
    } finally {
      loadingPromise = null
    }
  })()

  return loadingPromise
}

/**
 * Extract 128-d FaceNet embedding from an image, canvas, or video element
 */
export async function extractFaceEmbedding(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<number[] | null> {
  if (typeof window === "undefined") return null

  const isReady = await loadFaceRecognitionModels()
  if (!isReady) {
    console.warn("Face recognition models not ready")
    return null
  }

  const faceapi = await getFaceApi()
  if (!faceapi) return null

  try {
    // Use TinyFaceDetector with score threshold 0.5
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5,
    })

    const detection = await faceapi
      .detectSingleFace(input, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor()

    if (!detection || !detection.descriptor) {
      return null
    }

    // Convert Float32Array to standard number array for serialization
    return Array.from(detection.descriptor)
  } catch (err) {
    console.error("Face embedding extraction error:", err)
    return null
  }
}

/**
 * Extract 128-d FaceNet embedding from a base64 Data URI string
 */
export async function extractFaceEmbeddingFromDataUrl(dataUrl: string): Promise<number[] | null> {
  if (typeof window === "undefined" || !dataUrl) return null

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = async () => {
      try {
        const embedding = await extractFaceEmbedding(img)
        resolve(embedding)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => {
      resolve(null)
    }
    img.src = dataUrl
  })
}

/**
 * Calculate Cosine Similarity between two 128-dimensional FaceNet vectors
 * Returns value between -1 and 1 (1 = identical match)
 */
export function calculateCosineSimilarity(emb1: number[], emb2: number[]): number {
  if (!emb1 || !emb2 || emb1.length !== emb2.length || emb1.length === 0) {
    return 0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < emb1.length; i++) {
    dotProduct += emb1[i] * emb2[i]
    normA += emb1[i] * emb1[i]
    normB += emb2[i] * emb2[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

/**
 * Calculate Euclidean Distance between two 128-dimensional FaceNet vectors
 * Standard metric used by face-api.js and FaceNet (Schroff et al.)
 */
export function calculateEuclideanDistance(emb1: number[], emb2: number[]): number {
  if (!emb1 || !emb2 || emb1.length !== emb2.length || emb1.length === 0) {
    return 1.0
  }

  let sum = 0
  for (let i = 0; i < emb1.length; i++) {
    const diff = emb1[i] - emb2[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/**
 * Compare two face embeddings and determine if they match
 * FaceNet / face-api.js biometric standard uses Euclidean Distance.
 * For L2-normalized 128-d FaceNet descriptors:
 * - Distance <= 0.45: High-confidence identical match (same person)
 * - Distance 0.45 - 0.48: Strict match boundary
 * - Distance > 0.48: Different person (mismatch / buddy punching attempt)
 */
export function verifyFaceMatch(
  liveEmbedding: number[] | null,
  registeredEmbedding: number[] | null,
  distanceThreshold = 0.48
): {
  matched: boolean
  distance: number
  similarity: number
  score: number // calibrated confidence percentage 0 - 100
  reason?: string
} {
  if (!liveEmbedding) {
    return { matched: false, distance: 1.0, similarity: 0, score: 0, reason: "No face detected in live camera frame" }
  }
  if (!registeredEmbedding) {
    return { matched: false, distance: 1.0, similarity: 0, score: 0, reason: "No registered face profile found" }
  }

  const distance = calculateEuclideanDistance(liveEmbedding, registeredEmbedding)
  const similarity = calculateCosineSimilarity(liveEmbedding, registeredEmbedding)

  // Calibrated biometric confidence:
  // Distance 0.0 -> 100%
  // Distance 0.25 -> 84%
  // Distance 0.48 -> 70% (minimum required to pass)
  // Distance > 0.48 -> Below 70% (fails verification)
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        distance <= distanceThreshold
          ? 100 - (distance / distanceThreshold) * 30
          : Math.max(0, 70 - ((distance - distanceThreshold) / 0.25) * 60)
      )
    )
  )

  const matched = distance <= distanceThreshold

  return {
    matched,
    distance,
    similarity,
    score,
    reason: matched
      ? `Face verified with ${score}% match confidence`
      : `Face does not match registered profile (${score}% match - must be at least 70%)`,
  }
}

