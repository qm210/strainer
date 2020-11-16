import React from 'react';
import * as Redux from 'react-redux';
import WebMidi from 'webmidi';
import { Header, Segment } from 'semantic-ui-react';
import Slider from 'react-rangeslider';
import * as Param from './paramSlice';

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

const PROC_SYNTH = "cheap-synth";
const PROC_CRUSH = "cheap-crush";

const createProcessors = async (ctx) => {
    if (!ctx) {
        console.log("Well, no context. Whatchudo?");
        return;
    }
    const procNodes = [];
    try {
        await ctx.audioWorklet.addModule("worklets/processor.js");
        const synthNode = new AudioWorkletNode(ctx, PROC_SYNTH)
        synthNode.port.onmessage = event => {
            console.log("Synth Worklet Node received messidsch:", event)
            synthNode.port.postMessage({
                soWhat: "thanks!"
            });
        };
        procNodes.push(synthNode);
        procNodes.push(new AudioWorkletNode(ctx, PROC_CRUSH));
    }
    catch (e) {
        console.log("Couldn't get it up!", e);
        return null;
    }
    await ctx.resume();
    return procNodes;
}

const StrainerEngine = () => {
    const dispatch = Redux.useDispatch();
    const current = Redux.useSelector(store => store.device.current);
    const [audioState, setAudioState] = React.useState({context: null, proc: []});
    const [synth, setSynth] = React.useState(new SimpleSynth())
    const audioSource = React.useRef();
    const pw = Redux.useSelector(store => store.param.pw);
    const bitcrushRate = Redux.useSelector(store => store.param.bitcrushRate);

    const currentDevice = React.useMemo(() =>
        (current && WebMidi.inputs.find(it => it.id === current.id)) || null
    , [current]);

    React.useEffect(() => {
        const initAudioContext = async () => {
            const ctx = new AudioContext()
            if (ctx.audioWorklet === undefined) {
                alert("AudioWorklet undefined, can't do shit!");
            }
            const proc = await createProcessors(ctx);
            console.log("RIGHT SO PROC IS", proc);
            setAudioState({context: ctx, proc});
        };
        if (!audioState.context) {
            initAudioContext();
        }
    }, [audioState, setAudioState, bitcrushRate]);

    // has to match the createProcessors() order of AudioWorkletProcessor creation!
    const [synthProc, crushProc] = React.useMemo(() => audioState.proc || Array(2).fill(null), [audioState]);

    React.useEffect(() => {
        if (!crushProc) {
            return;
        }
        crushProc.parameters.get("quant").value = bitcrushRate;
    }, [crushProc, bitcrushRate])

    React.useEffect(() => {
        if (!currentDevice || currentDevice.state !== 'connected') {
            console.log("Can't do shit, current device is...", currentDevice);
            return;
        }

        if (!audioState.context) {
            console.log("No Audio Context.")
            return;
        }

        const noteOnListener = event => {
            console.log(event.note, synthProc, crushProc);
            audioSource.current = audioState.context.createBufferSource();
            audioSource.current.buffer = synth.newNote(audioState.context, .5 * audioState.context.sampleRate, event);
            if (synthProc && crushProc) {
                audioSource.current.connect(synthProc).connect(crushProc).connect(audioState.context.destination);
            }
            else if (crushProc) {
                audioSource.current.connect(crushProc).connect(audioState.context.destination);
            }
            else {
                audioSource.current.connect(audioState.context.destination);
            }
            audioSource.current.start();
            audioSource.current.onended = () => {
                audioSource.current = null;
            };
        }

        console.log("Has Audio Context. Init Event Listeners for ", currentDevice);
        currentDevice.addListener('noteon', 'all', noteOnListener)
        return () => {
            currentDevice.removeListener('noteon', 'all', noteOnListener);
        }
    }, [dispatch, synth, audioState, currentDevice, synthProc, crushProc]);

    React.useEffect(() => {
        setSynth(new SimpleSynth({pw}));
    }, [pw]);

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
                onChange = {value => dispatch(Param.update({pw: value}))}
            />
            <label>bitcrush</label>
            <Slider
                min = {1}
                max = {128}
                step = {1}
                value = {bitcrushRate}
                onChange = {value => dispatch(Param.update({bitcrushRate: value}))}
            />
        </Segment>
    </>;

};

export default StrainerEngine;