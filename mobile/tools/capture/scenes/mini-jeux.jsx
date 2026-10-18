import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import MiniJeu from '../../../src/screens/games/MiniJeu';
// 🎮 Mini-jeux : « ?jeu=chasse|doree|transe » ; « &phase=jeu » attend la fin du décompte — vérifier la mise en page.
const q = new URLSearchParams(window.location.search);
const jeu = q.get('jeu') || 'chasse';
function Scene() {
  const [ok, setOk] = useState(true);
  useEffect(() => { setOk(true); }, []);
  return ok ? <MiniJeu jeu={jeu} sons={false} vibrations={false} onGagne={() => ({ texte: '+23 🐾 Griffes' })} onFermer={() => {}} /> : null;
}
createRoot(document.getElementById('root')).render(<Scene />);
