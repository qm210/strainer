import { RingBuffer } from './ringbuffer';

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
        this.kernelBufferSize = options.processorOptions.kernelBufferSize || 1024;
        this.channelCount = options.processorOptions.channelCount || 1;
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