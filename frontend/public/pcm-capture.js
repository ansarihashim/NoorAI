// AudioWorkletProcessor: downsamples mic input to 16kHz mono int16 PCM
// and posts ArrayBuffers to the main thread.
//
// Browser delivers float32 frames at the AudioContext sample rate (typically
// 48000 or 44100). We low-pass-ish via simple averaging during decimation,
// which is fine for speech-band STT.
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.targetRate = (options && options.processorOptions && options.processorOptions.targetRate) || 16000
    this.inputRate = sampleRate
    this.ratio = this.inputRate / this.targetRate
    this.acc = 0
    this.acc_sum = 0
    this.acc_n = 0
    this.frameSamples = (this.targetRate * 30) / 1000  // 480 samples per 30ms
    this.outBuf = new Int16Array(this.frameSamples)
    this.outIdx = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel) return true

    for (let i = 0; i < channel.length; i++) {
      this.acc_sum += channel[i]
      this.acc_n += 1
      this.acc += 1
      if (this.acc >= this.ratio) {
        const avg = this.acc_sum / this.acc_n
        const clipped = Math.max(-1, Math.min(1, avg))
        this.outBuf[this.outIdx++] = clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff
        this.acc -= this.ratio
        this.acc_sum = 0
        this.acc_n = 0
        if (this.outIdx >= this.frameSamples) {
          // copy out a fresh buffer so the postMessage transfer doesn't
          // race the next iteration overwriting our scratch buffer.
          const copy = new Int16Array(this.outBuf)
          this.port.postMessage(copy.buffer, [copy.buffer])
          this.outIdx = 0
        }
      }
    }
    return true
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor)
