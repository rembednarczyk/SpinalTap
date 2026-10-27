/**
 * Minimal WebAudio fake for unit tests: records node creation, connections, starts/stops and
 * parameter automation. Only what SynthAudio uses; mimics the real API's RangeErrors.
 */
export type ParamEvent = readonly [method: string, value: number, time: number];

export class FakeParam {
  readonly events: ParamEvent[] = [];
  constructor(public value = 0) {}
  private log(method: string, value: number, time: number) {
    if (!Number.isFinite(value) || !Number.isFinite(time)) throw new TypeError(`${method}: non-finite`);
    this.events.push([method, value, time]);
    return this;
  }
  setValueAtTime(v: number, t: number) {
    return this.log("set", v, t);
  }
  linearRampToValueAtTime(v: number, t: number) {
    return this.log("linear", v, t);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (v <= 0) throw new RangeError("exponential ramp to a non-positive value");
    return this.log("exp", v, t);
  }
  setTargetAtTime(v: number, t: number, tc: number) {
    if (tc <= 0) throw new RangeError("time constant must be positive");
    return this.log("target", v, t);
  }
  cancelScheduledValues(t: number) {
    return this.log("cancel", 0, t);
  }
  cancelAndHoldAtTime(t: number) {
    return this.log("hold", 0, t);
  }
  /** Value of the last setTargetAtTime, i.e. where the parameter is heading. */
  get target(): number | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) if (this.events[i]![0] === "target") return this.events[i]![1];
    return undefined;
  }
}

export class FakeNode {
  readonly outputs: FakeNode[] = [];
  readonly params: Record<string, FakeParam> = {};
  constructor(
    readonly ctx: FakeAudioContext,
    readonly kind: string,
  ) {
    ctx.created.push(this);
  }
  connect<T>(n: T): T {
    if (!(n instanceof FakeNode) && !(n instanceof FakeParam)) throw new TypeError("connect: not a node");
    if (n instanceof FakeNode) this.outputs.push(n);
    return n;
  }
  disconnect() {
    this.outputs.length = 0;
  }
  protected param(name: string, value: number): FakeParam {
    const p = new FakeParam(value);
    this.params[name] = p;
    return p;
  }
}

class FakeGain extends FakeNode {
  readonly gain = this.param("gain", 1);
}

class FakeSource extends FakeNode {
  started: number | null = null;
  stopped: number | null = null;
  onended: (() => void) | null = null;
  start(when = 0) {
    if (this.started !== null) throw new Error("InvalidStateError: start twice");
    this.started = when;
  }
  stop(when = 0) {
    if (this.started === null) throw new Error("InvalidStateError: stop before start");
    this.stopped = when;
  }
}

class FakeOscillator extends FakeSource {
  type = "sine";
  readonly frequency = this.param("frequency", 440);
  readonly detune = this.param("detune", 0);
}

class FakeBufferSource extends FakeSource {
  buffer: unknown = null;
  loop = false;
  readonly playbackRate = this.param("playbackRate", 1);
}

class FakeBiquad extends FakeNode {
  type = "lowpass";
  readonly frequency = this.param("frequency", 350);
  readonly Q = this.param("Q", 1);
}

class FakePanner extends FakeNode {
  readonly pan = this.param("pan", 0);
}

class FakeCompressor extends FakeNode {
  readonly threshold = this.param("threshold", -24);
  readonly knee = this.param("knee", 30);
  readonly ratio = this.param("ratio", 12);
  readonly attack = this.param("attack", 0.003);
  readonly release = this.param("release", 0.25);
}

class FakeDelay extends FakeNode {
  readonly delayTime = this.param("delayTime", 0);
}

export class FakeAudioContext {
  readonly created: FakeNode[] = [];
  currentTime = 0;
  sampleRate = 8000;
  state: "suspended" | "running" | "closed" = "suspended";
  resumeCalls = 0;
  rejectResume = false;
  readonly destination = new FakeNode(this, "destination");

  resume(): Promise<void> {
    this.resumeCalls++;
    if (this.rejectResume) return Promise.reject(new Error("NotAllowedError"));
    this.state = "running";
    return Promise.resolve();
  }
  createGain() {
    return new FakeGain(this, "gain");
  }
  createOscillator() {
    return new FakeOscillator(this, "oscillator");
  }
  createBufferSource() {
    return new FakeBufferSource(this, "buffer-source");
  }
  createBiquadFilter() {
    return new FakeBiquad(this, "biquad");
  }
  createStereoPanner() {
    return new FakePanner(this, "panner");
  }
  createDynamicsCompressor() {
    return new FakeCompressor(this, "compressor");
  }
  createDelay() {
    return new FakeDelay(this, "delay");
  }
  createConvolver() {
    return Object.assign(new FakeNode(this, "convolver"), { buffer: null as unknown });
  }
  createWaveShaper() {
    return Object.assign(new FakeNode(this, "waveshaper"), { curve: null as unknown });
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: (ch: number) => data[ch]! };
  }
  /** Bytes that fail to decode (unsupported codec, corrupt file). */
  readonly undecodable = new Set<ArrayBuffer>();
  decodeCalls = 0;
  /** Decodes to a silent buffer whose length (in samples) is the byte length of the input. */
  decodeAudioData(bytes: ArrayBuffer): Promise<ReturnType<FakeAudioContext["createBuffer"]>> {
    this.decodeCalls++;
    if (this.undecodable.has(bytes)) return Promise.reject(new Error("EncodingError"));
    return Promise.resolve(this.createBuffer(1, Math.max(1, bytes.byteLength), this.sampleRate));
  }

  count(kind: string): number {
    return this.created.filter((n) => n.kind === kind).length;
  }
  sources(): FakeSource[] {
    return this.created.filter((n): n is FakeSource => n instanceof FakeSource);
  }
  asContext(): AudioContext {
    return this as unknown as AudioContext;
  }
}

/** Manual timer so tests drive the scheduler explicitly. */
export class ManualTimer {
  fn: (() => void) | null = null;
  cleared = 0;
  readonly setInterval = (fn: () => void) => {
    this.fn = fn;
    return 1;
  };
  readonly clearInterval = () => {
    this.fn = null;
    this.cleared++;
  };
}
