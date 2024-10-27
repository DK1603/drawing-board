import React, { useState } from 'react';
import styles from '../styles/toolBar.module.css';
import { ReactComponent as BasicFiguresIcon } from '../pics/icons.toolbar/basic_figures.svg';
import { ReactComponent as BrushIcon } from '../pics/icons.toolbar/brush.svg';
import { ReactComponent as RedoIcon } from '../pics/icons.toolbar/redo.svg';
import { ReactComponent as InputIcon } from '../pics/icons.toolbar/input_file.svg';
import { ReactComponent as UndoIcon } from '../pics/icons.toolbar/undo.svg';
import { ReactComponent as TextIcon } from '../pics/icons.toolbar/text.svg';
import { ReactComponent as EraserIcon } from '../pics/icons.toolbar/eraser.svg';

const Toolbar = ({ setBrushColor, setBrushSize, onClearCanvas }) => {
  const [showBrushSettings, setShowBrushSettings] = useState(false);

  const toggleBrushSettings = () => {
    setShowBrushSettings((prev) => !prev);
  };

  return (
    <div className={styles.toolbarContainer}>
      <button className={styles.button} title="Text Tool">
        <TextIcon className={styles.icon} />
      </button>
      <button className={styles.button} title="Input Tool">
        <InputIcon className={styles.icon} />
      </button>

      <button onClick={toggleBrushSettings} className={styles.button} title="Brush Tool">
        <BrushIcon className={styles.icon} />
      </button>

      <button className={styles.button} title="Eraser Tool">
        <EraserIcon className={styles.icon} />
      </button>
      <button className={styles.button} title="Basic Figures Tool">
        <BasicFiguresIcon className={styles.icon} />
      </button>
      <button className={styles.button} title="Undo Tool">
        <UndoIcon className={styles.icon} />
      </button>
      <button className={styles.button} title="Redo Tool">
        <RedoIcon className={styles.icon} />
      </button>

      {showBrushSettings && (
        <div className={styles.brushSettingsPopup}>
          <label>
            Brush Color:
            <input
              type="color"
              onChange={(e) => setBrushColor(e.target.value)}
              style={{ marginLeft: '5px' }}
            />
          </label>
          <label className={styles.brushLabel}>
            Brush Size:
            <input
              type="range"
              min="1"
              max="50"
              onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
              style={{ marginLeft: '5px' }}
            />
          </label>
          <button onClick={onClearCanvas} style={{ marginTop: '10px' }}>Clear</button>
        </div>
      )}
    </div>
  );
};

export default Toolbar;