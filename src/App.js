import React from 'react';
import MidiDeviceSelector from './features/device/MidiDeviceSelector';
import StrainerEngine from './features/engine/StrainerEngine';

function App() {
  return <>
    <MidiDeviceSelector/>
    <StrainerEngine/>
  </>;
}

export default App;
