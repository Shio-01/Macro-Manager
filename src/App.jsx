import { useState, useEffect, useMemo } from 'react';

// Modifiers
const MOD_NONE  = 0x00;
const MOD_CTRL  = 0x80;
const MOD_ALT   = 0x82;
const MOD_SHIFT = 0x81;
const MOD_WIN   = 0x83;

// Categorized HID Key Database
const KEY_DATABASE = [
  {
    category: 'General',
    keys: [
      { label: 'None (Unmapped)', code: 0x00 }
    ]
  },
  {
    category: 'Function Keys',
    keys: [
      { label: 'F1', code: 0x3A }, { label: 'F2', code: 0x3B }, { label: 'F3', code: 0x3C },
      { label: 'F4', code: 0x3D }, { label: 'F5', code: 0x3E }, { label: 'F6', code: 0x3F },
      { label: 'F7', code: 0x40 }, { label: 'F8', code: 0x41 }, { label: 'F9', code: 0x42 },
      { label: 'F10', code: 0x43 }, { label: 'F11', code: 0x44 }, { label: 'F12', code: 0x45 },
      { label: 'F13', code: 0x68 }, { label: 'F14', code: 0x69 }, { label: 'F15', code: 0x6A },
      { label: 'F16', code: 0x6B }, { label: 'F17', code: 0x6C }, { label: 'F18', code: 0x6D },
      { label: 'F19', code: 0x6E }, { label: 'F20', code: 0x6F }, { label: 'F21', code: 0x70 }
    ]
  },
  {
    category: 'Letters (A-Z)',
    keys: Array.from({ length: 26 }, (_, i) => ({
      label: String.fromCharCode(65 + i),
      code: 0x04 + i
    }))
  },
  {
    category: 'Numbers & Symbols',
    keys: [
      { label: '1', code: 0x1E }, { label: '2', code: 0x1F }, { label: '3', code: 0x20 },
      { label: '4', code: 0x21 }, { label: '5', code: 0x22 }, { label: '6', code: 0x23 },
      { label: '7', code: 0x24 }, { label: '8', code: 0x25 }, { label: '9', code: 0x26 },
      { label: '0', code: 0x27 }, { label: 'Enter', code: 0x28 }, { label: 'Escape', code: 0x29 },
      { label: 'Backspace', code: 0x2A }, { label: 'Tab', code: 0x2B }, { label: 'Space', code: 0x2C }
    ]
  },
  {
    category: 'Navigation & Editing',
    keys: [
      { label: 'Print Screen', code: 0x46 }, { label: 'Scroll Lock', code: 0x47 },
      { label: 'Pause/Break', code: 0x48 }, { label: 'Insert', code: 0x49 },
      { label: 'Home', code: 0x4A }, { label: 'Page Up', code: 0x4B },
      { label: 'Delete', code: 0x4C }, { label: 'End', code: 0x4D },
      { label: 'Page Down', code: 0x4E }, { label: 'Right Arrow', code: 0x4F },
      { label: 'Left Arrow', code: 0x50 }, { label: 'Down Arrow', code: 0x51 },
      { label: 'Up Arrow', code: 0x52 }
    ]
  },
  {
    category: 'Media Keys',
    keys: [
      { label: 'Mute', code: 0xE2 }, { label: 'Volume Up', code: 0xE9 },
      { label: 'Volume Down', code: 0xEA }, { label: 'Play/Pause', code: 0xCD },
      { label: 'Next Track', code: 0xB5 }, { label: 'Previous Track', code: 0xB6 }
    ]
  }
];

const KEY_LABELS = {
  0: 'Knob Click',
  1: 'M1', 2: 'M2', 3: 'M3', 4: 'M4',
  5: 'M5', 6: 'M6', 7: 'M7', 8: 'M8',
  9: 'MODE',
  10: 'Knob Turn Left',
  11: 'Knob Turn Right'
};

export default function App() {
  const [device, setDevice] = useState(null);
  const [status, setStatus] = useState('Not connected');
  const [activeProfile, setActiveProfile] = useState(0);
  const [selectedKey, setSelectedKey] = useState(1);

  // Keybind preview state for 3 profiles x 12 key slots
  const [keybinds, setKeybinds] = useState({ 0: {}, 1: {}, 2: {} });

  // Configuration Form State
  const [actionType, setActionType] = useState('0');
  const [mod1, setMod1] = useState(MOD_NONE);
  const [mod2, setMod2] = useState(MOD_NONE);
  const [keyCode, setKeyCode] = useState(0x00);
  const [macroText, setMacroText] = useState('');

  // Recording & Search Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeysText, setRecordedKeysText] = useState('');

  const filteredCategories = useMemo(() => {
    return KEY_DATABASE.map(cat => ({
      ...cat,
      keys: cat.keys.filter(k => k.label.toLowerCase().includes(searchQuery.toLowerCase()))
    })).filter(cat => cat.keys.length > 0);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim() !== '' && filteredCategories.length > 0) {
      const firstAvailableKey = filteredCategories[0].keys[0];
      if (firstAvailableKey) setKeyCode(firstAvailableKey.code);
    }
  }, [searchQuery, filteredCategories]);

  // WebHID Connection
  const connectArduino = async () => {
    try {
      if (!('hid' in navigator)) return setStatus('Use Chrome or Edge for WebHID');

      const devices = await navigator.hid.requestDevice({ filters: [] });

      if (devices.length > 0) {
        const selectedDevice = devices[0];
        await selectedDevice.open();
        setDevice(selectedDevice);
        setStatus(`Connected: ${selectedDevice.productName || 'Macropad'}`);
      }
    } catch (err) {
      setStatus(`Connection failed: ${err.message}`);
    }
  };

  const getHidCodeFromEvent = (e) => {
    if (e.code.startsWith('Key')) return 0x04 + (e.code.charCodeAt(3) - 65);
    if (e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''));
      return num === 0 ? 0x27 : 0x1E + (num - 1);
    }
    if (e.code.startsWith('F') && !isNaN(e.code.replace('F', ''))) {
      const fNum = parseInt(e.code.replace('F', ''));
      if (fNum >= 1 && fNum <= 12) return 0x3A + (fNum - 1);
      if (fNum >= 13 && fNum <= 24) return 0x68 + (fNum - 13);
    }

    const map = {
      Space: 0x2C, Enter: 0x28, Escape: 0x29, Backspace: 0x2A, Tab: 0x2B,
      Delete: 0x4C, Insert: 0x49, Home: 0x4A, End: 0x4D,
      PageUp: 0x4B, PageDown: 0x4E, ArrowRight: 0x4F, ArrowLeft: 0x50,
      ArrowDown: 0x51, ArrowUp: 0x52, PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48
    };

    return map[e.code] || 0x00;
  };

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      let m1 = MOD_NONE;
      let m2 = MOD_NONE;

      if (e.ctrlKey) m1 = MOD_CTRL;
      if (e.altKey) m1 ? (m2 = MOD_ALT) : (m1 = MOD_ALT);
      if (e.shiftKey) m1 ? (m2 = MOD_SHIFT) : (m1 = MOD_SHIFT);
      if (e.metaKey) m1 ? (m2 = MOD_WIN) : (m1 = MOD_WIN);

      const isModifierKey = ['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'].includes(e.code);

      if (!isModifierKey) {
        const capturedCode = getHidCodeFromEvent(e);
        
        setMod1(m1);
        setMod2(m2);
        setKeyCode(capturedCode);
        
        const keyLabel = e.key.length === 1 ? e.key.toUpperCase() : e.key;
        const comboName = `${m1 === MOD_CTRL ? 'CTRL + ' : m1 === MOD_ALT ? 'ALT + ' : m1 === MOD_SHIFT ? 'SHIFT + ' : m1 === MOD_WIN ? 'WIN + ' : ''}${m2 === MOD_CTRL ? 'CTRL + ' : m2 === MOD_ALT ? 'ALT + ' : m2 === MOD_SHIFT ? 'SHIFT + ' : m2 === MOD_WIN ? 'WIN + ' : ''}${keyLabel}`;
        
        setRecordedKeysText(comboName);
        setIsRecording(false);
      } else {
        const modText = `${e.ctrlKey ? 'CTRL + ' : ''}${e.altKey ? 'ALT + ' : ''}${e.shiftKey ? 'SHIFT + ' : ''}${e.metaKey ? 'WIN + ' : ''}...`;
        setRecordedKeysText(modText);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  // Target RawHID Vendor Collection Bypassing Security Locks
  const saveToBoard = async () => {
    if (!device) return alert('Connect board first!');

    try {
      let targetReportId = 0;
      
      const rawHidCollection = device.collections?.find(
        c => c.usagePage === 0xFFAB
      );

      if (rawHidCollection && rawHidCollection.outputReports?.length > 0) {
        targetReportId = rawHidCollection.outputReports[0].reportId;
      } else {
        for (const col of device.collections || []) {
          if (col.outputReports && col.outputReports.length > 0) {
            targetReportId = col.outputReports[0].reportId;
            break;
          }
        }
      }

      const packet = new Uint8Array(64);
      packet.fill(0);

      packet[0] = 0x01;                       // CMD: SET KEY
      packet[1] = Number(activeProfile);      // Profile (0-2)
      packet[2] = Number(selectedKey);        // Key Index (0-11)
      packet[3] = Number(actionType);         // 0 = Shortcut, 1 = Text
      packet[4] = Number(mod1);
      packet[5] = Number(mod2);
      packet[6] = Number(keyCode);

      if (actionType === '1') {
        const encoder = new TextEncoder();
        const textBytes = encoder.encode(macroText);
        packet.set(textBytes.subarray(0, 31), 7);
      }

      await device.sendReport(targetReportId, packet);

      // Update local preview bindings state
      setKeybinds(prev => ({
        ...prev,
        [activeProfile]: {
          ...prev[activeProfile],
          [selectedKey]: {
            type: Number(actionType),
            mod1: Number(mod1),
            mod2: Number(mod2),
            key: Number(keyCode),
            text: macroText
          }
        }
      }));

      setStatus(`Profile ${activeProfile + 1} - ${KEY_LABELS[selectedKey]} Saved!`);
    } catch (err) {
      console.error('WebHID Output Error:', err);
      setStatus(`Error: ${err.message}`);
    }
  };

  // Helper to format live keybind text on buttons
  const getKeyPreview = (profIdx, keyIdx) => {
    const bind = keybinds[profIdx]?.[keyIdx];
    if (!bind) return null;
    if (bind.type === 1) return bind.text ? `"${bind.text.slice(0, 7)}"` : 'Text';
    if (bind.key === 0 && bind.mod1 === 0 && bind.mod2 === 0) return null;

    let mods = '';
    if (bind.mod1 === MOD_CTRL || bind.mod2 === MOD_CTRL) mods += 'C+';
    if (bind.mod1 === MOD_ALT || bind.mod2 === MOD_ALT) mods += 'A+';
    if (bind.mod1 === MOD_SHIFT || bind.mod2 === MOD_SHIFT) mods += 'S+';
    if (bind.mod1 === MOD_WIN || bind.mod2 === MOD_WIN) mods += 'W+';

    let keyLabel = '';
    for (const cat of KEY_DATABASE) {
      const k = cat.keys.find(item => item.code === bind.key);
      if (k) { keyLabel = k.label; break; }
    }

    return `${mods}${keyLabel}`;
  };

  return (
    <div style={styles.appContainer}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>MACROPAD<span style={styles.purpleAccent}>.CONFIG</span></h1>
          <p style={styles.subtitle}>Hardware Customizer</p>
        </div>
        <button onClick={connectArduino} style={device ? styles.btnConnected : styles.btnConnect}>
          {device ? '● Connected' : 'Connect Macropad'}
        </button>
      </div>

      <div style={styles.mainLayout}>
        {/* Left Column: Visual Macropad */}
        <div style={styles.leftColumn}>
          <div style={styles.profileBar}>
            <span style={styles.label}>Profile:</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[0, 1, 2].map(p => (
                <button 
                  key={p} 
                  onClick={() => setActiveProfile(p)}
                  style={activeProfile === p ? styles.profileBtnActive : styles.profileBtn}
                >
                  PROFILE {p + 1}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.gridContainer}>
            {[1, 2, 3, 4].map(k => (
              <button 
                key={k} 
                onClick={() => setSelectedKey(k)} 
                style={selectedKey === k ? styles.keyBtnActive : styles.keyBtn}
              >
                <div>M{k}</div>
                <div style={styles.bindPreview}>{getKeyPreview(activeProfile, k)}</div>
              </button>
            ))}

            {/* Rotary Knob Button */}
            <div style={styles.knobWrapper}>
              <button 
                onClick={() => setSelectedKey(0)} 
                style={selectedKey === 0 ? styles.knobActive : styles.knob}
              >
                <span>KNOB</span>
                <span style={styles.bindPreview}>{getKeyPreview(activeProfile, 0) || 'PRESS'}</span>
              </button>
            </div>

            {[5, 6, 7, 8].map(k => (
              <button 
                key={k} 
                onClick={() => setSelectedKey(k)} 
                style={selectedKey === k ? styles.keyBtnActive : styles.keyBtn}
              >
                <div>M{k}</div>
                <div style={styles.bindPreview}>{getKeyPreview(activeProfile, k)}</div>
              </button>
            ))}

            <button 
              onClick={() => setSelectedKey(9)} 
              style={selectedKey === 9 ? styles.redKeyActive : styles.redKey}
            >
              <div>MODE</div>
            </button>
          </div>

          {/* Dedicated Knob Rotation Controls */}
          <div style={styles.knobActionsPanel}>
            <span style={styles.label}>Encoder Rotation Binds:</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setSelectedKey(10)} 
                style={selectedKey === 10 ? styles.knobSubBtnActive : styles.knobSubBtn}
              >
                ↺ Turn Left
                <div style={styles.subBindPreview}>{getKeyPreview(activeProfile, 10) || 'Vol Down'}</div>
              </button>
              <button 
                onClick={() => setSelectedKey(11)} 
                style={selectedKey === 11 ? styles.knobSubBtnActive : styles.knobSubBtn}
              >
                ↻ Turn Right
                <div style={styles.subBindPreview}>{getKeyPreview(activeProfile, 11) || 'Vol Up'}</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Key Config Editor */}
        <div style={styles.rightColumn}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>
                EDITING: <span style={styles.purpleAccent}>{KEY_LABELS[selectedKey]}</span>
              </h3>
              <span style={styles.badge}>PROFILE {activeProfile + 1}</span>
            </div>

            {selectedKey === 9 ? (
              <p style={styles.warningText}>The Mode key is reserved for physical profile switching on board.</p>
            ) : (
              <>
                <div style={styles.radioGroup}>
                  <button 
                    onClick={() => setActionType('0')} 
                    style={actionType === '0' ? styles.tabActive : styles.tab}
                  >
                    Keyboard Shortcut
                  </button>
                  <button 
                    onClick={() => setActionType('1')} 
                    style={actionType === '1' ? styles.tabActive : styles.tab}
                  >
                    Text Macro String
                  </button>
                </div>

                {actionType === '0' ? (
                  <div>
                    <button 
                      onClick={() => {
                        setRecordedKeysText('');
                        setIsRecording(true);
                      }}
                      style={isRecording ? styles.recordBtnRecording : styles.recordBtn}
                    >
                      {isRecording 
                        ? (recordedKeysText || 'RECORDING: Press shortcut combo on keyboard...') 
                        : recordedKeysText 
                          ? `RECORDED: ${recordedKeysText} (Click to re-record)` 
                          : 'RECORD KEYPRESS INPUT'}
                    </button>

                    <div style={styles.grid2Col}>
                      <div>
                        <label style={styles.fieldLabel}>Modifier 1</label>
                        <select value={mod1} onChange={(e) => setMod1(Number(e.target.value))} style={styles.select}>
                          <option value={MOD_NONE}>None</option>
                          <option value={MOD_CTRL}>CTRL</option>
                          <option value={MOD_ALT}>ALT</option>
                          <option value={MOD_SHIFT}>SHIFT</option>
                          <option value={MOD_WIN}>WINDOWS / CMD</option>
                        </select>
                      </div>
                      <div>
                        <label style={styles.fieldLabel}>Modifier 2</label>
                        <select value={mod2} onChange={(e) => setMod2(Number(e.target.value))} style={styles.select}>
                          <option value={MOD_NONE}>None</option>
                          <option value={MOD_CTRL}>CTRL</option>
                          <option value={MOD_ALT}>ALT</option>
                          <option value={MOD_SHIFT}>SHIFT</option>
                          <option value={MOD_WIN}>WINDOWS / CMD</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                      <label style={styles.fieldLabel}>Target Key Code</label>
                      <input 
                        type="text" 
                        placeholder="Search key (e.g. F13, Space, Delete)..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={styles.input}
                      />

                      <select 
                        value={keyCode} 
                        onChange={(e) => setKeyCode(Number(e.target.value))}
                        style={styles.select}
                      >
                        {filteredCategories.map(cat => (
                          <optgroup key={cat.category} label={cat.category}>
                            {cat.keys.map(k => (
                              <option key={k.code} value={k.code}>{k.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={styles.fieldLabel}>Macro Text Payload</label>
                    <input 
                      type="text" 
                      placeholder="Type text string (e.g., git commit -m)" 
                      value={macroText} 
                      onChange={(e) => setMacroText(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                )}

                <button 
                  onClick={saveToBoard}
                  disabled={!device}
                  style={!device ? styles.saveBtnDisabled : styles.saveBtn}
                >
                  SYNC KEY SETTING TO EEPROM
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <span>STATUS: <strong style={{ color: device ? '#A855F7' : '#888' }}>{status}</strong></span>
      </div>
    </div>
  );
}

// Wide Screen Fixed 1400px Layout Styles
const styles = {
  appContainer: {
    padding: '2.5rem 3rem',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
    color: '#F4F4F5',
    backgroundColor: '#09090B',
    minHeight: '100vh',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    borderBottom: '1px solid #27272A',
    paddingBottom: '1.25rem'
  },
  title: {
    margin: 0,
    fontSize: '1.75rem',
    fontWeight: 900,
    letterSpacing: '1px'
  },
  purpleAccent: {
    color: '#A855F7'
  },
  subtitle: {
    margin: '0.2rem 0 0 0',
    fontSize: '0.85rem',
    color: '#A1A1AA'
  },
  btnConnect: {
    padding: '0.65rem 1.4rem',
    backgroundColor: '#18181B',
    color: '#F4F4F5',
    border: '1px solid #3F3F46',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  btnConnected: {
    padding: '0.65rem 1.4rem',
    backgroundColor: '#A855F7',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  mainLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2.5rem',
    alignItems: 'start',
    width: '100%'
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    width: '100%'
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%'
  },
  profileBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#A1A1AA',
    letterSpacing: '0.5px'
  },
  profileBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#18181B',
    color: '#A1A1AA',
    border: '1px solid #27272A',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.75rem'
  },
  profileBtnActive: {
    padding: '0.5rem 1rem',
    backgroundColor: '#F4F4F5',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '900',
    fontSize: '0.75rem'
  },
  gridContainer: {
    backgroundColor: '#121215',
    border: '1px solid #27272A',
    padding: '1.5rem',
    borderRadius: '12px',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '12px',
    boxSizing: 'border-box'
  },
  keyBtn: {
    aspectRatio: '1/1',
    backgroundColor: '#18181B',
    color: '#F4F4F5',
    border: '1px solid #27272A',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px'
  },
  keyBtnActive: {
    aspectRatio: '1/1',
    backgroundColor: '#A855F7',
    color: '#000',
    border: 'none',
    fontWeight: '900',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px'
  },
  knobWrapper: {
    aspectRatio: '1/1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  knob: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: '#18181B',
    color: '#A1A1AA',
    border: '1px solid #27272A',
    fontWeight: 'bold',
    fontSize: '0.75rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  knobActive: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: '#A855F7',
    color: '#000',
    border: 'none',
    fontWeight: '900',
    fontSize: '0.75rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)'
  },
  redKey: {
    aspectRatio: '1/1',
    backgroundColor: '#18181B',
    color: '#EF4444',
    border: '1px solid #27272A',
    fontWeight: 'bold',
    borderRadius: '8px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  redKeyActive: {
    aspectRatio: '1/1',
    backgroundColor: '#EF4444',
    color: '#FFF',
    border: 'none',
    fontWeight: '900',
    borderRadius: '8px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  bindPreview: {
    fontSize: '0.65rem',
    marginTop: '3px',
    opacity: 0.8,
    fontWeight: 'normal',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%'
  },
  subBindPreview: {
    fontSize: '0.7rem',
    marginTop: '2px',
    opacity: 0.8,
    fontWeight: 'normal'
  },
  knobActionsPanel: {
    backgroundColor: '#121215',
    border: '1px solid #27272A',
    padding: '1rem',
    borderRadius: '12px'
  },
  knobSubBtn: {
    padding: '0.75rem',
    backgroundColor: '#18181B',
    color: '#F4F4F5',
    border: '1px solid #27272A',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.8rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  knobSubBtnActive: {
    padding: '0.75rem',
    backgroundColor: '#A855F7',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '900',
    fontSize: '0.8rem',
    boxShadow: '0 0 12px rgba(168, 85, 247, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  card: {
    backgroundColor: '#121215',
    border: '1px solid #27272A',
    padding: '1.5rem',
    borderRadius: '12px',
    boxSizing: 'border-box'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem'
  },
  cardTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 800,
    letterSpacing: '0.5px'
  },
  badge: {
    backgroundColor: '#27272A',
    color: '#A1A1AA',
    fontSize: '0.7rem',
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    fontWeight: 'bold'
  },
  warningText: {
    color: '#EF4444',
    fontSize: '0.85rem',
    margin: 0
  },
  radioGroup: {
    display: 'flex',
    gap: '8px',
    marginBottom: '1rem',
    backgroundColor: '#18181B',
    padding: '4px',
    borderRadius: '8px',
    border: '1px solid #27272A'
  },
  tab: {
    flex: 1,
    padding: '0.5rem',
    backgroundColor: 'transparent',
    color: '#A1A1AA',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  tabActive: {
    flex: 1,
    padding: '0.5rem',
    backgroundColor: '#27272A',
    color: '#F4F4F5',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  recordBtn: {
    width: '100%',
    padding: '0.85rem',
    marginBottom: '1rem',
    backgroundColor: '#18181B',
    color: '#A855F7',
    border: '1px solid #A855F7',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '0.8rem',
    letterSpacing: '0.5px',
    cursor: 'pointer'
  },
  recordBtnRecording: {
    width: '100%',
    padding: '0.85rem',
    marginBottom: '1rem',
    backgroundColor: '#A855F7',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '900',
    fontSize: '0.8rem',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    boxShadow: '0 0 15px rgba(168, 85, 247, 0.5)'
  },
  grid2Col: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  fieldLabel: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    color: '#A1A1AA',
    marginBottom: '0.4rem'
  },
  input: {
    width: '100%',
    padding: '0.65rem',
    backgroundColor: '#18181B',
    color: '#F4F4F5',
    border: '1px solid #27272A',
    borderRadius: '6px',
    boxSizing: 'border-box',
    marginBottom: '0.6rem',
    fontSize: '0.85rem'
  },
  select: {
    width: '100%',
    padding: '0.65rem',
    backgroundColor: '#18181B',
    color: '#F4F4F5',
    border: '1px solid #27272A',
    borderRadius: '6px',
    fontSize: '0.85rem'
  },
  saveBtn: {
    marginTop: '1.25rem',
    width: '100%',
    padding: '0.85rem',
    backgroundColor: '#F4F4F5',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '900',
    letterSpacing: '0.5px',
    cursor: 'pointer'
  },
  saveBtnDisabled: {
    marginTop: '1.25rem',
    width: '100%',
    padding: '0.85rem',
    backgroundColor: '#27272A',
    color: '#71717A',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'not-allowed'
  },
  footer: {
    marginTop: '2rem',
    fontSize: '0.8rem',
    color: '#71717A',
    textAlign: 'center'
  }
};