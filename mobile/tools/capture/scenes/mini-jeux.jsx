import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChasseLueurs from '../../../src/screens/games/ChasseLueurs';
// ✨ Chasse aux Lueurs : « ?phase=intro » (titre + décompte) ou « ?phase=jeu » (après le décompte) — vérifier la mise en page.
const attendre = window.location.search.includes('phase=jeu') ? 3600 : 0;
function Scene() {
  const [ok, setOk] = useState(attendre === 0);
  useEffect(() => { if (attendre) { const id = setTimeout(() => setOk(true), 1); return () => clearTimeout(id); } return undefined; }, []);
  return ok ? <ChasseLueurs visible sons={false} vibrations={false} onGagne={() => ({ texte: '+23 🐾 Griffes' })} onFermer={() => {}} /> : null;
}
createRoot(document.getElementById('root')).render(<Scene />);
