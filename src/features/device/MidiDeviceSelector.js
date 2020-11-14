import React from 'react';
import * as Redux from 'react-redux';
import WebMidi from 'webmidi';
import { Menu, Header, Segment } from 'semantic-ui-react';
import * as Device from './deviceSlice';

const MidiDeviceSelector = () => {
    const dispatch = Redux.useDispatch();
    const current = Redux.useSelector(store => store.device.current);
    const all = Redux.useSelector(store => store.device.all)

    const webMidiRestart = React.useCallback(() => {
        console.log("Enabling WebMidi... (trying)");
        WebMidi.disable();
        WebMidi.enable(err => {
            if (err) {
                dispatch(Device.setError(err));
                console.log("Fail.", err);
                return;
            }
            console.log("Webmidi enabled!");
            console.table(WebMidi.inputs);
            const allDevices = WebMidi.inputs.map(it => ({
                id: it.id,
                name: it.name,
                state: it.state,
            }));
            dispatch(Device.set({
                all: allDevices,
                current: allDevices[0],
            }));
            console.log("Resetting Disconnected-Listener");
            WebMidi.removeListener('disconnected');
            WebMidi.addListener('disconnected', event => {
                console.log("Disconnected! Why though.", event);
                webMidiRestart();
            });
        });
    }, [dispatch]);

    React.useEffect(() => {
        webMidiRestart();
    }, [webMidiRestart]);

    if (!WebMidi.inputs) {
        return <h3>WebMidi not enabled yet.</h3>
    }

    if (all.length === 0) {
        return <h3>No Midi Devices Found.</h3>;
    }

    return <>
        <Header as='h3' attached='top' content="Input Device Selector"/>
        <Segment attached>
            <Menu secondary vertical>
            {all.filter(it => it.state === 'connected')
                .map(it =>
                    <Menu.Item
                        key = {it.id}
                        active = {current && current.id === it.id}
                        name = {it.name}
                        onClick = {(_, {name}) => {dispatch(Device.setCurrentByName(name))}}
                    />
                )
            }
            </Menu>
        </Segment>
    </>;

};

export default MidiDeviceSelector;