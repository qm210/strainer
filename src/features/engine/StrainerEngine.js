import React from 'react';
import * as Redux from 'react-redux';
import WebMidi from 'webmidi';
import { Header } from 'semantic-ui-react';

const AudioContext = window.AudioContext || window.webkitAudioContext;
const channels = 2;

const noteFreq = (noteNumber) => 440 * Math.pow(2, (noteNumber - 69)/12);

const saw = phase => (2 * (phase % 1) - 1);
const detune = osc => phase => (0.4 * osc(phase) + .4 * osc(phase*1.01) + .4 * osc(phase*.984));
const square = phase => (phase % 1) > .5 ? 1 : -1;

class SimpleSynth {
    constructor(voices = 3) {
        console.log("leeel!", voices);
        this.voices = voices;
        this.voice = [];
        for (let v = 0; v < voices; v++) {
            this.voice.push({
                freq: null,
                vel: null,
                triggeredAt: null,
                osc: detune(square),
                envTime: 0,
                envDecay: .01,
                phase: 0,
            });
        }
        this.voiceIndex = 0;
    }

    advanceIndex() {
        this.voiceIndex = (this.voiceIndex + 1) % this.voices;
        console.log(this.voiceIndex);
    }

    velocityFunction(vel) {
        return Math.pow(vel, 20);
    }

    newNote (ctx, frames, event) {
        console.table(event);
        console.log(this.voice, this.voices);
        const arrayBuffer = ctx.createBuffer(channels, frames, ctx.sampleRate);

        const voice = this.voice[this.voiceIndex];
        voice.freq = noteFreq(event.note.number);
        voice.triggeredAt = event.timestamp
        voice.vel = this.velocityFunction(event.velocity);
        for (let ch = 0; ch < channels; ch++) {
            const nowBuffering = arrayBuffer.getChannelData(ch);
            for (let s = 0; s < frames; s++) {
                const t = s / ctx.sampleRate;
                voice.phase += voice.freq / ctx.sampleRate;
                voice.envTime = t;
                nowBuffering[s] = 0;//this.velocityFunction(event.velocity) * Math.exp(-voice.envTime / voice.envDecay) * voice.osc(voice.phase);
            }
        }
        this.advanceIndex();
        return arrayBuffer;
    }

}

const createSynthProcessor = async (ctx) => {
    if (!ctx) {
        console.log("Well, no context. Whatchudo?");
        return;
    }
    let procNode;
    try {
        await ctx.audioWorklet.addModule("worklets/processor.js");
        procNode = new AudioWorkletNode(ctx, "my-nice-noiser");
    }
    catch (e) {
        console.log("Couldn't get it up!", e);
        return null;
    }
    await ctx.resume();
    return procNode;
}

const Synth = new SimpleSynth();

const StrainerEngine = () => {
    const dispatch = Redux.useDispatch();
    const [audioContext, setAudioContext] = React.useState(null);
    const audioSource = React.useRef();
    const current = Redux.useSelector(store => store.device.current);

    const currentDevice = React.useMemo(() =>
        (current && WebMidi.inputs.find(it => it.id === current.id)) || null
    , [current]);

    React.useEffect(() => {
        if (!audioContext) {
            const ctx = new AudioContext()
            if (ctx.audioWorklet === undefined) {
                alert("AudioWorklet undefined, can't do shit!");
            }
            setAudioContext(ctx);

            //createSynthProcessor(ctx).then(response => console.log(response));
        }
    }, [audioContext, setAudioContext]);

    React.useEffect(() => {
        if (!currentDevice || currentDevice.state !== 'connected') {
            console.log("Can't do shit, current device is...", currentDevice);
            return;
        }

        if(!audioContext) {
            console.log("No Audio Context.")
            return;
        }

        const noteOnListener = event => {
            console.log(event.note);
            audioSource.current = audioContext.createBufferSource();
            audioSource.current.buffer = Synth.newNote(audioContext, .5 * audioContext.sampleRate, event);
            audioSource.current.connect(audioContext.destination);
            audioSource.current.start();
            audioSource.current.onended = () => {
                audioSource.current = null;
                console.log("Audio Source Ended.");
            };
        }

        console.log("Init Event Listeners for ", currentDevice);
        currentDevice.addListener('noteon', 'all', noteOnListener)
        return () => {
            currentDevice.removeListener('noteon', 'all', noteOnListener);
        }
    }, [dispatch, audioContext, currentDevice]);

    return <Header>Engine.</Header>;

};

export default StrainerEngine;