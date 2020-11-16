class CheapSynth extends AudioWorkletProcessor {

    constructor() {
        super();
        this.freq = 0;
        this.port.onmessage = this.handleMessage.bind(this);
        this.timeZero = currentTime;
        console.log("time zero is", this.timeZero);
    }

    handleMessage(event) {
        console.log("lel we got...", event);
    }

    process(inputList, outputList, parameters) {
        if (currentTime - this.timeZero > 1.0) {
            this.port.postMessage({
              message: '1 second passed.',
            });
            this.timeZero = currentTime;
          }
        return true;
    }

};

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