import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, Search, X, Trash2, CreditCard, ShieldCheck, 
  Menu, Zap, Filter, ChevronDown, Info, Layers, User, 
  LogOut, Package, Settings, ClipboardList, ExternalLink,
  Clock, CheckCircle, Truck, XCircle, AlertTriangle, AlertCircle, Phone, MapPin, MessageCircle, Eye, Star
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

// --- CONFIGURACIÓN DEL BANNER (MODIFICAR AQUÍ) ---
const BANNER_CONFIG = {
  show: true, // true para mostrar, false para ocultar
  title: "¡Nuevas Llegadas: Ixalan!",
  subtitle: "Descubre los tesoros ocultos y dinosaurios legendarios de las cavernas perdidas.",
  buttonText: "Ver Colección",
  // URL de la imagen de fondo
  image: "https://cards.scryfall.io/art_crop/front/d/e/de434533-3d92-4f7f-94d7-0131495c0246.jpg?1699043960", 
  // La búsqueda que se ejecutará al dar click en el botón
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

// --- Componentes UI ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = "button" }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    outline: "bg-transparent border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10",
    success: "bg-green-600 hover:bg-green-500 text-white",
    whatsapp: "bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-900/20",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-300",
    white: "bg-white text-purple-900 hover:bg-slate-100 shadow-xl" // Nueva variante para el banner
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>{children}</button>;
};

const Badge = ({ children, color = 'bg-blue-600' }) => (
  <span className={`${color} text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider`}>{children}</span>
);

// --- Componente Principal ---

export default function App() {
  // Pantalla de Error de Configuración
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
            <p className="text-green-400">// Edita el archivo App.jsx:</p>
            <p>apiKey: "TU_API_KEY", <span className="text-yellow-500">&lt;-- REEMPLAZAR</span></p>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de Error de Inicialización
  if (firebaseError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-red-400">Error iniciando Firebase: {firebaseError}</div>
      </div>
    );
  }

  // --- ESTADOS ---
  const [user, setUser] = useState(null); 
  const [view, setView] = useState('store');
  const [inventory, setInventory] = useState({});
  const [orders, setOrders] = useState([]);
  const [permissionError, setPermissionError] = useState(false); 
  
  // Estados para éxito de compra
  const [lastOrderId, setLastOrderId] = useState(null); 
  const [lastOrderTotal, setLastOrderTotal] = useState(0); 
  
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]); 
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  
  // Estado para el modal de detalle de orden (Admin)
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [authForm, setAuthForm] = useState({ email: '', password: '', isRegister: false, error: '' });

  const wrapperRef = useRef(null);

  // --- MANEJO DE HISTORIAL ---
  useEffect(() => {
    const handlePopState = (event) => {
      if (selectedCard) {
        setSelectedCard(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedCard]);

  const openCardModal = (card) => {
    window.history.pushState({ cardId: card.id }, '', `#${card.id}`);
    setSelectedCard(card);
  };

  const closeCardModal = () => {
    window.history.back();
  };

  const goHome = () => {
    if (selectedCard) setSelectedCard(null);
    if (window.location.hash) window.history.replaceState(null, '', ' ');
    setView('store');
    setQuery('');
    fetchCards('format:commander year>=2023', false);
  };

  // --- SINCRONIZACIÓN FIREBASE ---

  // 1. Autenticación
  useEffect(() => {
    if (!auth) return;
    let unsubscribe;
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          let role = 'user';
          if (db) {
            try {
              const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
              if (userSnap.exists()) {
                role = userSnap.data().role || 'user';
              }
            } catch (e) {
              console.warn("Error leyendo rol:", e);
              if (e.code === 'permission-denied') setPermissionError(true);
            }
          }
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role });
          setCheckoutForm(prev => ({ ...prev, email: firebaseUser.email }));
        } else {
          setUser(null);
        }
      });
    } catch (e) { console.error("Error en auth listener:", e); }
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  // 2. Inventario
  useEffect(() => {
    if (!db) return;
    let unsubscribe;
    try {
      const q = collection(db, "inventory");
      unsubscribe = onSnapshot(q, (snapshot) => {
        const inv = {};
        snapshot.forEach(doc => inv[doc.id] = doc.data());
        setInventory(inv);
        setPermissionError(false);
      }, (error) => {
        console.error("Error inventario:", error);
        if (error.code === 'permission-denied') setPermissionError(true);
      });
    } catch (e) { console.error("Error creando listener de inventario:", e); }
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  // 3. Órdenes
  useEffect(() => {
    if (!db || !user) return;
    let unsubscribe;
    try {
      const q = collection(db, "orders");
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const allOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate ? doc.data().date.toDate().toISOString() : new Date().toISOString()
        }));
        
        // Ordenamos en JS
        allOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (user.role === 'admin') {
          setOrders(allOrders);
        } else {
          setOrders(allOrders.filter(o => 
            o.buyer?.uid === user.uid || o.buyer?.email === user.email
          ));
        }
      }, (error) => {
        console.error("Error snapshot órdenes:", error);
        if (error.code === 'permission-denied') setPermissionError(true);
      });
    } catch (e) { console.error("Error creando listener de ordenes:", e); }
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [user]);

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
    if (!user || user.role !== 'admin' || !db) return;
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

  // Función para eliminar orden Y restaurar stock
  const deleteOrder = async (orderId) => {
    if (!db) return;
    if (window.confirm('¿Eliminar orden permanentemente? El stock será restaurado.')) {
      try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) {
            alert("La orden no existe.");
            return;
        }

        const orderData = orderSnap.data();
        const batch = writeBatch(db);

        orderData.items.forEach(item => {
            const itemRef = doc(db, "inventory", item.id);
            batch.update(itemRef, {
                [item.finish]: increment(item.quantity)
            });
        });

        batch.delete(orderRef);
        await batch.commit();
        if (selectedOrder?.id === orderId) setSelectedOrder(null);

      } catch (e) { 
          console.error(e); 
          alert("Error al eliminar y restaurar stock: " + e.message); 
      }
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!auth) { setAuthForm({ ...authForm, error: "Firebase no está listo." }); return; }
    setAuthForm({ ...authForm, error: '' });
    try {
      if (authForm.isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        if (db) {
          await setDoc(doc(db, "users", cred.user.uid), {
            email: authForm.email,
            role: 'user',
            createdAt: serverTimestamp()
          });
        }
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
      setView('store');
    } catch (error) {
      console.error(error);
      let msg = "Error desconocido.";
      if (error.code === 'auth/email-already-in-use') msg = "Correo ya registrado.";
      if (error.code === 'auth/wrong-password') msg = "Contraseña incorrecta.";
      setAuthForm({ ...authForm, error: msg });
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!db) { alert("Sin conexión a BD."); return; }
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const currentTotal = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);

      for (const item of cart) {
        const ref = doc(db, "inventory", item.id);
        const snap = await getDoc(ref);
        const stock = snap.exists() ? (snap.data()[item.finish] || 0) : 0;
        
        if (stock < item.quantity) throw new Error(`Stock insuficiente: ${item.name} (${item.finish})`);
        batch.update(ref, { [item.finish]: stock - item.quantity });
      }

      const orderId = `MM-${Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')}`;
      const orderRef = doc(db, "orders", orderId);

      const newOrder = {
        date: serverTimestamp(),
        buyer: { 
          ...checkoutForm, 
          uid: user?.uid || 'guest', 
          email: user?.email || checkoutForm.email 
        },
        items: cart,
        total: currentTotal,
        status: 'pendiente'
      };
      
      batch.set(orderRef, newOrder);
      await batch.commit();
      
      setLastOrderId(orderId);
      setLastOrderTotal(currentTotal);
      
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
    
    if (stock <= inCart && user?.role !== 'admin') {
       alert(`Solo hay ${stock} disponibles y ya tienes ${inCart} en tu carrito.`);
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

  const updateCartQuantity = (item, delta) => {
    const currentStock = getStock(item.id, item.finish);
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i !== item));
      return;
    }

    if (newQty > currentStock && user?.role !== 'admin') {
      alert(`No puedes agregar más. Solo hay ${currentStock} en stock.`);
      return;
    }

    setCart(prev => prev.map(i => i === item ? { ...i, quantity: newQty } : i));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  // --- VISTAS ---

  const renderBanner = () => {
    if (!BANNER_CONFIG.show) return null;
    return (
      <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-8 group shadow-2xl border border-purple-500/20">
        <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105 bg-slate-800"
            style={{ backgroundImage: `url('${BANNER_CONFIG.image}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent flex flex-col justify-center p-8 md:p-12">
            <div className="max-w-2xl animate-in slide-in-from-left duration-700">
               <div className="flex items-center gap-2 mb-2">
                 <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"><Star size={12} fill="black"/> Destacado</span>
               </div>
               <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 leading-tight drop-shadow-lg">
                 {BANNER_CONFIG.title}
               </h1>
               <p className="text-lg md:text-xl text-slate-300 mb-8 max-w-lg drop-shadow-md">
                 {BANNER_CONFIG.subtitle}
               </p>
               <Button 
                 variant="white"
                 onClick={() => { setQuery(BANNER_CONFIG.actionQuery); fetchCards(BANNER_CONFIG.actionQuery, true); }} 
                 className="text-lg px-8 py-4"
               >
                 {BANNER_CONFIG.buttonText}
               </Button>
            </div>
        </div>
      </div>
    );
  };

  const renderProductCard = (card) => {
    const pNormalUSD = card.prices?.usd;
    const pFoilUSD = card.prices?.usd_foil;
    
    const pNormal = pNormalUSD ? parseFloat(pNormalUSD) * EXCHANGE_RATE : null;
    const pFoil = pFoilUSD ? parseFloat(pFoilUSD) * EXCHANGE_RATE : null;

    const sNormal = getStock(card.id, 'normal'), sFoil = getStock(card.id, 'foil');
    
    const inCartNormal = cart.find(i => i.id === card.id && i.finish === 'normal')?.quantity || 0;
    const inCartFoil = cart.find(i => i.id === card.id && i.finish === 'foil')?.quantity || 0;

    const disableNormal = (sNormal <= 0) || (sNormal <= inCartNormal && user?.role !== 'admin');
    const disableFoil = (sFoil <= 0) || (sFoil <= inCartFoil && user?.role !== 'admin');
    
    return (
      <div key={card.id} className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700 flex flex-col group relative">
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
          <h3 className="font-bold text-white text-sm truncate">{card.name}</h3>
          <p className="text-slate-400 text-xs mb-2 truncate">{card.set_name}</p>
          <div className="mt-auto space-y-1.5">
            <div className={`flex justify-between items-center px-2 py-1 rounded ${disableNormal ? 'bg-slate-900/30 opacity-70' : 'bg-slate-900/50'}`}>
              <div className="flex flex-col">
                <span className="text-slate-300 text-xs">Normal</span>
                <span className={`text-[9px] ${sNormal > 0 ? 'text-green-400' : 'text-red-500'}`}>Stock: {sNormal}</span>
                {inCartNormal > 0 && <span className="text-[9px] text-purple-400">En carrito: {inCartNormal}</span>}
              </div>
              {pNormal ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-green-400 font-bold text-xs">Q{pNormal.toFixed(2)}</span>
                  <button 
                    onClick={() => addToCart(card, 'normal', pNormal)} 
                    disabled={disableNormal} 
                    className={`p-1 rounded text-white transition-colors ${disableNormal ? 'bg-slate-700 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500'}`}
                  >
                    <ShoppingCart size={12}/>
                  </button>
                </div>
              ) : <span className="text-slate-600 text-[10px]">--</span>}
            </div>
            <div className={`flex justify-between items-center px-2 py-1 rounded border ${disableFoil ? 'border-transparent bg-slate-900/30 opacity-70' : 'border-purple-500/30 bg-gradient-to-r from-slate-900/50 to-purple-900/20'}`}>
               <div className="flex flex-col">
                  <div className="flex items-center gap-0.5">
                    <Zap size={10} className="text-yellow-400" fill="currentColor" />
                    <span className="text-purple-300 text-xs font-semibold">Foil</span>
                  </div>
                  <span className={`text-[9px] ${sFoil > 0 ? 'text-green-400' : 'text-red-500'}`}>Stock: {sFoil}</span>
                  {inCartFoil > 0 && <span className="text-[9px] text-purple-400">En carrito: {inCartFoil}</span>}
               </div>
              {pFoil ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-green-400 font-bold text-xs">Q{pFoil.toFixed(2)}</span>
                  <button 
                    onClick={() => addToCart(card, 'foil', pFoil)} 
                    disabled={disableFoil} 
                    className={`p-1 rounded text-white transition-colors ${disableFoil ? 'bg-slate-700 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500'}`}
                  >
                    <ShoppingCart size={12}/>
                  </button>
                </div>
              ) : <span className="text-slate-600 text-[10px]">--</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
                        <span className="flex items-center gap-1">
                            {item.finish === 'foil' && <Zap size={10} className="text-yellow-400" fill="currentColor" />}
                            {item.finish === 'foil' ? 'Foil' : 'Normal'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-300 text-xs">x{item.quantity}</p>
                      <p className="text-white font-bold">Q{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                </div>
                ))}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-600 flex justify-between items-center text-xl font-bold text-white">
                <span>Total</span>
                <span className="text-green-400">Q{cartTotal.toFixed(2)}</span>
            </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-bold text-slate-200 mb-4">Datos de Envío</h3>
            <form onSubmit={handleCheckout} className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Nombre Completo</label>
                  <input required type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={checkoutForm.name} onChange={e => setCheckoutForm({...checkoutForm, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Teléfono / WhatsApp</label>
                  <input required type="tel" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={checkoutForm.phone} onChange={e => setCheckoutForm({...checkoutForm, phone: e.target.value})} placeholder="5555-5555" />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Email</label>
                  <input required type="email" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={checkoutForm.email} onChange={e => setCheckoutForm({...checkoutForm, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Dirección de Entrega</label>
                  <textarea required className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white h-24" value={checkoutForm.address} onChange={e => setCheckoutForm({...checkoutForm, address: e.target.value})} />
                </div>
                <Button type="submit" variant="success" className="w-full mt-6 py-3" disabled={loading}>
                  {loading ? 'Procesando...' : `Confirmar Pedido (Q${cartTotal.toFixed(2)})`}
                </Button>
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
        <a 
          href={`https://wa.me/50246903693?text=Hola, acabo de realizar la orden %23${lastOrderId}. Mi nombre es ${checkoutForm.name}. El total es Q${lastOrderTotal.toFixed(2)}. Quisiera coordinar el pago.`}
          target="_blank" rel="noopener noreferrer" className="w-full block"
        >
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
            <div>
              <h2 className="text-2xl font-bold text-white">Orden #{selectedOrder.id}</h2>
              <p className="text-slate-400 text-sm">{new Date(selectedOrder.date).toLocaleString()}</p>
            </div>
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
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{item.name}</p>
                    <p className="text-slate-400 text-xs">{item.set} • {item.finish === 'foil' ? 'Foil' : 'Normal'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-300 text-xs">x{item.quantity}</p>
                    <p className="text-white font-bold text-sm">Q{item.price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end items-center gap-4 text-xl">
              <span className="text-slate-400">Total:</span>
              <span className="text-green-400 font-bold">Q{selectedOrder.total.toFixed(2)}</span>
            </div>
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
              <tr>
                <th className="p-4">Fecha/Cliente</th>
                <th className="p-4">Total</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4">
                    <div className="text-xs text-slate-500 mb-1">{new Date(order.date).toLocaleString()}</div>
                    <div className="text-white font-medium">{order.buyer.name}</div>
                    <div className="text-xs">{order.buyer.email}</div>
                    <div className="text-xs font-mono text-purple-400 mt-1">{order.id}</div>
                  </td>
                  <td className="p-4 text-green-400 font-bold">Q{order.total.toFixed(2)}</td>
                  <td className="p-4">
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
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setSelectedOrder(order)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors" title="Ver Detalles">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => deleteOrder(order.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors" title="Eliminar">
                        <Trash2 size={18} />
                      </button>
                    </div>
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
          <div className="flex-1 relative" ref={wrapperRef}>
            <input 
              type="text" placeholder="Buscar carta para stock..." 
              className="w-full bg-slate-950 border border-slate-600 text-white rounded-lg px-4 py-2 focus:border-purple-500 outline-none"
              value={query} onChange={handleQueryChange}
              onFocus={() => query.length > 2 && setShowSuggestions(true)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
                {suggestions.map((s, i) => (
                  <button 
                    key={i} 
                    type="button"
                    onClick={() => selectSuggestion(s)} 
                    className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-300 border-b border-slate-800 last:border-0"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
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
        <div className="flex items-center gap-2 cursor-pointer font-bold text-xl text-white" onClick={goHome}>
          {/* ICONO RESTAURADO CON GLOW */}
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-[0_0_15px_rgba(147,51,234,0.5)]">M</div>
          <span className="hidden sm:block">MysticMarket</span>
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
              Tu base de datos está rechazando las conexiones. 
              Necesitas abrir los permisos en la consola de Firebase.
            </p>
          </div>
        )}

        {view === 'store' && (
          <>
            {!query && !loading && renderBanner()}

            {loading && <div className="text-center py-12">Cargando cartas...</div>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {cards.map(renderProductCard)}
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
                <div key={i} className="bg-slate-800 p-3 rounded flex gap-3 border border-slate-700">
                  <img src={item.image} className="w-12 h-16 bg-black rounded object-cover" alt=""/>
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 mb-2">{item.set} • {item.finish}</p>
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2 bg-slate-900 rounded p-1">
                        <button onClick={() => updateCartQuantity(item, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 text-slate-300 rounded">-</button>
                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateCartQuantity(item, 1)} 
                          disabled={item.quantity >= getStock(item.id, item.finish) && user?.role !== 'admin'}
                          className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 text-slate-300 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >+</button>
                      </div>
                      <p className="text-green-400 text-sm font-bold">Q{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                  <button onClick={() => setCart(c => c.filter((_, idx) => idx !== i))} className="text-red-500 self-start"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-slate-700">
              <div className="flex justify-between text-white font-bold mb-4 text-xl">
                <span>Total</span>
                <span>Q{cart.reduce((a,c) => a + c.price * c.quantity, 0).toFixed(2)}</span>
              </div>
              {user ? (
                <Button className="w-full py-3" onClick={() => { setIsCartOpen(false); setView('checkout'); }}>Completar Pedido</Button>
              ) : (
                <Button className="w-full py-3" variant="secondary" onClick={() => { setIsCartOpen(false); setView('login'); }}>Inicia Sesión para Pagar</Button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Detalle */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={closeCardModal}>
           <div className="bg-slate-900 p-6 rounded-xl max-w-4xl w-full flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="md:w-1/2 flex justify-center">
                 <img src={selectedCard.image_uris?.normal || selectedCard.card_faces?.[0]?.image_uris?.normal} className="rounded-lg shadow-2xl max-h-[60vh]" alt=""/>
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start">
                   <h2 className="text-3xl font-bold text-white mb-2">{selectedCard.name}</h2>
                   <button onClick={closeCardModal} className="text-slate-400 hover:text-white"><X/></button>
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
                   <Button variant="outline" onClick={() => { setQuery(selectedCard.name); closeCardModal(); fetchCards(selectedCard.name, true); }} className="w-full justify-start border-slate-700 text-slate-300"><Layers size={16}/> Ver otras versiones</Button>
                   
                   {/* Normal Row en Modal */}
                   <div className="bg-slate-800 p-4 rounded-lg flex items-center justify-between">
                      <div>
                         <p className="text-white font-bold">Normal</p>
                         <p className="text-xs text-green-400">Stock: {getStock(selectedCard.id, 'normal')}</p>
                         {cart.find(i => i.id === selectedCard.id && i.finish === 'normal') && (
                            <p className="text-[10px] text-purple-400">En carrito: {cart.find(i => i.id === selectedCard.id && i.finish === 'normal').quantity}</p>
                         )}
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-xl font-bold text-white">
                            {selectedCard.prices?.usd ? `Q${(parseFloat(selectedCard.prices.usd) * EXCHANGE_RATE).toFixed(2)}` : '--'}
                         </span>
                         <Button 
                            disabled={!selectedCard.prices?.usd || getStock(selectedCard.id, 'normal') <= (cart.find(i => i.id === selectedCard.id && i.finish === 'normal')?.quantity || 0) && user?.role !== 'admin'} 
                            onClick={() => addToCart(selectedCard, 'normal', selectedCard.prices?.usd)}
                         >
                            Agregar
                         </Button>
                      </div>
                   </div>

                   {/* Foil Row en Modal */}
                   <div className="bg-purple-900/20 border border-purple-500/20 p-4 rounded-lg flex items-center justify-between">
                      <div>
                         <p className="text-purple-200 font-bold flex items-center gap-1"><Zap size={14}/> Foil</p>
                         <p className="text-xs text-green-400">Stock: {getStock(selectedCard.id, 'foil')}</p>
                         {cart.find(i => i.id === selectedCard.id && i.finish === 'foil') && (
                            <p className="text-[10px] text-purple-400">En carrito: {cart.find(i => i.id === selectedCard.id && i.finish === 'foil').quantity}</p>
                         )}
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-xl font-bold text-purple-200">
                            {selectedCard.prices?.usd_foil ? `Q${(parseFloat(selectedCard.prices.usd_foil) * EXCHANGE_RATE).toFixed(2)}` : '--'}
                         </span>
                         <Button 
                            variant="secondary" 
                            disabled={!selectedCard.prices?.usd_foil || getStock(selectedCard.id, 'foil') <= (cart.find(i => i.id === selectedCard.id && i.finish === 'foil')?.quantity || 0) && user?.role !== 'admin'} 
                            onClick={() => addToCart(selectedCard, 'foil', selectedCard.prices?.usd_foil)}
                         >
                            Agregar
                         </Button>
                      </div>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Modal de Detalle de Orden (Admin) */}
      {renderOrderModal()}

    </div>
  );
}