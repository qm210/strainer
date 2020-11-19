import React from 'react';
import * as Redux from 'react-redux';
import WebMidi from 'webmidi';
import { Header, Segment } from 'semantic-ui-react';
import Slider from 'react-rangeslider';
import * as Param from './paramSlice';

const AudioContext = window.AudioContext || window.webkitAudioContext;

const noteFreq = (noteNumber) => 440 * Math.pow(2, (noteNumber - 69)/12);

const synthEvent = event => ({
    type: event.type,
    freq: noteFreq(event.note.number)                        ,
    vel: event.velocity
});

const PROCS = [
    "cheap-synth",
    "cheap-crush",
    "cheap-filter"
];

const createProcessors = async (ctx, synthHandler) => {
    if (!ctx) {
        console.log("Well, no context. Whatchudo?");
        return;
    }
    const procNodes = [];
    try {
        await ctx.audioWorklet.addModule("worklets/processor.js");
        for (const proc of PROCS) {
            procNodes.push(new AudioWorkletNode(ctx, proc));
        }
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
    const audioSource = React.useRef();
    const cutoff = Redux.useSelector(store => store.param.cutoff);
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
    const [synthProc, crushProc, filterProc] = React.useMemo(() => audioState.proc || Array(PROCS.length).fill(null), [audioState]);

    React.useEffect(() => {
        if (!crushProc) {
            return;
        }
        crushProc.parameters.get("quant").value = bitcrushRate;
    }, [crushProc, bitcrushRate])

    React.useEffect(() => {
        if (!filterProc) {
            return;
        }
        filterProc.parameters.get("cutoff").value = cutoff;
    }, [filterProc, cutoff]);

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
            audioSource.current = audioState.context.createBufferSource();
            let chain = audioSource.current;
            for (const proc of audioState.proc) {
                proc.port.postMessage(synthEvent(event));
                chain = chain.connect(proc);
            }
            chain.connect(audioState.context.destination);
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
    }, [dispatch, audioState, currentDevice]);

    return <>
        <Header as='h4' attached='top'>
            Engine.
        </Header>
        <Segment attached>
            <label>cutoff freq</label>
            <Slider
                min = {0}
                max = {10000}
                step = {1}
                value = {cutoff}
                onChange = {value => dispatch(Param.update({cutoff: value}))}
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