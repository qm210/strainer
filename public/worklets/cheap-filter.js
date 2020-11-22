export default class CheapFilter extends AudioWorkletProcessor {

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