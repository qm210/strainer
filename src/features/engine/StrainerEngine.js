import React from 'react';
import * as Redux from 'react-redux';
import WebMidi from 'webmidi';
import { Header, Segment } from 'semantic-ui-react';
import Slider from 'react-rangeslider';

const AudioContext = window.AudioContext || window.webkitAudioContext;
const channels = 2;

const noteFreq = (noteNumber) => 440 * Math.pow(2, (noteNumber - 69)/12);

const saw = param => phase => (2 * (phase % 1) - 1);
const detune = osc => phase => (0.4 * osc(phase) + .4 * osc(phase*1.01) + .4 * osc(phase*.984));
const square = param => phase => (phase % 1) > (param.pw || .5) ? 1 : -1;

class SimpleSynth {
    constructor(params = {}) {
        this.voices = params.voices || 3;
        this.voice = [];
        for (let v = 0; v < this.voices; v++) {
            this.voice.push({
                freq: null,
                vel: null,
                triggeredAt: null,
                osc: detune(square({pw: (params.pw || 0.5) * (1 - .04 * v) % 1})),
                envTime: 0,
                envDecay: .25,
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
        return .5 * (vel + vel * vel);
    }

    newNote (ctx, frames, event) {
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
                nowBuffering[s] = this.velocityFunction(event.velocity) * Math.exp(-voice.envTime / voice.envDecay) * voice.osc(voice.phase);
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

const StrainerEngine = () => {
    const dispatch = Redux.useDispatch();
    const current = Redux.useSelector(store => store.device.current);
    const [audioContext, setAudioContext] = React.useState(null);
    const [synth, setSynth] = React.useState(new SimpleSynth())
    const audioSource = React.useRef();
    const synthProc = React.useRef();
    const [pw, setPw] = React.useState(0.75);

    const currentDevice = React.useMemo(() =>
        (current && WebMidi.inputs.find(it => it.id === current.id)) || null
    , [current]);

    React.useEffect(() => {
        const initAudioContext = async () => {
            const ctx = new AudioContext()
            if (ctx.audioWorklet === undefined) {
                alert("AudioWorklet undefined, can't do shit!");
            }
            synthProc.current = await createSynthProcessor(ctx);
            setAudioContext(ctx);
        };
        if (!audioContext) {
            initAudioContext();
        }
    }, [audioContext, setAudioContext]);

    React.useEffect(() => {
        if (!currentDevice || currentDevice.state !== 'connected') {
            console.log("Can't do shit, current device is...", currentDevice);
            return;
        }

        if (!audioContext) {
            console.log("No Audio Context.")
            return;
        }

        const noteOnListener = event => {
            console.log(event.note);
            audioSource.current = audioContext.createBufferSource();
            audioSource.current.buffer = synth.newNote(audioContext, .5 * audioContext.sampleRate, event);
            if (synthProc.current) {
                console.log("synthproc", synthProc);
                audioSource.current.connect(synthProc.current).connect(audioContext.destination);
            }
            else {
                audioSource.current.connect(audioContext.destination);
            }
            audioSource.current.start();
            audioSource.current.onended = () => {
                audioSource.current = null;
                console.log("Audio Source Ended.");
            };
        }

        console.log("Has Audio Context. Init Event Listeners for ", currentDevice);
        currentDevice.addListener('noteon', 'all', noteOnListener)
        return () => {
            currentDevice.removeListener('noteon', 'all', noteOnListener);
        }
    }, [dispatch, synth, audioContext, currentDevice]);

    React.useEffect(() => {
        setSynth(new SimpleSynth({pw}));
    }, [pw]);
    console.log(pw);
    return <>
        <Header as='h4' attached='top'>
            Engine.
        </Header>
        <Segment attached>
            <label>pulse width</label>
            <Slider
                min = {0.5}
                max = {0.99}
                step = {0.01}
                value = {pw}
                onChange = {value => setPw(value)}
            />
        </Segment>
    </>;

};

export default StrainerEngine;