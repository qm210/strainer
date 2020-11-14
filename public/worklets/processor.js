class MyFirstNoiser extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputList, outputList, parameters) {
        for (let o = 0; o < outputList; o++) {
            for (let ch = 0; ch < outputList[o].length; ch++) {
                for (let sample = 0; sample < outputList[o][ch].length; sample++) {
                    outputList[o][ch][sample] = Math.random() * 2 - 1;
                }
            }
        }
        return true;
    }
}

registerProcessor("my-nice-noiser", MyFirstNoiser);