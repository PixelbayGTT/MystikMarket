import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, Search, X, Trash2, CreditCard, ShieldCheck, 
  Menu, Zap, Filter, ChevronDown, Info, Layers, User, 
  LogOut, Package, Settings, ClipboardList, ExternalLink,
  Clock, CheckCircle, Truck, XCircle, AlertTriangle, AlertCircle, Phone, MapPin, MessageCircle, Eye, Star,
  ArrowUpDown, Calendar, Save, Edit, Plus, Minus
} from 'lucide-react';

// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, collection, doc, getDoc, setDoc, addDoc, 
  updateDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, orderBy, increment 
} from "firebase/firestore";

// --- CONFIGURACIÓN ---
const EXCHANGE_RATE = 7.5; // Tasa de cambio: $1 USD = Q7.5

// --- CONFIGURACIÓN DEL BANNER ---
const BANNER_CONFIG = {
  show: true, 
  title: "¡Nuevas Llegadas: Ixalan!",
  subtitle: "Descubre los tesoros ocultos y dinosaurios legendarios.",
  buttonText: "Ver Colección",
  image: "https://cards.scryfall.io/art_crop/front/d/e/de434533-3d92-4f7f-94d7-0131495c0246.jpg?1699043960", 
  actionQuery: "set:lci" 
};

// ¡IMPORTANTE! Reemplaza estos valores con los de tu consola de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB3-ZfZpmJTbUvR9UeOFmn2F7oDnKz0WXQ",
  authDomain: "mystikmarket-1a296.firebaseapp.com",
  projectId: "mystikmarket-1a296",
  storageBucket: "mystikmarket-1a296.firebasestorage.app",
  messagingSenderId: "999199755166",
  appId: "1:999199755166:web:91351940643d6e72cd648f"
};

// Inicialización segura de Firebase
let app = null;
let auth = null;
let db = null;
let firebaseError = null;

const isConfigured = firebaseConfig.apiKey !== "TU_API_KEY";

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Error crítico inicializando Firebase:", e);
    firebaseError = e.message;
  }
}

// --- UTILIDADES GLOBALES ---
const getStockValue = (inventory, id, finish) => {
  if (!inventory || !id) return 0;
  return inventory[id]?.[finish] || 0;
};

// --- COMPONENTES UI ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = "button", title="" }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    outline: "bg-transparent border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10",
    success: "bg-green-600 hover:bg-green-500 text-white",
    whatsapp: "bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-900/20",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-300",
    white: "bg-white text-purple-900 hover:bg-slate-100 shadow-xl" 
  };
  return <button type={type} title={title} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>{children}</button>;
};

const Badge = ({ children, color = 'bg-blue-600' }) => (
  <span className={`${color} text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider`}>{children}</span>
);

const QuantitySelector = ({ qty, setQty, max, disabled }) => (
  <div className={`flex items-center bg-slate-900 rounded border border-slate-600 h-8 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <button 
      onClick={(e) => { e.stopPropagation(); setQty(Math.max(1, qty - 1)); }} 
      className="px-2 h-full hover:bg-slate-700 text-slate-400 rounded-l transition-colors"
      disabled={disabled || qty <= 1}
    ><Minus size={12} /></button>
    <div className="w-8 text-center text-xs text-white font-bold pointer-events-none">{qty}</div>
    <button 
      onClick={(e) => { e.stopPropagation(); setQty(Math.min(max, qty + 1)); }} 
      className="px-2 h-full hover:bg-slate-700 text-slate-400 rounded-r transition-colors"
      disabled={disabled || qty >= max}
    ><Plus size={12} /></button>
  </div>
);

// --- COMPONENTE DE CARTA INDIVIDUAL ---
const ProductCard = ({ card, cart, user, inventory, addToCart, openCardModal }) => {
  const [qtyNormal, setQtyNormal] = useState(1);
  const [qtyFoil, setQtyFoil] = useState(1);

  const pNormalUSD = card.prices?.usd;
  const pFoilUSD = card.prices?.usd_foil || card.prices?.usd_etched;
  
  const pNormal = pNormalUSD ? parseFloat(pNormalUSD) * EXCHANGE_RATE : null;
  const pFoil = pFoilUSD ? parseFloat(pFoilUSD) * EXCHANGE_RATE : null;

  const sNormal = getStockValue(inventory, card.id, 'normal');
  const sFoil = getStockValue(inventory, card.id, 'foil');
  
  const inCartN = cart.find(i => i.id === card.id && i.finish === 'normal')?.quantity || 0;
  const inCartF = cart.find(i => i.id === card.id && i.finish === 'foil')?.quantity || 0;

  const availableN = user?.role === 'admin' ? 999 : Math.max(0, sNormal - inCartN);
  const availableF = user?.role === 'admin' ? 999 : Math.max(0, sFoil - inCartF);

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 flex flex-col group relative hover:border-purple-500/50 transition-colors">
      <div className="relative aspect-[2.5/3.5] bg-black cursor-pointer" onClick={() => openCardModal(card)}>
        <img src={card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" alt="" />
        {card.reserved && <div className="absolute top-1 right-1 bg-yellow-600 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">RL</div>}
        {sNormal === 0 && sFoil === 0 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
            <span className="bg-red-600 text-white font-bold px-3 py-1 rounded text-xs uppercase -rotate-12 border-2 border-white">Agotado</span>
          </div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-bold text-white text-sm truncate" title={card.name}>{card.name}</h3>
        <p className="text-slate-400 text-xs mb-3 truncate">{card.set_name}</p>
        
        <div className="mt-auto space-y-2">
          {/* Fila Normal */}
          <div className={`p-2 rounded bg-slate-900/50 ${availableN <= 0 ? 'opacity-50' : ''}`}>
            <div className="flex justify-between items-center mb-1">
               <span className="text-[10px] text-slate-300">Normal</span>
               <span className={`text-[9px] ${sNormal > 0 ? 'text-green-400' : 'text-red-500'}`}>Stock: {sNormal}</span>
            </div>
            {pNormal ? (
              <div className="flex items-center justify-between gap-1">
                <span className="text-green-400 font-bold text-xs">Q{pNormal.toFixed(2)}</span>
                <div className="flex items-center gap-1">
                    {availableN > 0 && <QuantitySelector qty={qtyNormal} setQty={setQtyNormal} max={availableN} disabled={availableN <= 0} />}
                    <button 
                      onClick={(e) => { e.stopPropagation(); addToCart(card, 'normal', pNormalUSD, qtyNormal); setQtyNormal(1); }} 
                      disabled={availableN <= 0} 
                      className={`w-8 h-8 flex items-center justify-center rounded text-white transition-colors ${availableN <= 0 ? 'bg-slate-700 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`}
                    >
                      <ShoppingCart size={14}/>
                    </button>
                </div>
              </div>
            ) : <span className="text-slate-600 text-[10px] italic">No disponible</span>}
          </div>

          {/* Fila Foil */}
          <div className={`p-2 rounded border border-purple-500/20 bg-purple-900/10 ${availableF <= 0 ? 'opacity-50' : ''}`}>
             <div className="flex justify-between items-center mb-1">
               <div className="flex items-center gap-0.5"><Zap size={10} className="text-yellow-400" fill="currentColor"/><span className="text-[10px] text-purple-200">Foil</span></div>
               <span className={`text-[9px] ${sFoil > 0 ? 'text-green-400' : 'text-red-500'}`}>Stock: {sFoil}</span>
             </div>
             {pFoil ? (
               <div className="flex items-center justify-between gap-1">
                 <span className="text-green-400 font-bold text-xs">Q{pFoil.toFixed(2)}</span>
                 <div className="flex items-center gap-1">
                    {availableF > 0 && <QuantitySelector qty={qtyFoil} setQty={setQtyFoil} max={availableF} disabled={availableF <= 0} />}
                    <button 
                      onClick={() => { e.stopPropagation(); addToCart(card, 'foil', pFoilUSD, qtyFoil); setQtyFoil(1); }} 
                      disabled={availableF <= 0} 
                      className={`w-8 h-8 flex items-center justify-center rounded text-white transition-colors ${availableF <= 0 ? 'bg-slate-700 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500'}`}
                    >
                      <ShoppingCart size={14}/>
                    </button>
                 </div>
               </div>
             ) : <span className="text-slate-600 text-[10px] italic">No disponible</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE MODAL DE DETALLE DE CARTA ---
const ProductModal = ({ card, cart, user, inventory, onClose, onSearchRelated, addToCart }) => {
    const [qtyN, setQtyN] = useState(1);
    const [qtyF, setQtyF] = useState(1);

    const pNormalUSD = card.prices?.usd;
    const pFoilUSD = card.prices?.usd_foil || card.prices?.usd_etched;
    const pNormal = pNormalUSD ? parseFloat(pNormalUSD) * EXCHANGE_RATE : null;
    const pFoil = pFoilUSD ? parseFloat(pFoilUSD) * EXCHANGE_RATE : null;
    const sNormal = getStockValue(inventory, card.id, 'normal');
    const sFoil = getStockValue(inventory, card.id, 'foil');
    const inCartN = cart.find(i => i.id === card.id && i.finish === 'normal')?.quantity || 0;
    const inCartF = cart.find(i => i.id === card.id && i.finish === 'foil')?.quantity || 0;
    const avN = user?.role === 'admin' ? 999 : Math.max(0, sNormal - inCartN);
    const avF = user?.role === 'admin' ? 999 : Math.max(0, sFoil - inCartF);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
           <div className="bg-slate-900 p-6 rounded-xl max-w-4xl w-full flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="md:w-1/2 flex justify-center bg-black/20 rounded-xl p-4">
                 <img src={card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal} className="rounded-lg shadow-2xl max-h-[60vh] object-contain" alt=""/>
              </div>
              <div className="flex-1 flex flex-col">
                 <div className="flex justify-between items-start">
                    <h2 className="text-3xl font-bold text-white mb-2">{card.name}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X/></button>
                 </div>
                 <div className="flex gap-2 mb-4"><Badge>{card.set_name}</Badge><span className="text-slate-400 text-sm capitalize">{card.rarity}</span></div>
                 <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 text-slate-300 font-serif mb-6 text-sm overflow-y-auto max-h-40 custom-scrollbar">
                    {card.card_faces ? card.card_faces.map((f, i) => <div key={i} className="mb-2 last:mb-0"><strong className="block text-purple-300">{f.name}</strong><p>{f.oracle_text}</p></div>) : <p>{card.oracle_text}</p>}
                 </div>
                 <div className="mt-auto space-y-3">
                   <Button variant="outline" onClick={onSearchRelated} className="w-full justify-start border-slate-700 text-slate-300"><Layers size={16}/> Ver otras versiones</Button>
                   
                   {/* Normal Row Modal */}
                   <div className={`bg-slate-800 p-4 rounded-lg flex items-center justify-between ${avN <= 0 ? 'opacity-60' : ''}`}>
                      <div>
                        <p className="text-white font-bold">Normal</p>
                        <p className="text-xs text-green-400">Stock: {sNormal}</p>
                        {inCartN > 0 && <p className="text-[10px] text-purple-400">En carrito: {inCartN}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="text-xl font-bold text-white">{pNormal ? `Q${pNormal.toFixed(2)}` : '--'}</span>
                         {avN > 0 && <QuantitySelector qty={qtyN} setQty={setQtyN} max={avN} disabled={avN <= 0} />}
                         <Button disabled={!pNormal || avN <= 0} onClick={() => { addToCart(card, 'normal', pNormalUSD, qtyN); setQtyN(1); }}>Agregar</Button>
                      </div>
                   </div>
                   {/* Foil Row Modal */}
                   <div className={`bg-purple-900/20 border border-purple-500/20 p-4 rounded-lg flex items-center justify-between ${avF <= 0 ? 'opacity-60' : ''}`}>
                      <div>
                        <p className="text-purple-200 font-bold flex items-center gap-1"><Zap size={14}/> Foil</p>
                        <p className="text-xs text-green-400">Stock: {sFoil}</p>
                        {inCartF > 0 && <p className="text-[10px] text-purple-400">En carrito: {inCartF}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="text-xl font-bold text-purple-200">{pFoil ? `Q${pFoil.toFixed(2)}` : '--'}</span>
                         {avF > 0 && <QuantitySelector qty={qtyF} setQty={setQtyF} max={avF} disabled={avF <= 0} />}
                         <Button variant="secondary" disabled={!pFoil || avF <= 0} onClick={() => { addToCart(card, 'foil', pFoilUSD, qtyF); setQtyF(1); }}>Agregar</Button>
                      </div>
                   </div>
                 </div>
              </div>
           </div>
        </div>
    );
};

// --- Componente Principal ---

export default function App() {
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-red-500/10 border border-red-500 p-8 rounded-2xl max-w-lg">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Configuración Pendiente</h1>
          <p className="text-slate-300 mb-6">La aplicación no puede iniciar porque falta la conexión a Firebase.</p>
          <div className="bg-slate-900 p-4 rounded text-left text-sm font-mono text-slate-400 mb-6 overflow-x-auto">
            <p className="text-green-400">// Edita el archivo App.jsx:</p>
            <p>apiKey: "TU_API_KEY", <span className="text-yellow-500">&lt;-- REEMPLAZAR</span></p>
          </div>
        </div>
      </div>
    );
  }
  if (firebaseError) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center"><div className="text-red-400">Error: {firebaseError}</div></div>;

  // --- ESTADOS ---
  const [user, setUser] = useState(null); 
  const [userProfile, setUserProfile] = useState({}); 
  const [view, setView] = useState('store');
  const [inventory, setInventory] = useState({});
  const [orders, setOrders] = useState([]);
  const [permissionError, setPermissionError] = useState(false); 
  
  const [lastOrderId, setLastOrderId] = useState(null); 
  const [lastOrderTotal, setLastOrderTotal] = useState(0); 
  
  const [query, setQuery] = useState(''); 
  const [inputValue, setInputValue] = useState(''); 
  const [suggestions, setSuggestions] = useState([]); 
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [authForm, setAuthForm] = useState({ email: '', password: '', isRegister: false, error: '' });
  
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', address: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [setsList, setSetsList] = useState([]);
  const [activeSet, setActiveSet] = useState('');
  const [activeColor, setActiveColor] = useState(''); 
  const [sortOption, setSortOption] = useState('released'); 

  const wrapperRef = useRef(null);

  // --- MANEJO DE HISTORIAL ---
  useEffect(() => {
    const handlePopState = () => { if (selectedCard) setSelectedCard(null); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedCard]);

  const openCardModal = (card) => {
    window.history.pushState({ cardId: card.id }, '', `#${card.id}`);
    setSelectedCard(card);
  };
  const closeCardModal = () => window.history.back();
  const goHome = () => {
    if (selectedCard) setSelectedCard(null);
    if (window.location.hash) window.history.replaceState(null, '', ' ');
    setView('store'); 
    setQuery(''); 
    setInputValue(''); 
    setActiveSet(''); setActiveColor(''); setSortOption('released');
  };

  // --- SINCRONIZACIÓN FIREBASE ---
  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        let role = 'user';
        let profileData = {};
        if (db) {
          try {
            const snap = await getDoc(doc(db, "users", u.uid));
            if (snap.exists()) {
               const data = snap.data();
               role = data.role || 'user';
               profileData = data.profile || {};
            }
          } catch (e) { if (e.code === 'permission-denied') setPermissionError(true); }
        }
        setUser({ uid: u.uid, email: u.email, role });
        setUserProfile(profileData);
        setCheckoutForm({ name: profileData.name || '', email: u.email, phone: profileData.phone || '', address: profileData.address || '' });
        setProfileForm({ name: profileData.name || '', phone: profileData.phone || '', address: profileData.address || '' });
      } else {
        setUser(null);
        setUserProfile({});
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "inventory"), (s) => {
      const inv = {}; s.forEach(d => inv[d.id] = d.data()); setInventory(inv); setPermissionError(false);
    }, (e) => { if (e.code === 'permission-denied') setPermissionError(true); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!db || !user) return;
    const q = collection(db, "orders");
    const unsub = onSnapshot(q, (s) => {
      const all = s.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().date?.toDate ? d.data().date.toDate().toISOString() : new Date().toISOString() }));
      all.sort((a, b) => new Date(b.date) - new Date(a.date));
      if (user.role === 'admin') setOrders(all);
      else setOrders(all.filter(o => o.buyer?.uid === user.uid || o.buyer?.email === user.email));
    }, (e) => { if (e.code === 'permission-denied') setPermissionError(true); });
    return () => unsub();
  }, [user]);

  // Carga de Sets al inicio
  useEffect(() => {
    fetch('https://api.scryfall.com/sets')
      .then(res => res.json())
      .then(data => {
        if(data.data) {
          const relevantSets = data.data.filter(s => ['core', 'expansion', 'masters', 'commander'].includes(s.set_type));
          setSetsList(relevantSets);
        }
      });
      
    const handleClickOutside = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- FUNCIONES LÓGICAS ---
  const getStock = (id, finish) => getStockValue(inventory, id, finish);

  const updateStock = async (id, finish, val) => {
    if (!user || user.role !== 'admin' || !db) return;
    const qty = parseInt(val); if (isNaN(qty)) return;
    await setDoc(doc(db, "inventory", id), { [finish]: qty }, { merge: true });
  };

  const updateOrderStatus = async (oid, status) => { if (db) await updateDoc(doc(db, "orders", oid), { status }); };

  const deleteOrder = async (oid) => {
    if (!db || !window.confirm('¿Eliminar orden y restaurar stock?')) return;
    try {
      const ref = doc(db, "orders", oid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const batch = writeBatch(db);
      snap.data().items.forEach(i => batch.update(doc(db, "inventory", i.id), { [i.finish]: increment(i.quantity) }));
      batch.delete(ref);
      await batch.commit();
      if (selectedOrder?.id === oid) setSelectedOrder(null);
    } catch (e) { alert("Error: " + e.message); }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthForm({...authForm, error: ''});
    try {
      if (authForm.isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        if (db) await setDoc(doc(db, "users", cred.user.uid), { email: authForm.email, role: 'user', createdAt: serverTimestamp() });
      } else await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      setView('store');
    } catch (e) { setAuthForm({...authForm, error: e.message}); }
  };

  const saveProfile = async (e) => {
      e.preventDefault();
      if (!db || !user) return;
      try {
          await setDoc(doc(db, "users", user.uid), { profile: profileForm }, { merge: true });
          setUserProfile(profileForm);
          setCheckoutForm(prev => ({ ...prev, ...profileForm }));
          setIsEditingProfile(false);
          alert("Perfil actualizado correctamente.");
      } catch (e) { alert("Error al guardar perfil: " + e.message); }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!db) return alert("Sin conexión");
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const total = cart.reduce((a, i) => a + i.price * i.quantity, 0);
      for (const item of cart) {
        const ref = doc(db, "inventory", item.id);
        const snap = await getDoc(ref);
        const s = snap.exists() ? (snap.data()[item.finish] || 0) : 0;
        if (s < item.quantity) throw new Error(`Stock insuficiente: ${item.name}`);
        batch.update(ref, { [item.finish]: s - item.quantity });
      }
      const oid = `MM-${Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')}`;
      batch.set(doc(db, "orders", oid), {
        date: serverTimestamp(),
        buyer: { ...checkoutForm, uid: user?.uid || 'guest', email: user?.email || checkoutForm.email },
        items: cart, total, status: 'pendiente'
      });
      await batch.commit();
      setLastOrderId(oid); setLastOrderTotal(total); setCart([]); setView('success');
    } catch (e) { alert(e.message); } finally { setLoading(false); }
  };

  // --- API SCRYFALL ---
  const fetchCards = async (overrideQuery = null) => {
    setLoading(true);
    try {
      let url = 'https://api.scryfall.com/cards/search?';
      let qParts = [];
      const textQuery = overrideQuery || query;
      if (textQuery) qParts.push(textQuery);
      if (activeSet && !textQuery.includes('set:')) qParts.push(`set:${activeSet}`);
      if (activeColor && !textQuery.includes('c:')) {
         if (activeColor === 'm') qParts.push('is:multicolor');
         else if (activeColor === 'c') qParts.push('c:c');
         else qParts.push(`c:${activeColor}`);
      }
      
      const isFiltering = activeSet || activeColor;
      if (!textQuery && !isFiltering) { setLoading(false); return; }

      url += `q=${encodeURIComponent(qParts.join(' '))}`;
      if (sortOption === 'name') url += '&order=name';
      else if (sortOption === 'usd_asc') url += '&order=usd&dir=asc';
      else if (sortOption === 'usd_desc') url += '&order=usd&dir=desc';
      else if (sortOption === 'released') url += '&order=released';

      if (textQuery && !textQuery.includes('unique:prints')) url += '&unique=prints';
      const res = await fetch(url);
      const json = await res.json();
      setCards(json.data?.filter(c => c.image_uris || c.card_faces) || []);
    } catch (e) { console.error(e); setCards([]); }
    finally { setLoading(false); }
  };

  // --- EFECTO MAESTRO DE CARGA DE CARTAS ---
  useEffect(() => {
    if (query.trim() !== '') { fetchCards(); return; }
    if (activeSet || activeColor) { fetchCards(); return; }

    const inStockIds = Object.keys(inventory).filter(id => {
      const item = inventory[id];
      return (item.normal > 0 || item.foil > 0);
    });

    if (inStockIds.length > 0) {
      setLoading(true);
      const batchIds = inStockIds.slice(0, 75).map(id => ({ id }));
      fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: batchIds })
      })
      .then(res => res.json())
      .then(data => {
        let loadedCards = data.data || [];
        if (sortOption === 'name') loadedCards.sort((a,b) => a.name.localeCompare(b.name));
        else if (sortOption === 'released') loadedCards.sort((a,b) => new Date(b.released_at) - new Date(a.released_at));
        else if (sortOption.includes('usd')) {
           loadedCards.sort((a,b) => {
              const pA = parseFloat(a.prices.usd || 0), pB = parseFloat(b.prices.usd || 0);
              return sortOption === 'usd_asc' ? pA - pB : pB - pA;
           });
        }
        setCards(loadedCards);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    } else {
      setCards([]);
      if (Object.keys(inventory).length === 0) setLoading(false);
    }
  }, [inventory, query, activeSet, activeColor, sortOption]);

  const handleInputChange = (e) => {
    const val = e.target.value; 
    setInputValue(val); // Solo actualiza el visual
    if(val.length > 2) {
      fetch(`https://api.scryfall.com/cards/autocomplete?q=${val}`)
        .then(r=>r.json())
        .then(d=> {
           setSuggestions(d.data||[]);
           setShowSuggestions(true);
        });
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSearchSubmit = (e) => {
      e.preventDefault();
      setQuery(inputValue); 
      setShowSuggestions(false);
  };

  const selectSuggestion = (name) => {
    setInputValue(name);
    setQuery(name);
    setShowSuggestions(false);
  };

  // --- LÓGICA DE CARRITO MEJORADA ---
  const addToCart = (card, finish, priceUSD, quantityToAdd = 1) => {
    const stock = getStockValue(inventory, card.id, finish);
    const inCartItem = cart.find(i => i.id === card.id && i.finish === finish);
    const inCartQty = inCartItem?.quantity || 0;
    
    if ((inCartQty + quantityToAdd) > stock && user?.role !== 'admin') {
       alert(`Solo hay ${stock} disponibles. Ya tienes ${inCartQty} en el carrito.`);
       return;
    }

    const priceQ = parseFloat(priceUSD) * EXCHANGE_RATE;

    setCart(prev => {
      const exists = prev.find(i => i.id === card.id && i.finish === finish);
      if (exists) return prev.map(i => i === exists ? { ...i, quantity: i.quantity + quantityToAdd } : i);
      const img = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
      return [...prev, { id: card.id, name: card.name, set: card.set_name, collector_number: card.collector_number, image: img, finish, price: priceQ, quantity: quantityToAdd }];
    });
    setIsCartOpen(true);
  };

  const updateCartQuantity = (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty <= 0) return setCart(prev => prev.filter(i => i !== item));
    if (newQty > getStockValue(inventory, item.id, item.finish) && user?.role !== 'admin') return alert("Sin stock.");
    setCart(prev => prev.map(i => i === item ? { ...i, quantity: newQty } : i));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  // --- VISTAS ---

  const renderBanner = () => {
    if (!BANNER_CONFIG.show) return null;
    return (
      <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-8 group shadow-2xl border border-purple-500/20">
        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 bg-slate-800" style={{ backgroundImage: `url('${BANNER_CONFIG.image}')` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent flex flex-col justify-center p-12 md:p-16">
            <div className="max-w-2xl animate-in slide-in-from-left duration-700">
               <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight drop-shadow-lg">{BANNER_CONFIG.title}</h1>
               <p className="text-base md:text-lg text-slate-300 mb-6 max-w-lg drop-shadow-md">{BANNER_CONFIG.subtitle}</p>
               <div className="flex mt-6"><Button variant="white" onClick={() => { setQuery(BANNER_CONFIG.actionQuery); }} className="px-6 py-2 text-sm font-bold">{BANNER_CONFIG.buttonText}</Button></div>
            </div>
        </div>
      </div>
    );
  };

  const renderFilters = () => (
    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl mb-8 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-20 z-30 backdrop-blur-md shadow-lg">
      <div className="w-full md:w-1/3">
        <select className="w-full bg-slate-800 text-slate-200 text-sm border border-slate-700 rounded-lg p-2.5 focus:border-purple-500 outline-none" value={activeSet} onChange={(e) => setActiveSet(e.target.value)}>
          <option value="">Todas las Expansiones</option>
          {setsList.map(s => <option key={s.id} value={s.code}>{s.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        {[{ id: 'w', bg: 'bg-[#f8e7b9]', border: 'border-yellow-200' }, { id: 'u', bg: 'bg-[#b3ceea]', border: 'border-blue-300' }, { id: 'b', bg: 'bg-[#a69f9d]', border: 'border-slate-400' }, { id: 'r', bg: 'bg-[#eb9f82]', border: 'border-red-300' }, { id: 'g', bg: 'bg-[#c4d3ca]', border: 'border-green-200' }, { id: 'c', bg: 'bg-[#ccc2c0]', border: 'border-gray-400', label: 'C' }, { id: 'm', bg: 'bg-gradient-to-br from-yellow-200 via-red-300 to-blue-300', border: 'border-purple-300', label: 'M' }].map(color => (
          <button key={color.id} onClick={() => setActiveColor(activeColor === color.id ? '' : color.id)} className={`w-8 h-8 rounded-full ${color.bg} border-2 ${color.border} flex items-center justify-center transition-all transform hover:scale-110 ${activeColor === color.id ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-70 hover:opacity-100'}`} title={`Filtrar por ${color.id.toUpperCase()}`}>
            {color.label && <span className="text-black font-bold text-xs">{color.label}</span>}
          </button>
        ))}
      </div>
      <div className="w-full md:w-auto flex items-center gap-2">
        <ArrowUpDown size={16} className="text-slate-500"/>
        <select className="bg-slate-800 text-slate-200 text-sm border border-slate-700 rounded-lg p-2.5 focus:border-purple-500 outline-none" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
          <option value="released">Lanzamiento (Nuevo a Viejo)</option>
          <option value="name">Nombre (A-Z)</option>
          <option value="usd_asc">Precio (Bajo a Alto)</option>
          <option value="usd_desc">Precio (Alto a Bajo)</option>
        </select>
      </div>
    </div>
  );

  const renderCheckout = () => (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3"><ShieldCheck className="text-green-500" size={32} /> Finalizar Compra</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-fit">
            <h3 className="text-xl font-bold text-slate-200 mb-4">Resumen del Pedido</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {cart.map((item, idx) => (
                <div key={idx} className="flex gap-4 items-center border-b border-slate-700 pb-4">
                    <img src={item.image} alt={item.name} className="w-12 h-16 object-cover rounded" />
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{item.name}</p>
                      <div className="text-slate-400 text-xs flex flex-col">
                        <span>{item.set}</span>
                        <span className="flex items-center gap-1">{item.finish === 'foil' && <Zap size={10} className="text-yellow-400" fill="currentColor" />}{item.finish === 'foil' ? 'Foil' : 'Normal'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-300 text-xs">x{item.quantity}</p>
                      <p className="text-white font-bold">Q{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                </div>
                ))}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-600 flex justify-between items-center text-xl font-bold text-white"><span>Total</span><span className="text-green-400">Q{cartTotal.toFixed(2)}</span></div>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-bold text-slate-200 mb-4">Datos de Envío</h3>
            <form onSubmit={handleCheckout} className="space-y-4">
                <div><label className="block text-slate-400 text-sm mb-1">Nombre Completo</label><input required type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={checkoutForm.name} onChange={e => setCheckoutForm({...checkoutForm, name: e.target.value})} /></div>
                <div><label className="block text-slate-400 text-sm mb-1">Teléfono / WhatsApp</label><input required type="tel" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={checkoutForm.phone} onChange={e => setCheckoutForm({...checkoutForm, phone: e.target.value})} placeholder="5555-5555" /></div>
                <div><label className="block text-slate-400 text-sm mb-1">Email</label><input required type="email" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={checkoutForm.email} onChange={e => setCheckoutForm({...checkoutForm, email: e.target.value})} /></div>
                <div><label className="block text-slate-400 text-sm mb-1">Dirección de Entrega</label><textarea required className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white h-24" value={checkoutForm.address} onChange={e => setCheckoutForm({...checkoutForm, address: e.target.value})} /></div>
                <Button type="submit" variant="success" className="w-full mt-6 py-3" disabled={loading}>{loading ? 'Procesando...' : `Confirmar Pedido (Q${cartTotal.toFixed(2)})`}</Button>
                <Button variant="secondary" onClick={() => setView('store')} className="w-full mt-2" type="button">Cancelar</Button>
            </form>
        </div>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce"><CheckCircle size={48} className="text-white" /></div>
      <h2 className="text-4xl font-bold text-white mb-2">¡Orden Ingresada!</h2>
      <p className="text-slate-400 mb-8 text-lg">Tu pedido #{lastOrderId} ha sido reservado.</p>
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-md w-full mb-8">
        <h3 className="text-white font-bold mb-4">Siguiente Paso: Realizar Pago</h3>
        <p className="text-slate-400 text-sm mb-6">Para confirmar tu pedido y coordinar el envío, envíanos un mensaje por WhatsApp con el detalle de tu orden.</p>
        <a href={`https://wa.me/50246903693?text=Hola, orden %23${lastOrderId}. Nombre: ${checkoutForm.name}. Total: Q${lastOrderTotal.toFixed(2)}.`} target="_blank" rel="noopener noreferrer" className="w-full block">
          <Button variant="whatsapp" className="w-full py-3 text-lg"><MessageCircle size={24} /> Enviar mensaje a WhatsApp</Button>
        </a>
      </div>
      <Button onClick={() => setView('store')} variant="secondary">Volver a la Tienda</Button>
    </div>
  );

  const renderOrderModal = () => {
    if (!selectedOrder) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setSelectedOrder(null)}>
        <div className="bg-slate-900 rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-700 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
            <div><h2 className="text-2xl font-bold text-white">Orden #{selectedOrder.id}</h2><p className="text-slate-400 text-sm">{new Date(selectedOrder.date).toLocaleString()}</p></div>
            <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-white"><X size={24}/></button>
          </div>
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h3 className="text-purple-400 font-bold mb-3 flex items-center gap-2"><User size={18}/> Cliente</h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <p><span className="text-slate-500 block text-xs uppercase">Nombre</span> {selectedOrder.buyer.name}</p>
                  <p><span className="text-slate-500 block text-xs uppercase">Email</span> {selectedOrder.buyer.email}</p>
                  <p><span className="text-slate-500 block text-xs uppercase">Teléfono</span> {selectedOrder.buyer.phone || 'No especificado'}</p>
                </div>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <h3 className="text-purple-400 font-bold mb-3 flex items-center gap-2"><Truck size={18}/> Envío</h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <p><span className="text-slate-500 block text-xs uppercase">Dirección</span> {selectedOrder.buyer.address}</p>
                  <p><span className="text-slate-500 block text-xs uppercase">Estado</span> <Badge color="bg-blue-600">{selectedOrder.status}</Badge></p>
                </div>
              </div>
            </div>
            <h3 className="text-white font-bold mb-4">Productos</h3>
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden mb-6">
              {selectedOrder.items.map((item, i) => (
                <div key={i} className="flex gap-4 p-4 border-b border-slate-700 last:border-0 items-center">
                  <img src={item.image} alt="" className="w-12 h-16 object-cover rounded bg-black"/>
                  <div className="flex-1"><p className="text-white font-bold text-sm">{item.name}</p><p className="text-slate-400 text-xs">{item.set} • {item.finish === 'foil' ? 'Foil' : 'Normal'}</p></div>
                  <div className="text-right"><p className="text-slate-300 text-xs">x{item.quantity}</p><p className="text-white font-bold text-sm">Q{item.price.toFixed(2)}</p></div>
                </div>
              ))}
            </div>
            <div className="flex justify-end items-center gap-4 text-xl"><span className="text-slate-400">Total:</span><span className="text-green-400 font-bold">Q{selectedOrder.total.toFixed(2)}</span></div>
          </div>
          <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-end gap-2">
             <Button variant="secondary" onClick={() => setSelectedOrder(null)}>Cerrar</Button>
             <Button variant="danger" onClick={() => deleteOrder(selectedOrder.id)}>Eliminar Orden</Button>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminOrders = () => (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3"><ClipboardList className="text-purple-500" /> Órdenes Recientes</h2>
      <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-900 text-slate-200 uppercase font-bold">
              <tr><th className="p-4">Fecha/Cliente</th><th className="p-4">Total</th><th className="p-4">Estado</th><th className="p-4 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4"><div className="text-xs text-slate-500 mb-1">{new Date(order.date).toLocaleString()}</div><div className="text-white font-medium">{order.buyer.name}</div><div className="text-xs">{order.buyer.email}</div><div className="text-xs font-mono text-purple-400 mt-1">{order.id}</div></td>
                  <td className="p-4 text-green-400 font-bold">Q{order.total.toFixed(2)}</td>
                  <td className="p-4"><select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value)} className="bg-slate-900 border border-slate-700 text-xs rounded p-1 text-white focus:border-purple-500 outline-none"><option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="enviado">Enviado</option><option value="entregado">Entregado</option><option value="cancelado">Cancelado</option></select></td>
                  <td className="p-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => setSelectedOrder(order)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"><Eye size={18} /></button><button onClick={() => deleteOrder(order.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"><Trash2 size={18} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAdminInventory = () => (
    <div className="max-w-7xl mx-auto p-4">
      <div className="mb-6 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2"><Package className="text-blue-500"/> Gestión de Inventario</h2>
        <p className="text-slate-400 text-sm mb-4">Busca cartas en Scryfall para añadirlas a tu stock local.</p>
        <form onSubmit={(e) => { e.preventDefault(); fetchCards(query, true); }} className="flex gap-2">
          <div className="flex-1 relative" ref={wrapperRef}>
            <input type="text" placeholder="Buscar carta para stock..." className="w-full bg-slate-950 border border-slate-600 text-white rounded-lg px-4 py-2 focus:border-purple-500 outline-none" value={inputValue} onChange={handleInputChange} />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">{suggestions.map((s, i) => <button key={i} type="button" onClick={() => selectSuggestion(s)} className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-300 border-b border-slate-800 last:border-0">{s}</button>)}</div>
            )}
          </div>
          <Button type="submit">Buscar</Button>
        </form>
      </div>
      {loading ? <div className="text-center p-8">Cargando...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map(card => {
             const sN = getStock(card.id, 'normal'); const sF = getStock(card.id, 'foil');
             return (
               <div key={card.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col gap-3">
                 <div className="flex gap-3">
                   <img src={card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal} className="w-16 h-24 object-cover rounded bg-black" alt="" />
                   <div className="flex-1 min-w-0"><h3 className="font-bold text-white text-sm truncate" title={card.name}>{card.name}</h3><p className="text-slate-400 text-xs truncate">{card.set_name}</p><p className="text-slate-500 text-xs mt-1">#{card.collector_number} • {card.rarity}</p></div>
                 </div>
                 <div className="bg-slate-900/50 p-3 rounded space-y-3">
                   <div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-300 w-12">Normal</span><div className="flex items-center gap-1 bg-slate-800 rounded border border-slate-600 px-1"><button onClick={() => updateStock(card.id, 'normal', sN - 1)} className="text-slate-400 hover:text-white px-2">-</button><input className="w-10 bg-transparent text-center text-white text-sm outline-none font-bold" value={sN} onChange={(e) => updateStock(card.id, 'normal', e.target.value)} /><button onClick={() => updateStock(card.id, 'normal', sN + 1)} className="text-slate-400 hover:text-white px-2">+</button></div></div>
                   <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1 w-12"><Zap size={10} className="text-yellow-500" /><span className="text-xs text-slate-300">Foil</span></div><div className="flex items-center gap-1 bg-slate-800 rounded border border-purple-500/30 px-1"><button onClick={() => updateStock(card.id, 'foil', sF - 1)} className="text-slate-400 hover:text-white px-2">-</button><input className="w-10 bg-transparent text-center text-white text-sm outline-none font-bold" value={sF} onChange={(e) => updateStock(card.id, 'foil', e.target.value)} /><button onClick={() => updateStock(card.id, 'foil', sF + 1)} className="text-slate-400 hover:text-white px-2">+</button></div></div>
                 </div>
               </div>
             );
          })}
        </div>
      )}
    </div>
  );

  const renderLogin = () => (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">{authForm.isRegister ? "Crear Cuenta" : "Iniciar Sesión"}</h2>
        {authForm.error && <div className="bg-red-500/20 text-red-200 p-3 rounded mb-4 text-sm">{authForm.error}</div>}
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" placeholder="Email" className="w-full bg-slate-900 border border-slate-600 rounded p-2" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} required />
          <input type="password" placeholder="Contraseña" className="w-full bg-slate-900 border border-slate-600 rounded p-2" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} required />
          <Button type="submit" className="w-full">{authForm.isRegister ? "Registrarse" : "Entrar"}</Button>
        </form>
        <p className="text-center mt-4 text-sm cursor-pointer text-purple-400" onClick={() => setAuthForm({...authForm, isRegister: !authForm.isRegister, error: ''})}>{authForm.isRegister ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}</p>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="mb-8 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg">{user?.email?.charAt(0).toUpperCase()}</div>
            <div>
                <h2 className="text-3xl font-bold text-white">Mi Perfil</h2>
                <p className="text-slate-400">{user?.email}</p>
                {user?.role === 'admin' && <Badge color="bg-yellow-600">Administrador</Badge>}
            </div>
        </div>
        <Button variant="outline" onClick={() => setIsEditingProfile(!isEditingProfile)}>{isEditingProfile ? 'Cancelar Edición' : 'Editar Información'}</Button>
      </div>

      {isEditingProfile && (
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8 animate-in slide-in-from-top">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Edit size={18}/> Editar Datos Personales</h3>
            <form onSubmit={saveProfile} className="space-y-4">
                <div><label className="block text-slate-400 text-sm mb-1">Nombre Completo</label><input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} /></div>
                <div><label className="block text-slate-400 text-sm mb-1">Teléfono</label><input type="tel" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} /></div>
                <div><label className="block text-slate-400 text-sm mb-1">Dirección Predeterminada</label><textarea className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white h-20" value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: e.target.value})} /></div>
                <div className="flex justify-end"><Button type="submit" variant="success"><Save size={18} className="mr-2"/> Guardar Cambios</Button></div>
            </form>
        </div>
      )}

      {/* Vista de datos actuales (si no edita) */}
      {!isEditingProfile && (userProfile.name || userProfile.phone || userProfile.address) && (
         <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
             <div><span className="block text-slate-500 text-xs uppercase mb-1">Nombre</span><span className="text-white font-medium">{userProfile.name || '-'}</span></div>
             <div><span className="block text-slate-500 text-xs uppercase mb-1">Teléfono</span><span className="text-white font-medium">{userProfile.phone || '-'}</span></div>
             <div><span className="block text-slate-500 text-xs uppercase mb-1">Dirección</span><span className="text-white font-medium">{userProfile.address || '-'}</span></div>
         </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="p-6 border-b border-slate-700 bg-slate-900/50"><h3 className="text-xl font-bold text-white flex items-center gap-2"><Clock size={20} className="text-purple-400"/> Historial de Pedidos</h3></div>
          {orders.length === 0 ? <div className="p-12 text-center text-slate-500"><Package size={48} className="mx-auto mb-4 opacity-20"/><p>No has realizado ningún pedido todavía.</p><Button variant="outline" onClick={() => setView('store')} className="mt-4 mx-auto">Ir a la Tienda</Button></div> : (
              <div className="divide-y divide-slate-700">
                  {orders.map(order => (
                      <div key={order.id} className="p-6 hover:bg-slate-750 transition-colors">
                          <div className="flex flex-wrap justify-between items-start mb-4 gap-4"><div><div className="flex items-center gap-2 mb-1"><span className="text-lg font-bold text-white">Pedido #{order.id.substring(0, 8)}...</span><Badge color={order.status === 'pagado' ? 'bg-green-600' : order.status === 'cancelado' ? 'bg-red-600' : order.status === 'enviado' ? 'bg-blue-600' : 'bg-yellow-600'}>{order.status}</Badge></div><p className="text-sm text-slate-400">{new Date(order.date).toLocaleString()}</p></div><div className="text-right"><p className="text-sm text-slate-400">Total</p><p className="text-xl font-bold text-green-400">Q{order.total.toFixed(2)}</p></div></div>
                          <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 border border-slate-700/50">
                              {order.items.map((item, i) => <div key={i} className="flex items-center gap-3"><img src={item.image} alt="" className="w-8 h-10 object-cover rounded bg-black"/><div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-200 truncate">{item.name}</p><div className="flex items-center gap-2 text-xs text-slate-500"><span>{item.set}</span><span className="flex items-center gap-1">{item.finish === 'foil' && <Zap size={10} className="text-yellow-500"/>}{item.finish === 'foil' ? 'Foil' : 'Normal'}</span></div></div><div className="text-right"><span className="text-xs text-slate-400">x{item.quantity}</span><span className="block text-sm font-bold text-slate-300">Q{item.price.toFixed(2)}</span></div></div>)}
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20">
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer font-bold text-xl text-white" onClick={goHome}>
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-[0_0_15px_rgba(147,51,234,0.5)]">M</div>
          <span className="hidden sm:block">MysticMarket</span>
        </div>
        {view === 'store' && (
          <div className="flex-1 max-w-md mx-4 relative" ref={wrapperRef}>
            <form onSubmit={handleSearchSubmit} className="relative">
              <input className="w-full bg-slate-950 border border-slate-700 rounded-full py-1.5 px-4 text-sm focus:border-purple-500 outline-none" placeholder="Buscar cartas..." value={inputValue} onChange={handleInputChange} onFocus={() => inputValue.length > 2 && setShowSuggestions(true)} />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"><Search size={16}/></button>
            </form>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full w-full bg-slate-900 border border-slate-700 rounded mt-1 z-50 max-h-60 overflow-y-auto">{suggestions.map((s, i) => <div key={i} onClick={() => selectSuggestion(s)} className="p-2 hover:bg-slate-800 cursor-pointer text-sm">{s}</div>)}</div>
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.role === 'admin' && (
                <div className="hidden md:flex gap-2">
                  <Button variant="secondary" onClick={() => setView('admin-inventory')} className="text-xs py-1"><Package size={14}/> Stock</Button>
                  <Button variant="secondary" onClick={() => setView('admin-orders')} className="text-xs py-1"><ClipboardList size={14}/> Órdenes</Button>
                </div>
              )}
              <button onClick={() => setView('profile')} className="text-sm hover:text-white">{user.email.split('@')[0]}</button>
              <button onClick={() => { signOut(auth); setView('store'); }}><LogOut size={18}/></button>
            </>
          ) : <button onClick={() => setView('login')} className="text-sm flex items-center gap-1 hover:text-white"><User size={18}/> Entrar</button>}
          <button className="relative p-2" onClick={() => setIsCartOpen(true)}>
            <ShoppingCart size={22} className={cart.length ? "text-purple-400" : ""} />
            {cart.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{cart.length}</span>}
          </button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {permissionError && (
          <div className="bg-red-500/10 border border-red-500 text-white p-6 rounded-xl mb-8 shadow-2xl flex items-center gap-3">
             <AlertTriangle className="text-red-500" size={24}/><p>Acceso Bloqueado por Firebase. Revisa las reglas.</p>
          </div>
        )}

        {view === 'store' && (
          <>
            {!query && !activeSet && !activeColor && renderBanner()}
            {renderFilters()}

            {loading && <div className="text-center py-12">Cargando cartas...</div>}
            
            {!loading && cards.length === 0 && !query && !activeSet && !activeColor && (
               <div className="text-center py-20 text-slate-500">
                  <Package size={48} className="mx-auto mb-4 opacity-20"/>
                  <p className="text-xl font-bold mb-2">Inventario Vacío</p>
                  <p>Aún no hay cartas con stock en la tienda.</p>
                  <p className="text-sm mt-2">Usa los filtros o el buscador para ver todo el catálogo de Magic.</p>
               </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {cards.map((card) => <ProductCard key={card.id} card={card} cart={cart} user={user} inventory={inventory} addToCart={addToCart} openCardModal={openCardModal} />)}
            </div>
          </>
        )}

        {view === 'login' && renderLogin()}
        {view === 'admin-inventory' && user?.role === 'admin' && renderAdminInventory()}
        {view === 'admin-orders' && user?.role === 'admin' && renderAdminOrders()}
        {view === 'profile' && user && renderProfile()}
        {view === 'checkout' && renderCheckout()}
        {view === 'success' && renderSuccess()}
      </main>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-slate-900 h-full p-4 flex flex-col border-l border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Carrito ({cart.length})</h2>
              <button onClick={() => setIsCartOpen(false)}><X className="text-slate-400"/></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              {cart.map((item, i) => (
                <div key={i} className="bg-slate-800 p-3 rounded flex gap-3 border border-slate-700">
                  <img src={item.image} className="w-12 h-16 bg-black rounded object-cover" alt=""/>
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 mb-2">{item.set} • {item.finish}</p>
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2 bg-slate-900 rounded p-1">
                        <button onClick={() => updateCartQuantity(item, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 text-slate-300 rounded">-</button>
                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item, 1)} disabled={item.quantity >= getStock(item.id, item.finish) && user?.role !== 'admin'} className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 text-slate-300 rounded disabled:opacity-30">+</button>
                      </div>
                      <p className="text-green-400 text-sm font-bold">Q{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                  <button onClick={() => setCart(c => c.filter((_, idx) => idx !== i))} className="text-red-500 self-start"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-slate-700">
              <div className="flex justify-between text-white font-bold mb-4 text-xl"><span>Total</span><span>Q{cart.reduce((a,c) => a + c.price * c.quantity, 0).toFixed(2)}</span></div>
              {user ? <Button className="w-full py-3" onClick={() => { setIsCartOpen(false); setView('checkout'); }}>Completar Pedido</Button> : <Button className="w-full py-3" variant="secondary" onClick={() => { setIsCartOpen(false); setView('login'); }}>Inicia Sesión para Pagar</Button>}
            </div>
          </div>
        </div>
      )}
      
      {selectedCard && (
        <ProductModal 
          card={selectedCard} 
          cart={cart} 
          user={user} 
          inventory={inventory} 
          onClose={closeCardModal} 
          onSearchRelated={() => { setQuery(selectedCard.name); setInputValue(selectedCard.name); closeCardModal(); fetchCards(); }} 
          addToCart={addToCart} 
        />
      )}
      {renderOrderModal()}
    </div>
  );
}