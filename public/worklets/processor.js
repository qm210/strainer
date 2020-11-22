const saw = param => phase => (2 * (phase % 1) - 1);
const detune = param => osc => phase => !param.spread ? osc(phase) : .33 * osc(phase) + .33 * osc(phase*(1+.1*param.spread)) + .33 * osc(phase*(1-.1*param.spread));
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
            name: 'fmSaw',
            defaultValue: 0,
            minValue: 0,
            maxValue: 100,
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
        }];
    }

    constructor() {
        super();
        this.port.onmessage = this.handleMessage.bind(this);
        this.voice = Array(3).fill({
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
        /*
        if (currentTime - this.timeZero > 1.0) {
            this.port.postMessage({
              message: '1 second passed.',
            });
            this.timeZero = currentTime;
          }
          */
        const envDecay = parameters.decay[0];
        const fmSaw = parameters.fmSaw[0];
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
                const osc = phase => detune({spread})(baseOsc({pw}))(phase * (1 + fmSaw * this.env(noteTime, {decay: 0.1})));
                voice.phase = (voice.phase + voice.freq/sampleRate) % 1;
                output[0][i] += osc(voice.phase) * voice.vel * this.env(noteTime, {decay: envDecay});
//                output[1][i] = i < 10 ? 0 : output[0][i - 10];
            }
        }
        return true;
    }

};

class CheapFilter extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [{
            name: 'cutoff',
            defaultValue: 0.25 * sampleRate,
            minValue: 0,
            maxValue: 0.5 * sampleRate,
        }, {
            name: 'saturate',
            defaultValue: 1,
            minValue: 0.01,
            maxValue: 10,
        }];
    }

    constructor() {
        super();
        this.updateCoeffs(250);
    }

    updateCoeffs(freq) {
        this.b1 = Math.exp(-2 * Math.PI * freq/sampleRate);
        this.a0 = 1 - this.b1;
        this.z1 = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (input.length === 0) {
            return true;
        }

        const cutoff = parameters.cutoff;
        const cutoffConst = cutoff.length === 1;
        const gain = parameters.saturate[0];

        for (let channel = 0; channel < output.length; channel++) {
            if (cutoffConst) {
                this.updateCoeffs(cutoff[0]);
            }
            for (let i=0; i < output[channel].length; i++) {
                const inputValue = input[channel][i];
                const saturatedValue = 2/Math.PI * Math.atan(gain * inputValue);
                if (!cutoffConst) {
                    this.updateCoeffs(cutoff[i]);
                }
                this.z1 = saturatedValue * this.a0 + this.z1 * this.b1;
                output[channel][i] = this.z1;
            }
        }
        return true;
    }
}

class CheapCrush extends AudioWorkletProcessor {

    constructor() {
        super();
        this.N = 2;
    }

    static get parameterDescriptors() {
        return [{
            name: 'quant',
            defaultValue: 1,
            minValue: 1,
            maxValue: 128,
        }];
    }

    process(inputList, outputList, parameters) {
        const quant = Math.round(+parameters["quant"][0]);
        for (let o = 0; o < inputList.length; o++) {
            for (let ch = 0; ch < inputList[o].length; ch++) {
                for (let sample = 0; sample < inputList[o][ch].length; sample+=quant) {
                    for(let q = 0; q < quant; q++) {
                        outputList[o][ch][sample + q] = inputList[o][ch][sample];
                    }

                    /*
                    for (let k = 0; k < this.N; k++) {
                        if (sample + k >= inputList[o][ch].length) {
                            continue;
                        }
                        outputList[o][ch][sample] += 1/this.N * inputList[o][ch][sample+k];
                    }
                    */
                }
            }
        }
        return true;
    }

}

registerProcessor("cheap-synth", CheapSynth);
registerProcessor("cheap-crush", CheapCrush);
registerProcessor("cheap-filter", CheapFilter);