import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, Search, X, Trash2, CreditCard, ShieldCheck, 
  Menu, Zap, Filter, ChevronDown, Info, Layers, User, 
  LogOut, Package, Settings, ClipboardList, ExternalLink,
  Clock, CheckCircle, Truck, XCircle, AlertTriangle, AlertCircle
} from 'lucide-react';

// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, collection, doc, getDoc, setDoc, addDoc, 
  updateDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, orderBy 
} from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE ---
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
let app, auth, db;
const isConfigured = firebaseConfig.apiKey !== "TU_API_KEY";

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Error inicializando Firebase:", e);
  }
}

// --- Componentes UI ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = "button" }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    outline: "bg-transparent border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10",
    success: "bg-green-600 hover:bg-green-500 text-white",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-300"
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>{children}</button>;
};

const Badge = ({ children, color = 'bg-blue-600' }) => (
  <span className={`${color} text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider`}>{children}</span>
);

// --- Componente Principal ---

export default function App() {
  // Si no está configurado, mostramos pantalla de ayuda
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-red-500/10 border border-red-500 p-8 rounded-2xl max-w-lg">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Configuración Pendiente</h1>
          <p className="text-slate-300 mb-6">
            La aplicación no puede iniciar porque falta la conexión a Firebase.
          </p>
          <div className="bg-slate-900 p-4 rounded text-left text-sm font-mono text-slate-400 mb-6 overflow-x-auto">
            <p className="text-green-400">// Edita el archivo App.jsx y busca:</p>
            <p>const firebaseConfig = &#123;</p>
            <p>&nbsp;&nbsp;apiKey: "TU_API_KEY", <span className="text-yellow-500">&lt;-- CAMBIAR ESTO</span></p>
            <p>&#125;;</p>
          </div>
        </div>
      </div>
    );
  }

  // --- ESTADOS ---
  const [user, setUser] = useState(null); 
  const [view, setView] = useState('store');
  const [inventory, setInventory] = useState({});
  const [orders, setOrders] = useState([]);
  const [permissionError, setPermissionError] = useState(false); // Estado para detectar bloqueo de Firebase
  
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]); 
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', address: '' });
  const [authForm, setAuthForm] = useState({ email: '', password: '', isRegister: false, error: '' });

  const wrapperRef = useRef(null);

  // --- SINCRONIZACIÓN FIREBASE ---

  // 1. Autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let role = 'user';
        try {
          const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userSnap.exists()) {
            role = userSnap.data().role || 'user';
          }
        } catch (e) {
          console.warn("No se pudo leer el rol, asignando default 'user'", e);
          if (e.code === 'permission-denied') setPermissionError(true);
        }
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role });
        setCheckoutForm(prev => ({ ...prev, email: firebaseUser.email }));
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Inventario
  useEffect(() => {
    const q = collection(db, "inventory");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inv = {};
      snapshot.forEach(doc => inv[doc.id] = doc.data());
      setInventory(inv);
      setPermissionError(false); // Si tiene éxito, limpiamos el error
    }, (error) => {
      console.error("Error inventario:", error);
      if (error.code === 'permission-denied') setPermissionError(true);
    });
    return () => unsubscribe();
  }, []);

  // 3. Órdenes
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate ? doc.data().date.toDate().toISOString() : new Date().toISOString()
      }));
      
      if (user.role === 'admin') {
        setOrders(allOrders);
      } else {
        setOrders(allOrders.filter(o => o.buyer.uid === user.uid || o.buyer.email === user.email));
      }
    }, (error) => {
      if (error.code === 'permission-denied') setPermissionError(true);
    });
    return () => unsubscribe();
  }, [user]);

  // Carga inicial
  useEffect(() => {
    fetchCards('format:commander year>=2023', false);
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- FUNCIONES ---

  const getStock = (id, finish) => inventory[id]?.[finish] || 0;

  const updateStock = async (id, finish, val) => {
    if (!user || user.role !== 'admin') return;
    const qty = parseInt(val);
    if (isNaN(qty)) return;
    try {
      await setDoc(doc(db, "inventory", id), { [finish]: qty }, { merge: true });
    } catch (e) { alert("Error guardando stock: " + e.message); }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
    } catch (e) { console.error(e); alert("Error al actualizar estado"); }
  };

  const deleteOrder = async (orderId) => {
    if (!db) return;
    if (window.confirm('¿Eliminar orden permanentemente? Esto no restaura el stock.')) {
      try {
        await deleteDoc(doc(db, "orders", orderId));
      } catch (e) { console.error(e); alert("Error al eliminar"); }
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthForm({ ...authForm, error: '' });
    try {
      if (authForm.isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        await setDoc(doc(db, "users", cred.user.uid), {
          email: authForm.email,
          role: 'user',
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
      setView('store');
    } catch (error) {
      console.error(error);
      let msg = "Error desconocido.";
      if (error.code === 'auth/email-already-in-use') msg = "Este correo ya está registrado.";
      if (error.code === 'auth/weak-password') msg = "La contraseña debe tener al menos 6 caracteres.";
      if (error.code === 'auth/invalid-credential') msg = "Correo o contraseña incorrectos.";
      setAuthForm({ ...authForm, error: msg });
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      for (const item of cart) {
        const ref = doc(db, "inventory", item.id);
        const snap = await getDoc(ref);
        const stock = snap.exists() ? (snap.data()[item.finish] || 0) : 0;
        
        if (stock < item.quantity) throw new Error(`Stock insuficiente: ${item.name} (${item.finish})`);
        batch.update(ref, { [item.finish]: stock - item.quantity });
      }

      const orderRef = doc(collection(db, "orders"));
      batch.set(orderRef, {
        date: serverTimestamp(),
        buyer: { ...checkoutForm, uid: user?.uid || 'guest', email: user?.email || checkoutForm.email },
        items: cart,
        total: cart.reduce((acc, i) => acc + i.price * i.quantity, 0),
        status: 'pendiente'
      });

      await batch.commit();
      setCart([]);
      setView('success');
    } catch (e) {
      alert("Error en la compra: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCards = async (qStr, isUser) => {
    if (!qStr) return;
    setLoading(true);
    try {
      const params = isUser 
        ? `q=${encodeURIComponent(qStr + " unique:prints")}&order=released`
        : `q=${encodeURIComponent(qStr)}&order=edhrec`;
      const res = await fetch(`https://api.scryfall.com/cards/search?${params}`);
      const json = await res.json();
      setCards(json.data?.filter(c => c.image_uris || c.card_faces) || []);
    } catch (e) { console.error(e); setCards([]); } 
    finally { setLoading(false); }
  };

  const handleQueryChange = async (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.length > 2) {
      try {
        const res = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(val)}`);
        const json = await res.json();
        if (json.data) { setSuggestions(json.data); setShowSuggestions(true); }
      } catch (e) {}
    } else setShowSuggestions(false);
  };

  const selectSuggestion = (name) => {
    setQuery(name);
    setShowSuggestions(false);
    setTimeout(() => fetchCards(name, true), 50);
  };

  const addToCart = (card, finish, price) => {
    const stock = getStock(card.id, finish);
    const inCart = cart.find(i => i.id === card.id && i.finish === finish)?.quantity || 0;
    
    // Si no es admin, validamos stock
    if (stock <= inCart && user?.role !== 'admin') {
       alert("No hay suficiente stock disponible.");
       return;
    }

    setCart(prev => {
      const exists = prev.find(i => i.id === card.id && i.finish === finish);
      if (exists) return prev.map(i => i === exists ? { ...i, quantity: i.quantity + 1 } : i);
      
      const img = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
      return [...prev, {
        id: card.id, name: card.name, set: card.set_name, 
        collector_number: card.collector_number, image: img, 
        finish, price: parseFloat(price), quantity: 1
      }];
    });
    setIsCartOpen(true);
  };

  // --- VISTAS ---

  const renderProductCard = (card) => {
    const pNormal = card.prices?.usd, pFoil = card.prices?.usd_foil;
    const sNormal = getStock(card.id, 'normal'), sFoil = getStock(card.id, 'foil');
    
    return (
      <div key={card.id} className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 flex flex-col group relative">
        <div className="relative aspect-[2.5/3.5] bg-black cursor-pointer" onClick={() => setSelectedCard(card)}>
          <img src={card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" alt="" />
          <div className="absolute top-2 left-2 flex flex-col gap-1">
             {sNormal > 0 && <span className="bg-slate-900/90 text-white text-[10px] px-1.5 py-0.5 rounded border border-slate-600">N: {sNormal}</span>}
             {sFoil > 0 && <span className="bg-yellow-900/90 text-yellow-100 text-[10px] px-1.5 py-0.5 rounded border border-yellow-600">F: {sFoil}</span>}
          </div>
          {sNormal === 0 && sFoil === 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
              <span className="bg-red-600 text-white font-bold px-3 py-1 rounded text-xs uppercase -rotate-12 border-2 border-white">Agotado</span>
            </div>
          )}
        </div>
        <div className="p-3 flex-1 flex flex-col">
          <h3 className="font-bold text-white text-sm truncate">{card.name}</h3>
          <p className="text-slate-400 text-xs mb-2 truncate">{card.set_name}</p>
          <div className="mt-auto space-y-1">
            {pNormal && (
              <div className="flex justify-between items-center text-xs bg-slate-900/50 p-1 rounded">
                <span className="text-slate-300">N ${pNormal}</span>
                <button onClick={() => addToCart(card, 'normal', pNormal)} disabled={sNormal<=0} className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white p-1 rounded"><ShoppingCart size={12}/></button>
              </div>
            )}
            {pFoil && (
              <div className="flex justify-between items-center text-xs bg-purple-900/20 p-1 rounded border border-purple-500/20">
                <span className="text-purple-200">F ${pFoil}</span>
                <button onClick={() => addToCart(card, 'foil', pFoil)} disabled={sFoil<=0} className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 text-white p-1 rounded"><ShoppingCart size={12}/></button>
              </div>
            )}
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
              <tr>
                <th className="p-4">Fecha/Cliente</th>
                <th className="p-4 w-1/2">Items</th>
                <th className="p-4">Total</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4 align-top">
                    <div className="text-xs text-slate-500 mb-1">{new Date(order.date).toLocaleString()}</div>
                    <div className="text-white font-medium">{order.buyer.name}</div>
                    <div className="text-xs">{order.buyer.email}</div>
                    <div className="text-xs font-mono text-purple-400 mt-1">{order.id.substring(0,8)}...</div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-3">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 bg-slate-900/60 p-2 rounded-lg border border-slate-700/50">
                          <img src={item.image} alt="" className="w-8 h-10 object-cover rounded bg-black"/>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                               <p className="text-white text-xs font-bold truncate">{item.name}</p>
                               <span className="text-green-400 font-mono text-xs">${item.price}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[10px] text-slate-400">{item.set} #{item.collector_number}</span>
                               <Badge color={item.finish === 'foil' ? 'bg-yellow-600' : 'bg-slate-600'}>{item.finish}</Badge>
                               <span className="text-xs font-bold text-slate-200">x{item.quantity}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-green-400 font-bold align-top">${order.total.toFixed(2)}</td>
                  <td className="p-4 align-top">
                    <select 
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs rounded p-1 text-white focus:border-purple-500 outline-none"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="pagado">Pagado</option>
                      <option value="enviado">Enviado</option>
                      <option value="entregado">Entregado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </td>
                  <td className="p-4 align-top">
                    <button onClick={() => deleteOrder(order.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
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
          <input 
            type="text" placeholder="Buscar carta para stock..." 
            className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 focus:border-purple-500 outline-none"
            value={query} onChange={handleQueryChange}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
              {suggestions.map((s, i) => <button key={i} onClick={() => selectSuggestion(s)} className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-300">{s}</button>)}
            </div>
          )}
          <Button type="submit">Buscar</Button>
        </form>
      </div>

      {loading ? <div className="text-center p-8">Cargando...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map(card => {
             const sN = getStock(card.id, 'normal');
             const sF = getStock(card.id, 'foil');
             return (
               <div key={card.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col gap-3">
                 <div className="flex gap-3">
                   <img src={card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal} className="w-16 h-24 object-cover rounded bg-black" alt="" />
                   <div className="flex-1 min-w-0">
                     <h3 className="font-bold text-white text-sm truncate" title={card.name}>{card.name}</h3>
                     <p className="text-slate-400 text-xs truncate">{card.set_name}</p>
                     <p className="text-slate-500 text-xs mt-1">#{card.collector_number} • {card.rarity}</p>
                   </div>
                 </div>
                 <div className="bg-slate-900/50 p-3 rounded space-y-3">
                   <div className="flex items-center justify-between gap-2">
                     <span className="text-xs text-slate-300 w-12">Normal</span>
                     <div className="flex items-center gap-1 bg-slate-800 rounded border border-slate-600 px-1">
                       <button onClick={() => updateStock(card.id, 'normal', sN - 1)} className="text-slate-400 hover:text-white px-2">-</button>
                       <input className="w-10 bg-transparent text-center text-white text-sm outline-none font-bold" value={sN} onChange={(e) => updateStock(card.id, 'normal', e.target.value)} />
                       <button onClick={() => updateStock(card.id, 'normal', sN + 1)} className="text-slate-400 hover:text-white px-2">+</button>
                     </div>
                   </div>
                   <div className="flex items-center justify-between gap-2">
                     <div className="flex items-center gap-1 w-12"><Zap size={10} className="text-yellow-500" /><span className="text-xs text-slate-300">Foil</span></div>
                     <div className="flex items-center gap-1 bg-slate-800 rounded border border-purple-500/30 px-1">
                       <button onClick={() => updateStock(card.id, 'foil', sF - 1)} className="text-slate-400 hover:text-white px-2">-</button>
                       <input className="w-10 bg-transparent text-center text-white text-sm outline-none font-bold" value={sF} onChange={(e) => updateStock(card.id, 'foil', e.target.value)} />
                       <button onClick={() => updateStock(card.id, 'foil', sF + 1)} className="text-slate-400 hover:text-white px-2">+</button>
                     </div>
                   </div>
                 </div>
               </div>
             );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20">
      {/* Navbar */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer font-bold text-xl text-white" onClick={() => setView('store')}>
          <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">M</div> MysticMarket
        </div>
        
        {view === 'store' && (
          <div className="flex-1 max-w-md mx-4 relative" ref={wrapperRef}>
            <input 
              className="w-full bg-slate-950 border border-slate-700 rounded-full py-1.5 px-4 text-sm focus:border-purple-500 outline-none"
              placeholder="Buscar cartas..." value={query} onChange={handleQueryChange}
              onFocus={() => query.length > 2 && setShowSuggestions(true)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full w-full bg-slate-900 border border-slate-700 rounded mt-1 z-50 max-h-60 overflow-y-auto">
                {suggestions.map((s, i) => <div key={i} onClick={() => { setQuery(s); fetchCards(s, true); setShowSuggestions(false); }} className="p-2 hover:bg-slate-800 cursor-pointer text-sm">{s}</div>)}
              </div>
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
          ) : (
            <button onClick={() => setView('login')} className="text-sm flex items-center gap-1 hover:text-white"><User size={18}/> Entrar</button>
          )}
          <button className="relative p-2" onClick={() => setIsCartOpen(true)}>
            <ShoppingCart size={22} className={cart.length ? "text-purple-400" : ""} />
            {cart.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{cart.length}</span>}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        
        {/* BANNER DE ERROR DE PERMISOS */}
        {permissionError && (
          <div className="bg-red-500/10 border border-red-500 text-white p-6 rounded-xl mb-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="text-red-500" size={24}/>
              <h3 className="text-xl font-bold text-red-400">¡Acceso Bloqueado por Firebase!</h3>
            </div>
            <p className="text-slate-300 mb-4">
              Tu base de datos está en <strong>Modo Producción</strong> y está rechazando las conexiones. 
              Necesitas abrir los permisos para poder usar la App.
            </p>
            <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs overflow-x-auto border border-slate-800">
              <p className="text-slate-500 mb-2">// Copia este código y pégalo en Firebase Console {'>'} Firestore {'>'} Reglas:</p>
              <div className="text-green-400">
                <p>rules_version = '2';</p>
                <p>service cloud.firestore &#123;</p>
                <p>&nbsp;&nbsp;match /databases/&#123;database&#125;/documents &#123;</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;match /&#123;document=**&#125; &#123;</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allow read, write: if true;</p>
                <p>&nbsp;&nbsp;&nbsp;&nbsp;&#125;</p>
                <p>&nbsp;&nbsp;&#125;</p>
                <p>&#125;</p>
              </div>
            </div>
          </div>
        )}

        {!db && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-4 rounded-xl mb-6 text-center flex items-center justify-center gap-2">
            <AlertTriangle size={24} />
            <span>Atención: Configura tus credenciales de Firebase en el código para que la App funcione.</span>
          </div>
        )}

        {view === 'store' && (
          <>
            {loading && <div className="text-center py-12">Cargando cartas...</div>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {cards.map(renderProductCard)}
            </div>
          </>
        )}

        {view === 'login' && (
          <div className="max-w-md mx-auto bg-slate-800 p-8 rounded-xl border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">{authForm.isRegister ? "Crear Cuenta" : "Iniciar Sesión"}</h2>
            {authForm.error && <div className="bg-red-500/20 text-red-200 p-3 rounded mb-4 text-sm">{authForm.error}</div>}
            <form onSubmit={handleAuth} className="space-y-4">
              <input type="email" placeholder="Email" className="w-full bg-slate-900 border border-slate-600 rounded p-2" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} required />
              <input type="password" placeholder="Contraseña (min 6 caracteres)" className="w-full bg-slate-900 border border-slate-600 rounded p-2" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} required />
              <Button type="submit" className="w-full">{authForm.isRegister ? "Registrarse" : "Entrar"}</Button>
            </form>
            <p className="text-center mt-4 text-sm cursor-pointer text-purple-400" onClick={() => setAuthForm({...authForm, isRegister: !authForm.isRegister, error: ''})}>
              {authForm.isRegister ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
            </p>
          </div>
        )}

        {view === 'admin-inventory' && user?.role === 'admin' && renderAdminInventory()}
        {view === 'admin-orders' && user?.role === 'admin' && renderAdminOrders()}

        {view === 'profile' && user && (
           <div className="space-y-4 max-w-4xl mx-auto">
             <h2 className="text-2xl font-bold text-white">Mis Pedidos</h2>
             {orders.length === 0 ? <p className="text-slate-500">No tienes pedidos.</p> : orders.map(o => (
               <div key={o.id} className="bg-slate-800 p-4 rounded border border-slate-700">
                 <div className="flex justify-between mb-2">
                   <span className="text-green-400 font-bold">${o.total}</span>
                   <Badge>{o.status}</Badge>
                 </div>
                 <div className="text-xs text-slate-400 space-y-1">
                   {o.items.map((i, idx) => <div key={idx}>{i.quantity}x {i.name} ({i.finish})</div>)}
                 </div>
               </div>
             ))}
           </div>
        )}

        {view === 'success' && (
          <div className="text-center py-20">
            <CheckCircle size={64} className="text-green-500 mx-auto mb-4"/>
            <h2 className="text-3xl font-bold text-white">¡Compra Exitosa!</h2>
            <Button className="mt-6" onClick={() => setView('store')}>Volver a la tienda</Button>
          </div>
        )}
      </main>

      {/* Carrito simple (Drawer) */}
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
                <div key={i} className="flex gap-3 bg-slate-800 p-3 rounded">
                  <img src={item.image} className="w-12 h-16 bg-black rounded object-cover" alt=""/>
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.set} • {item.finish}</p>
                    <p className="text-green-400 text-sm font-bold">${item.price}</p>
                  </div>
                  <button onClick={() => setCart(c => c.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-slate-700">
              <div className="flex justify-between text-white font-bold mb-4 text-xl">
                <span>Total</span>
                <span>${cart.reduce((a,c) => a + c.price * c.quantity, 0).toFixed(2)}</span>
              </div>
              {user ? (
                <Button className="w-full py-3" onClick={handleCheckout} disabled={loading}>{loading ? 'Procesando...' : 'Pagar Ahora'}</Button>
              ) : (
                <Button className="w-full py-3" variant="secondary" onClick={() => { setIsCartOpen(false); setView('login'); }}>Inicia Sesión para Pagar</Button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Detalle */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setSelectedCard(null)}>
           <div className="bg-slate-900 p-6 rounded-xl max-w-4xl w-full flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="md:w-1/2 flex justify-center">
                 <img src={selectedCard.image_uris?.normal || selectedCard.card_faces?.[0]?.image_uris?.normal} className="rounded-lg shadow-2xl max-h-[60vh]" alt=""/>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start">
                   <h2 className="text-3xl font-bold text-white mb-2">{selectedCard.name}</h2>
                   <button onClick={() => setSelectedCard(null)} className="text-slate-400 hover:text-white"><X/></button>
                </div>
                <div className="flex gap-2 mb-4">
                   <Badge>{selectedCard.set_name}</Badge>
                   <span className="text-slate-400 text-sm capitalize">{selectedCard.rarity}</span>
                </div>
                
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 text-slate-300 font-serif mb-6 text-sm">
                   {selectedCard.card_faces ? selectedCard.card_faces.map((f, i) => (
                      <div key={i} className="mb-2 last:mb-0">
                         <strong className="block text-purple-300">{f.name}</strong>
                         <p>{f.oracle_text}</p>
                      </div>
                   )) : <p>{selectedCard.oracle_text}</p>}
                </div>

                <div className="mt-auto space-y-3">
                   <Button variant="outline" onClick={() => { setQuery(selectedCard.name); setSelectedCard(null); fetchCards(selectedCard.name, true); }} className="w-full justify-start border-slate-700 text-slate-300"><Layers size={16}/> Ver otras versiones</Button>
                   
                   <div className="bg-slate-800 p-4 rounded-lg flex items-center justify-between">
                      <div>
                         <p className="text-white font-bold">Normal</p>
                         <p className="text-xs text-green-400">Stock: {getStock(selectedCard.id, 'normal')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-xl font-bold text-white">${selectedCard.prices?.usd || '--'}</span>
                         <Button disabled={!selectedCard.prices?.usd || getStock(selectedCard.id, 'normal')<=0} onClick={() => addToCart(selectedCard, 'normal', selectedCard.prices?.usd)}>Agregar</Button>
                      </div>
                   </div>

                   <div className="bg-purple-900/20 border border-purple-500/20 p-4 rounded-lg flex items-center justify-between">
                      <div>
                         <p className="text-purple-200 font-bold flex items-center gap-1"><Zap size={14}/> Foil</p>
                         <p className="text-xs text-green-400">Stock: {getStock(selectedCard.id, 'foil')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-xl font-bold text-purple-200">${selectedCard.prices?.usd_foil || '--'}</span>
                         <Button variant="secondary" disabled={!selectedCard.prices?.usd_foil || getStock(selectedCard.id, 'foil')<=0} onClick={() => addToCart(selectedCard, 'foil', selectedCard.prices?.usd_foil)}>Agregar</Button>
                      </div>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}