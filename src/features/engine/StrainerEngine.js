import React from 'react';
import * as Redux from 'react-redux';
import WebMidi from 'webmidi';

const AudioContext = window.AudioContext || window.webkitAudioContext;
const channels = 2;

const noteFreq = (noteNumber) => 440 * Math.pow(2, (noteNumber - 69)/12);

const saw = phase => (2 * (phase % 1) - 1);
const detuneSaw = phase => (0.4 * saw(phase) + .4 * saw(phase*1.01) + .4 * saw(phase*.994));

const newNote = (ctx, frames, event) => {
    console.table(event);
    const arrayBuffer = ctx.createBuffer(channels, frames, ctx.sampleRate);
    const osc = detuneSaw;
    const freq = noteFreq(event.note.number);
    for (let ch = 0; ch < channels; ch++) {
        const nowBuffering = arrayBuffer.getChannelData(ch);
        for (let s = 0; s < frames; s++) {
            const phase = freq * s / ctx.sampleRate;
            nowBuffering[s] = event.velocity * osc(phase);
        }
    }
    return arrayBuffer;
}

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

        const genericEventListener = event => {
            console.table(event);
        };

        const noteOnListener = event => {
            audioSource.current = audioContext.createBufferSource();
            audioSource.current.buffer = newNote(audioContext, 2 * audioContext.sampleRate, event);
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

    return <div>Engine, {WebMidi.time}</div>;

};

export default StrainerEngine;