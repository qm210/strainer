const saw = param => phase => (2 * (phase % 1) - 1);
const detune = param => osc => phase => !param.spread ? osc(phase) : .33 * osc(phase) + .33 * osc(phase*(1+.05*param.spread)) + .33 * osc(phase*(1-.1*param.spread));
const square = param => phase => (phase % 1) > (param.pw || .5) ? 1 : -1;


export default class CheapSynth extends AudioWorkletProcessor {

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