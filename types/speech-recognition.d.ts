// Minimal Web Speech API type declarations — not yet universally included in TypeScript DOM lib

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onend:    ((this: SpeechRecognition, ev: Event)                        => unknown) | null
  onerror:  ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent)  => unknown) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent)       => unknown) | null
  onstart:  ((this: SpeechRecognition, ev: Event)                        => unknown) | null
  abort(): void
  start(): void
  stop(): void
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition
  new(): SpeechRecognition
}
