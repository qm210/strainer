const saw = param => phase => (2 * (phase % 1) - 1);
const detune = param => osc => phase => !param.spread ? osc(phase) : .33 * osc(phase) + .33 * osc(phase*(1+.05*param.spread)) + .33 * osc(phase*(1-.1*param.spread));
const square = param => phase => (phase % 1) > (param.pw || .5) ? 1 : -1;

class CheapSynth extends AudioWorkletProcessor {

    static get parameterDescriptors() {
        return [{
                name: 'decay',
                defaultValue: .25,
                minValue: 0.01,
                maxValue: 1,
            }, {
                name: 'pw',
                defaultValue: .75,
                minValue: 0.5,
                maxValue: 0.99,
            }, {
                name: 'phaseDrop',
                defaultValue: 0,
                minValue: 0,
                maxValue: 10,
            }, {
                name: 'shape',
                defaultValue: 1,
                minValue: 0,
                maxValue: 2,
            }, {
                name: 'detune',
                defaultValue: 0,
                minValue: 0,
                maxValue: 1,
            },
        ];
    }

    constructor() {
        super();
        this.port.onmessage = this.handleMessage.bind(this);
        this.voice = Array(4).fill({
            phase: 0,
            timeZero: null,
            freq: 0,
            vel: 0,
        });
        this.voiceIndex = 0;
        this.osc = null;
        this.env = (time, param) => !param ? 1 : Math.exp(-time/param.decay);
    }

    velocityFunc = vel => vel*vel;

    handleMessage(event) {
        const {data} = event;
        switch (data.type) {
            case "noteon":
                const alreadyVoiceIndex = this.voice.findIndex(it => it.freq === data.freq);
                const voiceIndex = alreadyVoiceIndex === -1 ? this.voiceIndex : alreadyVoiceIndex;
                this.voice[voiceIndex] = ({
                    ...this.voice[voiceIndex],
                    timeZero: currentTime,
                    phase: 0,
                    freq: data.freq,
                    vel: this.velocityFunc(data.vel)
                });
                this.voiceIndex = (voiceIndex + 1) % this.voice.length;
                break;

            default:
                break;
        }
    }

    process(inputList, outputList, parameters) {
        const envDecay = parameters.decay[0];
        const phaseDrop = parameters.phaseDrop[0];
        const pw = parameters.pw[0];
        const shape = parameters.shape[0];
        const spread = parameters.detune[0];

        const output = outputList[0];
        for (let i=0; i < output[0].length; i++) {
            for (const voice of this.voice) {
                if (voice.timeZero === null) {
                    continue;
                }
                const noteTime = currentTime - voice.timeZero;
                const baseOsc = ({pw}) =>
                    shape < 1
                        ? phase => ((1-shape) * saw()(phase) + shape * saw()(Math.pow(phase, pw*(pw-.2)*(pw-.3)*(pw-.4))))
                        : phase => ((2 - shape) * saw()(phase) + (shape - 1) * square({pw})(phase));
                const osc = phase => detune({spread})(baseOsc({pw}))(phase * (1 + phaseDrop * this.env(noteTime, {decay: 0.1})));
                voice.phase = (voice.phase + voice.freq/sampleRate) % 1;
                let synthOut = osc(voice.phase);
                output[0][i] += synthOut * voice.vel * this.env(noteTime, {decay: envDecay});

//                output[1][i] = i < 10 ? 0 : output[0][i - 10];
            }
        }
        return true;
    }

};

class CheapCrush extends AudioWorkletProcessor {

    static get parameterDescriptors() {
        return [{
            name: 'quant',
            defaultValue: 1,
            minValue: 1,
            maxValue: 128,
        }];
    }

    process(inputList, outputList, parameters) {
        const quant = Math.round(+parameters.quant[0]);
        for (let o = 0; o < inputList.length; o++) {
            for (let ch = 0; ch < inputList[o].length; ch++) {
                for (let sample = 0; sample < inputList[o][ch].length; sample+=quant) {
                    for(let q = 0; q < quant; q++) {
                        outputList[o][ch][sample + q] = inputList[o][ch][sample];
                    }
                }
            }
        }
        return true;
    }

}

class CheapFilter extends AudioWorkletProcessor {

    static get parameterDescriptors() {
        return [{
            name: 'lowpass',
            defaultValue: 10000,
            minValue: 0,
            maxValue: 20000,
        }, {
            name: 'hipass',
            defaultValue: 10000,
            minValue: 0,
            maxValue: 20000,
        }, {
            name: 'saturate',
            defaultValue: 1,
            minValue: 0.01,
            maxValue: 10,
        }];
    }

    constructor() {
        super();
        this.updateLPCoeffs(10000);
        this.updateHPCoeffs(10000);
    }

    updateLPCoeffs(freq) {
        this.b1 = Math.exp(-2 * Math.PI * freq/sampleRate);
        this.a0 = 1 - this.b1;
        this.z1 = 0;
    }

    updateHPCoeffs(freq) {
        this.hp_b1 = Math.exp(-2 * Math.PI * freq/sampleRate);
        this.hp_a0 = 1 - this.hp_b1;
        this.hp_z1 = 0;
    }

    saturate = (value, gain) => 2/Math.PI * Math.atan(gain * value);

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (input.length === 0) {
            return true;
        }

        const LPcutoff = parameters.lowpass;
        const LPcutoffConst = LPcutoff.length === 1;
        const HPcutoff = parameters.hipass;
        const HPcutoffConst = LPcutoff.length === 1;
        const gain = parameters.saturate[0];

        for (let channel = 0; channel < output.length; channel++) {
            if (LPcutoffConst) {
                this.updateLPCoeffs(LPcutoff[0]);
            }
            if (HPcutoffConst) {
                this.updateHPCoeffs(HPcutoff[0]);
            }
            for (let i=0; i < output[channel].length; i++) {
                const inputValue = this.saturate(input[channel][i], gain);
                if (!LPcutoffConst) {
                    this.updateLPCoeffs(LPcutoff[i]);
                }
                if (!HPcutoffConst) {
                    this.updateHPCoeffs(HPcutoff[i]);
                }
                this.z1 = inputValue * this.a0 + this.z1 * this.b1;
                this.hp_z1 = this.z1 - (this.z1 * this.hp_a0 + this.hp_z1 * this.hp_b1);
                output[channel][i] = this.hp_z1;
            }
        }
        return true;
    }

}

export default class CheapReverb extends AudioWorkletProcessor {

// steal: https://github.com/Rishikeshdaoo/Reverberator/blob/master/Reverberator/src/com/rishi/reverb/Reverberation.java

    static get parameterDescriptors() {
        return [{
            name: 'delayMs',
            defaultValue: 12,
            minValue: 1,
            maxValue: 1000,
        }, {
            name: 'mix',
            defaultValue: .5,
            minValue: 0,
            maxValue: 1,
        }, {
            name: 'decayFactor',
            defaultValue: 0.4,
            minValue: 0.311,
            maxValue: 0.999,
        }];
    }

    constructor(options) {
        super();
        this.kernelBufferSize = options.processorOptions && options.processorOptions.kernelBufferSize || 1024;
        this.channelCount =  options.processorOptions && options.processorOptions.channelCount || 1;
        this.inputRingBuffer = new RingBuffer(this.kernelBufferSize, this.channelCount);
        this.outputRingBuffer = new RingBuffer(this.kernelBufferSize, this.channelCount);
    }

    process(inputList, outputList, parameters) {
        const input = inputList[0];
        const output = outputList[0];
        const param = {
            delayMs: parameters.delayMs[0],
            decayFactor: parameters.decayFactor[0],
            mix: parameters.mix[0],
        };
        this.inputRingBuffer.push(input);

        if (this.inputRingBuffer.framesAvailable >= this.kernelBufferSize) {
            const bufferData = new Array(this.kernelBufferSize);
            this.inputRingBuffer.pull(bufferData);
            this.outputRingBuffer.push(this.actuallyProcess(bufferData, param));
        }

        this.outputRingBuffer.pull(output);
        return true;
    }

    actuallyProcess(buffer, param) {
        const comb1 = this.combFilter(buffer, param.delayMs, param.decayFactor);
        const comb2 = this.combFilter(buffer, param.delayMs - 11.73, param.decayFactor - 0.1313);
        const comb3 = this.combFilter(buffer, param.delayMs + 19.31, param.decayFactor - 0.2743);
        const comb4 = this.combFilter(buffer, param.delayMs - 7.97, param.decayFactor - 0.31);

        let out = [];
        for (let i = 0; i < buffer.length; i++) {
            out[i] = (1 - param.mix) * buffer[i] + param.mix * (comb1[i] + comb2[i] + comb3[i] + comb4[i]);
        }

        out = this.allpassFilter(out, 89.27, 0.131);
        out = this.allpassFilter(out, 89.27, 0.131);
        return out;
    }

    msToSamples = ms => Math.round(ms/1000 * sampleRate);

    combFilter(buffer, delayMs, decayFactor) {
        const delaySamples = this.msToSamples(delayMs)

        let processed = [...buffer];
        for (let i = 0; i < buffer.length - delaySamples; i++) {
            processed[i + delaySamples] += processed[i] * decayFactor;
        }

        return processed;
    }

    allpassFilter(buffer, delayMs, decayFactor) {
        const delaySamples = this.msToSamples(delayMs);
        let processed = [...buffer];

        for (let i = 0; i < buffer.length; i++) {
            if (i - delaySamples >= 0) {
                processed[i] += -decayFactor * processed[i - delaySamples];
            }
            if (i + 20 - delaySamples >= 1) {
                processed[i] += decayFactor * processed[i + 20 - delaySamples];
            }
        }

        const max = Math.max(Math.max(...processed), -Math.min(...processed));
        if (max !== 0) {
            for (let i = 0; i < buffer.length; i++) {
                processed[i] = processed[i] / max;
            }
        }
        return processed;
    }

}

registerProcessor("cheap-synth", CheapSynth);
registerProcessor("cheap-crush", CheapCrush);
registerProcessor("cheap-filter", CheapFilter);
registerProcessor("cheap-reverb", CheapReverb);

class RingBuffer {
    /**
     * @constructor
     * @param  {number} length Buffer length in frames.
     * @param  {number} channelCount Buffer channel count.
     */
    constructor(length, channelCount) {
      this._readIndex = 0;
      this._writeIndex = 0;
      this._framesAvailable = 0;

      this._channelCount = channelCount;
      this._length = length;
      this._channelData = [];
      for (let i = 0; i < this._channelCount; ++i) {
        this._channelData[i] = new Float32Array(length);
      }
    }

    /**
     * Getter for Available frames in buffer.
     *
     * @return {number} Available frames in buffer.
     */
    get framesAvailable() {
      return this._framesAvailable;
    }

    /**
     * Push a sequence of Float32Arrays to buffer.
     *
     * @param  {array} arraySequence A sequence of Float32Arrays.
     */
    push(arraySequence) {
      // The channel count of arraySequence and the length of each channel must
      // match with this buffer obejct.

      // Transfer data from the |arraySequence| storage to the internal buffer.
      let sourceLength = arraySequence[0].length;
      for (let i = 0; i < sourceLength; ++i) {
        let writeIndex = (this._writeIndex + i) % this._length;
        for (let channel = 0; channel < this._channelCount; ++channel) {
          this._channelData[channel][writeIndex] = arraySequence[channel][i];
        }
      }

      this._writeIndex += sourceLength;
      if (this._writeIndex >= this._length) {
        this._writeIndex = 0;
      }

      // For excessive frames, the buffer will be overwritten.
      this._framesAvailable += sourceLength;
      if (this._framesAvailable > this._length) {
        this._framesAvailable = this._length;
      }
    }

    /**
     * Pull data out of buffer and fill a given sequence of Float32Arrays.
     *
     * @param  {array} arraySequence An array of Float32Arrays.
     */
    pull(arraySequence) {
      // The channel count of arraySequence and the length of each channel must
      // match with this buffer obejct.

      // If the FIFO is completely empty, do nothing.
      if (this._framesAvailable === 0) {
        return;
      }

      let destinationLength = arraySequence[0].length;

      // Transfer data from the internal buffer to the |arraySequence| storage.
      for (let i = 0; i < destinationLength; ++i) {
        let readIndex = (this._readIndex + i) % this._length;
        for (let channel = 0; channel < this._channelCount; ++channel) {
          arraySequence[channel][i] = this._channelData[channel][readIndex];
        }
      }

      this._readIndex += destinationLength;
      if (this._readIndex >= this._length) {
        this._readIndex = 0;
      }

      this._framesAvailable -= destinationLength;
      if (this._framesAvailable < 0) {
        this._framesAvailable = 0;
      }
    }
} // class RingBuffer
