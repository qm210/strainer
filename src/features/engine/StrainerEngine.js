import React from 'react';
import * as Redux from 'react-redux';
import WebMidi from 'webmidi';
import { Header, Segment } from 'semantic-ui-react';
import Slider from 'react-rangeslider';
import * as Param from './paramSlice';
import { reducedObject } from './../../app/utils';

const AudioContext = window.AudioContext || window.webkitAudioContext;

const noteFreq = (noteNumber) => 440 * Math.pow(2, (noteNumber - 69)/12);

const synthEvent = event => ({
    type: event.type,
    freq: noteFreq(event.note.number),
    vel: event.velocity
});

const PROC_SYNTH = "cheap-synth";
const PROC_CRUSH = "cheap-crush";
const PROC_FILTER = "cheap-filter";

const PROCS = [PROC_SYNTH, PROC_CRUSH, PROC_FILTER];

const createProcessors = async (ctx, synthHandler) => {
    if (!ctx) {
        console.log("Well, no context. Whatchudo?");
        return;
    }
    const procNodes = {};
    try {
        await ctx.audioWorklet.addModule("worklets/processor.js");
        for (const proc of PROCS) {
            procNodes[proc] = new AudioWorkletNode(ctx, proc);
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
    const param = Redux.useSelector(store => store.param);

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
            setAudioState({context: ctx, proc});
            const allParams = {};
            for (const [pKey, pVal] of Object.entries(proc)) {
                const procParams = {};
                for (const [key, par] of pVal.parameters.entries()) {
                    procParams[key] = reducedObject(par, ['value', 'defaultValue', 'minValue', 'maxValue']);
                }
                allParams[pKey] = procParams;
            };
            dispatch(Param.update(allParams));
        };
        if (!audioState.context) {
            initAudioContext();
        }
    }, [audioState, setAudioState, dispatch]);

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
            for (const procName of PROCS) {
                const proc = audioState.proc[procName];
                proc.port.postMessage(synthEvent(event));
                chain = chain.connect(proc);
            }
            chain.connect(audioState.context.destination);
            audioSource.current.start();
            audioSource.current.onended = () => {
                console.log("audio source ended", audioSource.current);
                audioSource.current = null;
            };
        }

        console.log("Has Audio Context. Init Event Listeners for ", currentDevice);
        currentDevice.addListener('noteon', 'all', noteOnListener)
        return () => {
            currentDevice.removeListener('noteon', 'all', noteOnListener);
        }
    }, [dispatch, audioState, currentDevice]);

    const updateSingleParameter = React.useCallback((name, key, value) => {
        const proc = audioState.proc[name];
        if (!proc) {
            return;
        }
        proc.parameters.get(key).value = value;
        dispatch(Param.updateSingle({name, key, value}));
    }, [audioState.proc, dispatch]);

    return <>
        <Header as='h4' attached='top'>
            Engine.
        </Header>
        <Segment attached>
        {
            Object.entries(param).map(([name, proc], pIndex) =>
                <div key={pIndex}>
                    {
                        Object.entries(proc).map(([key, par], index) =>
                        <React.Fragment key={index}>
                            <label>{name} / {key}</label>
                            <Slider
                                min = {par.minValue}
                                max = {par.maxValue}
                                step = {0.01}
                                value = {par.value}
                                onChange = {value => updateSingleParameter(name, key, value)}
                            />
                        </React.Fragment>
                    )}
                </div>
            )
        }
        {/*
            <label>cutoff freq</label>
            <Slider
                min = {0}
                max = {6666}
                step = {1}
                value = {param.cutoff}
                onChange = {value => dispatch(Param.update({cutoff: value}))}
            />
            <label>bitcrush</label>
            <Slider
                min = {1}
                max = {128}
                step = {1}
                value = {param.bitcrushRate}
                onChange = {value => dispatch(Param.update({bitcrushRate: value}))}
            />
            <label>phase distortion (FM)</label>
            <Slider
                min = {0}
                max = {10}
                step = {.01}
                value = {param.fmSaw}
                onChange = {value => dispatch(Param.update({fmSaw: value}))}
            />
            <label>decay</label>
            <Slider
                min = {0.01}
                max = {1}
                step = {.01}
                value = {param.decay}
                onChange = {value => dispatch(Param.update({decay: value}))}
            />
             */}
        </Segment>
    </>;

};

export default StrainerEngine;