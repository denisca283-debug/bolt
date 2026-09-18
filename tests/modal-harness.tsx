import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ModalShell } from '../src/components/ModalShell';
import '../src/index.css';
function Harness() {
  const [open, setOpen] = useState(false);
  return <div className="p-6"><button className="btn-primary" onClick={() => setOpen(true)}>Открыть длинную форму</button>
    {open && <ModalShell title="Проверка длинной формы" onClose={() => setOpen(false)}
      footer={<button className="btn-secondary" onClick={() => setOpen(false)}>Отмена</button>}>
      {Array.from({ length: 35 }, (_, i) => <label key={i} className="block mb-4 text-txt-primary">Поле {i + 1}
        <input className="input-field block" /></label>)}
    </ModalShell>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
