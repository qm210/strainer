const saw = param => phase => (2 * (phase % 1) - 1);
const detune = osc => phase => (0.4 * osc(phase) + .4 * osc(phase*1.01) + .4 * osc(phase*.984));

const phaseZero = Array(2).fill(0);

class CheapSynth extends AudioWorkletProcessor {

    constructor() {
        super();
        this.phase = phaseZero;
        this.port.onmessage = this.handleMessage.bind(this);
        this.timeZero = null;

        this.freq = 0;
        this.vel = 0;
        this.osc = detune(saw());
        this.envDecay = .25;
        this.env = (time) => Math.exp(-time/this.envDecay);
    }

    velocityFunc = vel => vel*vel;

    handleMessage(event) {
        const {data} = event;
        switch (data.type) {
            case "noteon":
                this.timeZero = currentTime;
                this.phase = phaseZero;
                this.freq = data.freq;
                this.vel = this.velocityFunc(data.vel);
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
        if (this.timeZero === null) {
            return true;
        }

        const output = outputList[0];
        for(let ch=0; ch < output.length; ch++) {
            for(let i=0; i < output[ch].length; i++) {
                output[ch][i] = this.osc(this.phase[ch]) * this.vel * this.env(currentTime - this.timeZero);
                this.phase[ch] = (this.phase[ch] + this.freq/sampleRate) % 1;
            }
        }
        return true;
    }

};

class CheapFilter extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [{
            name: 'cutoff',
            defaultValue: 250,
            minValue: 0,
            maxValue: 0.5 * sampleRate,
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

        const cutoff = parameters.cutoff;
        const cutoffConst = cutoff.length === 1;

        for (let channel = 0; channel < output.length; channel++) {
            if (cutoffConst) {
                this.updateCoeffs(cutoff[0]);
            }
            for (let i=0; i < output[channel].length; i++) {
                if (!cutoffConst) {
                    this.updateCoeffs(cutoff[i]);
                    this.z1 = input[channel][i] * this.a0 + this.z1 * this.b1;
                    output[channel][i] = this.z1;
                }
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