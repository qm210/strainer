class MyFirstNoiser extends AudioWorkletProcessor {

    constructor() {
        super();
        this.N = 2;
    }

    process(inputList, outputList, parameters) {
        for (let o = 0; o < inputList.length; o++) {
            for (let ch = 0; ch < inputList[o].length; ch++) {
                for (let sample = 0; sample < inputList[o][ch].length; sample++) {
                    outputList[o][ch][sample] = inputList[o][ch][sample];
                    for (let k = 0; k < this.N; k++) {
                        if (sample + k >= inputList[o][ch].length) {
                            continue;
                        }
                        outputList[o][ch][sample] += 1/this.N * inputList[o][ch][sample+k];
                    }
                }
            }
        }
        return true;
    }

}

registerProcessor("my-nice-noiser", MyFirstNoiser);