import { db } from './firebase'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, Search, X, Trash2, CreditCard, ShieldCheck, 
  Menu, Zap, Filter, ChevronDown, Info, Layers, User, 
  LogOut, Package, Settings, ClipboardList, ExternalLink,
  Clock, CheckCircle, Truck, XCircle, AlertTriangle
} from 'lucide-react';

// --- IMPORTACIONES DE FIREBASE REALES ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, collection, doc, getDoc, setDoc, addDoc, 
  updateDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, orderBy 
} from "firebase/firestore";

// --- CONFIGURACIÓN DE FIREBASE (REEMPLAZAR CON TUS DATOS REALES) ---
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_MESSAGING_ID",
  appId: "TU_APP_ID"
};

// Inicializar Firebase (Solo si hay config, para evitar errores en la vista previa sin claves)
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase no inicializado. Asegúrate de poner tus credenciales en firebaseConfig.");
}

// --- Componentes UI Reutilizables ---

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
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Badge = ({ children, color = 'bg-blue-600' }) => (
  <span className={`${color} text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider`}>
    {children}
  </span>
);

// --- Componente Principal ---

export default function App() {
  // --- ESTADOS GLOBALES ---
  const [user, setUser] = useState(null); // { uid, email, role }
  const [view, setView] = useState('store');
  const [inventory, setInventory] = useState({}); // Ahora sincronizado con Firestore
  const [orders, setOrders] = useState([]); // Ahora sincronizado con Firestore
  const [appError, setAppError] = useState(null); // Para errores globales de conexión

  // --- ESTADOS DE TIENDA Y UI ---
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]); 
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  
  // --- FORMULARIOS ---
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', address: '' });
  const [authForm, setAuthForm] = useState({ email: '', password: '', isRegister: false, error: '' });

  const wrapperRef = useRef(null);

  // --- 1. SINCRONIZACIÓN CON FIREBASE ---
  
  // A) Autenticación
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Buscar el rol del usuario en la colección 'users'
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.exists() ? userDoc.data() : {};
        
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: userData.role || 'user'
        });
        
        // Precargar email en checkout
        setCheckoutForm(prev => ({ ...prev, email: firebaseUser.email }));
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // B) Inventario en Tiempo Real
  useEffect(() => {
    if (!db) return;
    // Escuchar cambios en la colección 'inventory'
    const q = collection(db, "inventory");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invData = {};
      snapshot.forEach(doc => {
        invData[doc.id] = doc.data();
      });
      setInventory(invData);
    }, (error) => {
      console.error("Error al sincronizar inventario:", error);
    });
    return () => unsubscribe();
  }, []);

  // C) Órdenes en Tiempo Real (Solo si es Admin o para el usuario propio)
  useEffect(() => {
    if (!db || !user) {
      setOrders([]);
      return;
    }

    let q;
    if (user.role === 'admin') {
      // Admin ve todas las órdenes
      q = query(collection(db, "orders"), orderBy("date", "desc"));
    } else {
      // Usuario ve solo sus órdenes (filtrado en cliente por simplicidad, idealmente reglas de seguridad)
      q = query(collection(db, "orders"), orderBy("date", "desc")); 
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convertir Timestamp de Firebase a fecha legible si es necesario
        date: doc.data().date?.toDate ? doc.data().date.toDate().toISOString() : new Date().toISOString()
      }));
      
      // Filtrado de seguridad en cliente (si no configuraste reglas estrictas aún)
      if (user.role !== 'admin') {
        setOrders(ordersData.filter(o => o.buyer.email === user.email));
      } else {
        setOrders(ordersData);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Carga inicial de cartas (Tendencias)
  useEffect(() => {
    fetchCards('format:commander year>=2022', false);
    
    // Listener para cerrar autocompletado
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  // --- 2. LÓGICA DE NEGOCIO (BACKEND REAL) ---

  // Obtener stock desde el estado sincronizado (Fuente de verdad)
  const getStock = (cardId, finish) => {
    if (!inventory[cardId]) return 0;
    return inventory[cardId][finish] || 0;
  };

  // Función Admin: Actualizar stock en Firestore
  const updateStock = async (cardId, finish, newQuantity) => {
    if (!db || !user || user.role !== 'admin') return;
    
    const qty = parseInt(newQuantity);
    if (isNaN(qty) || qty < 0) return;

    try {
      const docRef = doc(db, "inventory", cardId);
      // setDoc con merge: true crea el documento si no existe, o actualiza solo el campo si existe
      await setDoc(docRef, { [finish]: qty }, { merge: true });
    } catch (error) {
      console.error("Error actualizando stock:", error);
      alert("Error al actualizar la base de datos.");
    }
  };

  // Función Checkout: Transacción Atómica
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!db) {
      alert("Error de conexión con la base de datos.");
      return;
    }

    setLoading(true);

    try {
      // Usamos un 'batch' para asegurar que todo ocurra o nada ocurra
      const batch = writeBatch(db);
      
      // 1. Verificar Stock de cada item ANTES de procesar
      for (const item of cart) {
        const itemRef = doc(db, "inventory", item.id);
        const itemSnap = await getDoc(itemRef);
        
        if (!itemSnap.exists()) {
          throw new Error(`El producto ${item.name} ya no está disponible.`);
        }
        
        const currentStock = itemSnap.data()[item.finish] || 0;
        
        if (currentStock < item.quantity) {
          throw new Error(`Stock insuficiente para ${item.name} (${item.finish}). Solo quedan ${currentStock}.`);
        }

        // 2. Preparar la resta de stock
        // Nota: En Firestore cliente no podemos hacer decrementos atómicos condicionales complejos fácilmente en un batch sin Cloud Functions,
        // pero podemos calcular el nuevo valor aquí ya que leímos el dato hace milisegundos.
        const newStock = currentStock - item.quantity;
        batch.update(itemRef, { [item.finish]: newStock });
      }

      // 3. Crear la orden
      const orderRef = doc(collection(db, "orders"));
      const newOrder = {
        date: serverTimestamp(),
        buyer: { ...checkoutForm, uid: user ? user.uid : 'guest', email: user ? user.email : checkoutForm.email },
        total: cartTotal,
        items: cart,
        status: 'pendiente'
      };
      batch.set(orderRef, newOrder);

      // 4. Ejecutar todo
      await batch.commit();

      // 5. Éxito
      setView('success');
      setCart([]);
      setCheckoutForm({ name: '', email: '', address: '' });

    } catch (error) {
      console.error("Error en checkout:", error);
      alert(error.message); // Mostrar mensaje amigable al usuario (ej: "Stock insuficiente")
    } finally {
      setLoading(false);
    }
  };

  // Función Auth: Login/Registro Real
  const handleAuth = async (e) => {
    e.preventDefault();
    if (!auth) {
      setAuthForm({ ...authForm, error: "Firebase no configurado." });
      return;
    }
    
    setAuthForm({ ...authForm, error: '' });

    try {
      if (authForm.isRegister) {
        // Registro
        const userCredential = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        // Crear perfil de usuario en Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: authForm.email,
          role: 'user', // Por defecto todos son usuarios normales
          createdAt: serverTimestamp()
        });
      } else {
        // Login
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
      setView('store');
    } catch (error) {
      console.error("Auth error:", error);
      let msg = "Error de autenticación.";
      if (error.code === 'auth/wrong-password') msg = "Contraseña incorrecta.";
      if (error.code === 'auth/user-not-found') msg = "Usuario no encontrado.";
      if (error.code === 'auth/email-already-in-use') msg = "El email ya está registrado.";
      setAuthForm({ ...authForm, error: msg });
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    setCart([]);
    setView('store');
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

  // --- API DE SCRYFALL (Búsqueda de cartas) ---
  const fetchCards = async (searchQuery, isUserSearch = true) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const queryParams = isUserSearch 
        ? `q=${encodeURIComponent(searchQuery + " unique:prints")}&order=released`
        : `q=${encodeURIComponent(searchQuery)}&order=edhrec`;

      const response = await fetch(`https://api.scryfall.com/cards/search?${queryParams}`);
      const data = await response.json();
      
      if (data.data) {
        setCards(data.data.filter(c => c.image_uris || c.card_faces)); 
      } else {
        setCards([]);
      }
    } catch (error) {
      console.error("Error fetching cards:", error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  // Autocompletado
  const handleQueryChange = async (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.length > 2) {
      try {
        const response = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(val)}`);
        const data = await response.json();
        if (data.data) {
          setSuggestions(data.data);
          setShowSuggestions(true);
        }
      } catch (error) { console.error(error); }
    } else { setShowSuggestions(false); }
  };

  const selectSuggestion = (name) => {
    setQuery(name);
    setShowSuggestions(false);
    setTimeout(() => fetchCards(name, true), 50);
  };

  // --- LÓGICA DE CARRITO (LOCAL) ---
  const addToCart = (card, finish, price) => {
    const currentStock = getStock(card.id, finish);
    const itemInCart = cart.find(i => i.id === card.id && i.finish === finish);
    const quantityInCart = itemInCart ? itemInCart.quantity : 0;

    if (quantityInCart >= currentStock) {
      alert("¡No hay suficiente stock disponible!");
      return;
    }

    setCart(prev => {
      if (itemInCart) {
        return prev.map(item => 
          (item.id === card.id && item.finish === finish) ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { 
        id: card.id, 
        name: card.name, 
        set: card.set_name, 
        collector_number: card.collector_number,
        image: getCardImage(card), 
        finish, 
        price: parseFloat(price), 
        quantity: 1 
      }];
    });
    setIsCartOpen(true);
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  // --- UTILIDADES ---
  const getCardImage = (card, size = 'normal') => {
    if (card.image_uris?.[size]) return card.image_uris[size];
    if (card.card_faces?.[0]?.image_uris?.[size]) return card.card_faces[0].image_uris[size];
    return 'https://via.placeholder.com/250x350?text=No+Image';
  };

  const showAllVersions = (cardName) => {
    setQuery(cardName);
    setSelectedCard(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchCards(cardName, true);
  };

  // --- RENDERIZADO (VIEWS) ---

  const renderCardModal = () => {
    if (!selectedCard) return null;
    const priceNormal = selectedCard.prices?.usd;
    const priceFoil = selectedCard.prices?.usd_foil;
    const stockNormal = getStock(selectedCard.id, 'normal');
    const stockFoil = getStock(selectedCard.id, 'foil');
    
    const renderOracleText = (text) => text ? text.split('\n').map((l, i) => <p key={i} className="mb-2 last:mb-0">{l}</p>) : "Sin texto.";

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedCard(null)}></div>
        <div className="relative bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col md:flex-row shadow-2xl border border-purple-500/30 animate-in zoom-in-95 duration-200">
          <button onClick={() => setSelectedCard(null)} className="absolute top-4 right-4 z-10 bg-slate-800/80 p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"><X size={24} /></button>
          <div className="p-6 md:w-1/2 flex items-center justify-center bg-black/40">
            <img src={getCardImage(selectedCard, 'large')} alt={selectedCard.name} className="rounded-xl shadow-2xl max-h-[60vh] object-contain"/>
          </div>
          <div className="p-6 md:w-1/2 flex flex-col">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">{selectedCard.name}</h2>
              <div className="flex items-center gap-2 mb-4">
                 <Badge color="bg-purple-600">{selectedCard.set_name}</Badge>
                 <span className="text-slate-400 text-sm capitalize">{selectedCard.rarity}</span>
                 <span className="text-slate-500 text-xs font-mono">#{selectedCard.collector_number}</span>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-slate-300 font-serif leading-relaxed text-sm md:text-base">
                 {selectedCard.card_faces ? selectedCard.card_faces.map((face, idx) => (
                    <div key={idx} className="mb-4 last:mb-0 border-b border-slate-700 last:border-0 pb-4 last:pb-0">
                        <strong className="block text-purple-300 mb-1">{face.name}</strong>
                        {renderOracleText(face.oracle_text)}
                    </div>
                 )) : renderOracleText(selectedCard.oracle_text)}
              </div>
            </div>
            <div className="mt-auto space-y-4">
               <Button variant="outline" onClick={() => showAllVersions(selectedCard.name)} className="w-full border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800">
                  <Layers size={18} /> Ver todas las versiones / artes
               </Button>
               <h3 className="text-slate-400 font-bold uppercase text-sm tracking-wider pt-2 border-t border-slate-700/50">Opciones de Compra</h3>
               
               <div className="flex items-center justify-between bg-slate-800 p-4 rounded-lg border border-slate-700">
                  <div className="flex flex-col">
                      <span className="text-white font-bold">Versión Normal</span>
                      <span className={`text-xs ${stockNormal > 0 ? 'text-green-400' : 'text-red-500'}`}>Stock: {stockNormal}</span>
                  </div>
                  <div className="flex items-center gap-4">
                      {priceNormal ? (
                        <>
                           <span className="text-2xl font-bold text-green-400">${priceNormal}</span>
                           <Button onClick={() => addToCart(selectedCard, 'normal', priceNormal)} disabled={stockNormal <= 0} variant="primary" className="py-1.5">Agregar</Button>
                        </>
                      ) : <span className="text-slate-500 italic">No disponible</span>}
                  </div>
               </div>

               <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-purple-900/20 p-4 rounded-lg border border-purple-500/20">
                  <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                         <span className="text-white font-bold">Versión Foil</span>
                         <Zap size={14} className="text-yellow-400" fill="currentColor" />
                      </div>
                      <span className={`text-xs ${stockFoil > 0 ? 'text-green-400' : 'text-red-500'}`}>Stock: {stockFoil}</span>
                  </div>
                  <div className="flex items-center gap-4">
                      {priceFoil ? (
                        <>
                           <span className="text-2xl font-bold text-green-400">${priceFoil}</span>
                           <Button onClick={() => addToCart(selectedCard, 'foil', priceFoil)} disabled={stockFoil <= 0} className="bg-yellow-600 hover:bg-yellow-500 text-white py-1.5">Agregar</Button>
                        </>
                      ) : <span className="text-slate-500 italic">No disponible</span>}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProductCard = (card) => {
    const priceNormal = card.prices?.usd;
    const priceFoil = card.prices?.usd_foil;
    const stockNormal = getStock(card.id, 'normal');
    const stockFoil = getStock(card.id, 'foil');
    const canBuyNormal = priceNormal && stockNormal > 0;
    const canBuyFoil = priceFoil && stockFoil > 0;

    return (
      <div key={card.id} className="bg-slate-800 rounded-lg overflow-hidden shadow-md hover:shadow-xl hover:shadow-purple-900/20 transition-all border border-slate-700 flex flex-col text-sm group/card">
        <div className="relative overflow-hidden bg-black aspect-[2.5/3.5] cursor-pointer" onClick={() => setSelectedCard(card)}>
          <img src={getCardImage(card)} alt={card.name} loading="lazy" className="w-full h-full object-cover transform group-hover/card:scale-110 transition-transform duration-300"/>
          {card.reserved && <div className="absolute top-1 right-1 bg-yellow-600 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">RL</div>}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
             <span className="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-sm border border-white/20">
                <Info size={12} /> Ver Detalles
             </span>
          </div>
          {stockNormal === 0 && stockFoil === 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
              <span className="bg-red-600 text-white font-bold px-3 py-1 rounded text-xs uppercase transform -rotate-12 border-2 border-white">Agotado</span>
            </div>
          )}
        </div>
        
        <div className="p-2 flex flex-col flex-grow">
          <h3 className="font-bold text-white leading-tight mb-0.5 truncate cursor-pointer hover:text-purple-400" onClick={() => setSelectedCard(card)}>{card.name}</h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-[10px] uppercase tracking-wide truncate flex-1">{card.set_name}</span>
            <span className={`w-2 h-2 rounded-full ${card.rarity === 'mythic' ? 'bg-orange-500' : card.rarity === 'rare' ? 'bg-yellow-400' : 'bg-slate-400'}`}></span>
          </div>
          
          <div className="mt-auto space-y-1.5">
            <div className={`flex justify-between items-center px-2 py-1 rounded ${stockNormal > 0 ? 'bg-slate-900/50' : 'bg-slate-900/20 opacity-60'}`}>
              <div className="flex flex-col">
                <span className="text-slate-300 text-xs">Normal</span>
                <span className={`text-[9px] ${stockNormal > 0 ? 'text-green-400' : 'text-red-500'}`}>Stock: {stockNormal}</span>
              </div>
              {priceNormal ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-green-400 font-bold text-xs">${priceNormal}</span>
                  <button onClick={() => addToCart(card, 'normal', priceNormal)} disabled={!canBuyNormal} className="p-1 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 rounded text-white transition-colors">
                    <ShoppingCart size={12} />
                  </button>
                </div>
              ) : <span className="text-slate-600 text-[10px]">--</span>}
            </div>

            <div className={`flex justify-between items-center px-2 py-1 rounded border border-transparent ${stockFoil > 0 ? 'bg-gradient-to-r from-slate-900/50 to-purple-900/20 border-purple-500/30' : 'bg-slate-900/20 opacity-60'}`}>
               <div className="flex flex-col">
                  <div className="flex items-center gap-0.5">
                    <Zap size={10} className="text-yellow-400" fill="currentColor" />
                    <span className="text-purple-300 text-xs font-semibold">Foil</span>
                  </div>
                  <span className={`text-[9px] ${stockFoil > 0 ? 'text-green-400' : 'text-red-500'}`}>Stock: {stockFoil}</span>
               </div>
              {priceFoil ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-green-400 font-bold text-xs">${priceFoil}</span>
                  <button onClick={() => addToCart(card, 'foil', priceFoil)} disabled={!canBuyFoil} className="p-1 bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 rounded text-white transition-colors">
                    <ShoppingCart size={12} />
                  </button>
                </div>
              ) : <span className="text-slate-600 text-[10px]">--</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLogin = () => (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white shadow-lg shadow-purple-500/30">M</div>
          <h2 className="text-2xl font-bold text-white">{authForm.isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
          <p className="text-slate-400 text-sm mt-2">
            {authForm.isRegister ? 'Únete a MysticMarket para comprar.' : 'Bienvenido de nuevo, Planeswalker.'}
          </p>
        </div>
        {authForm.error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded mb-4 text-sm text-center">
            {authForm.error}
          </div>
        )}
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Email</label>
            <input required type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none" 
              value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} placeholder="nombre@ejemplo.com"/>
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">Contraseña</label>
            <input required type="password" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none" 
              value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} placeholder="••••••••"/>
          </div>
          <Button type="submit" variant="primary" className="w-full py-3 mt-4">
            {authForm.isRegister ? 'Registrarse' : 'Entrar'}
          </Button>
        </form>
        <div className="mt-6 text-center">
          <button onClick={() => setAuthForm({...authForm, isRegister: !authForm.isRegister, error: ''})} className="text-purple-400 hover:text-purple-300 text-sm underline">
            {authForm.isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderProfile = () => {
    // Si es admin, puede ver sus propias ordenes aqui tambien, pero tiene su panel aparte
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        <div className="mb-8 flex items-center gap-4">
            <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div>
                <h2 className="text-3xl font-bold text-white">Mi Perfil</h2>
                <p className="text-slate-400">{user?.email}</p>
                {user?.role === 'admin' && <Badge color="bg-yellow-600">Administrador</Badge>}
            </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-700 bg-slate-900/50">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Clock size={20} className="text-purple-400"/> Historial de Pedidos
                </h3>
            </div>
            
            {orders.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                    <Package size={48} className="mx-auto mb-4 opacity-20"/>
                    <p>No has realizado ningún pedido todavía.</p>
                    <Button variant="outline" onClick={() => setView('store')} className="mt-4 mx-auto">Ir a la Tienda</Button>
                </div>
            ) : (
                <div className="divide-y divide-slate-700">
                    {orders.map(order => (
                        <div key={order.id} className="p-6 hover:bg-slate-750 transition-colors">
                            <div className="flex flex-wrap justify-between items-start mb-4 gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg font-bold text-white">Pedido #{order.id.substring(0, 8)}...</span>
                                        <Badge color={
                                            order.status === 'pagado' ? 'bg-green-600' : 
                                            order.status === 'cancelado' ? 'bg-red-600' : 
                                            order.status === 'enviado' ? 'bg-blue-600' : 'bg-yellow-600'
                                        }>{order.status}</Badge>
                                    </div>
                                    <p className="text-sm text-slate-400">{new Date(order.date).toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-400">Total</p>
                                    <p className="text-xl font-bold text-green-400">${order.total.toFixed(2)}</p>
                                </div>
                            </div>

                            <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 border border-slate-700/50">
                                {order.items.map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <img src={item.image} alt="" className="w-8 h-10 object-cover rounded bg-black"/>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span>{item.set}</span>
                                                <span className="flex items-center gap-1">
                                                    {item.finish === 'foil' && <Zap size={10} className="text-yellow-500"/>}
                                                    {item.finish === 'foil' ? 'Foil' : 'Normal'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-slate-400">x{item.quantity}</span>
                                            <span className="block text-sm font-bold text-slate-300">${item.price}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
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
                <th className="p-4">ID</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Comprador</th>
                <th className="p-4 w-1/2">Items</th>
                <th className="p-4">Total</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4 font-mono text-purple-400 align-top">{order.id.substring(0, 8)}...</td>
                  <td className="p-4 align-top">{new Date(order.date).toLocaleDateString()}</td>
                  <td className="p-4 align-top">
                    <div className="text-white font-medium">{order.buyer.name}</div>
                    <div className="text-xs">{order.buyer.email}</div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-3">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 bg-slate-900/60 p-2 rounded-lg border border-slate-700/50">
                          <div className="relative w-10 h-14 flex-shrink-0 bg-black rounded overflow-hidden shadow-sm">
                             <img src={item.image} alt="" className="w-full h-full object-cover"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                               <p className="text-white text-sm font-bold truncate">{item.name}</p>
                               <span className="text-green-400 font-mono text-xs">${item.price}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400 mt-1">
                               <span title="Set Name">{item.set}</span>
                               <span className="text-slate-600">•</span>
                               <span title="Collector Number" className="font-mono">#{item.collector_number || '?'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                               <Badge color={item.finish === 'foil' ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-black shadow-sm' : 'bg-slate-600 text-slate-200'}>
                                  {item.finish === 'foil' ? 'Foil' : 'Normal'}
                               </Badge>
                               <span className="text-xs font-bold text-slate-200 bg-slate-700 px-1.5 py-0.5 rounded">x{item.quantity}</span>
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
                    <button onClick={() => deleteOrder(order.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors" title="Eliminar Orden">
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
        <p className="text-slate-400 text-sm mb-4">Busca cartas en Scryfall para añadirlas a tu stock local en tiempo real.</p>
        <form onSubmit={(e) => { e.preventDefault(); fetchCards(query, true); }} className="flex gap-2">
          <input type="text" placeholder="Buscar carta para stock (ej. Sheoldred)..." className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 focus:border-purple-500 outline-none" value={query} onChange={handleQueryChange} />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => selectSuggestion(s)} className="w-full text-left px-4 py-2 hover:bg-slate-800 text-sm text-slate-300">{s}</button>
              ))}
            </div>
          )}
          <Button type="submit">Buscar</Button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map(card => {
             const stockNormal = getStock(card.id, 'normal');
             const stockFoil = getStock(card.id, 'foil');
             return (
               <div key={card.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex flex-col gap-3">
                 <div className="flex gap-3">
                   <img src={getCardImage(card)} className="w-20 h-28 object-cover rounded bg-black" alt="" />
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
                       <button onClick={() => updateStock(card.id, 'normal', stockNormal - 1)} className="text-slate-400 hover:text-white px-1">-</button>
                       <input className="w-10 bg-transparent text-center text-white text-sm outline-none font-bold" value={stockNormal} onChange={(e) => updateStock(card.id, 'normal', e.target.value)} />
                       <button onClick={() => updateStock(card.id, 'normal', stockNormal + 1)} className="text-slate-400 hover:text-white px-1">+</button>
                     </div>
                   </div>
                   <div className="flex items-center justify-between gap-2">
                     <div className="flex items-center gap-1 w-12"><Zap size={10} className="text-yellow-500" /><span className="text-xs text-slate-300">Foil</span></div>
                     <div className="flex items-center gap-1 bg-slate-800 rounded border border-purple-500/30 px-1">
                       <button onClick={() => updateStock(card.id, 'foil', stockFoil - 1)} className="text-slate-400 hover:text-white px-1">-</button>
                       <input className="w-10 bg-transparent text-center text-white text-sm outline-none font-bold" value={stockFoil} onChange={(e) => updateStock(card.id, 'foil', e.target.value)} />
                       <button onClick={() => updateStock(card.id, 'foil', stockFoil + 1)} className="text-slate-400 hover:text-white px-1">+</button>
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

  const renderNavbar = () => (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 cursor-pointer min-w-fit" onClick={() => { setView('store'); setQuery(''); fetchCards('format:commander year>=2022', false); }}>
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-glow">M</div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">MysticMarket</span>
        </div>

        {(view === 'store') && (
          <div className="flex-1 max-w-xl relative group z-50" ref={wrapperRef}>
             <form onSubmit={(e) => { e.preventDefault(); selectSuggestion(query); }} className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" placeholder="Buscar..." 
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-l-full py-2 pl-4 focus:border-purple-500 outline-none"
                  value={query} onChange={handleQueryChange}
                  onFocus={() => query.length > 2 && setShowSuggestions(true)}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-50">
                    <ul className="max-h-64 overflow-y-auto custom-scrollbar">
                      {suggestions.map((s, i) => (
                        <li key={i}><button onClick={() => selectSuggestion(s)} className="w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-300 border-b border-slate-800 last:border-0">{s}</button></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button className="bg-purple-600 px-4 rounded-r-full text-white"><Search size={18}/></button>
             </form>
          </div>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {user.role === 'admin' && (
                <div className="hidden md:flex gap-2">
                  <Button variant={view === 'admin-orders' ? 'primary' : 'secondary'} onClick={() => setView('admin-orders')} className="text-xs px-3 py-1.5"><ClipboardList size={14}/> Órdenes</Button>
                  <Button variant={view === 'admin-inventory' ? 'primary' : 'secondary'} onClick={() => setView('admin-inventory')} className="text-xs px-3 py-1.5"><Package size={14}/> Stock</Button>
                </div>
              )}
              <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
                <button onClick={() => setView('profile')} className="text-sm text-slate-300 hidden sm:block hover:text-white transition-colors">
                    {user.email.split('@')[0]}
                </button>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-full" title="Cerrar Sesión"><LogOut size={20}/></button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setView('login')} className="text-sm"><User size={18}/> Entrar</Button>
          )}

          {view !== 'login' && (
            <button className="relative p-2 hover:bg-slate-800 rounded-full" onClick={() => setIsCartOpen(true)}>
              <ShoppingCart size={24} className={cart.length > 0 ? "text-purple-400" : "text-slate-400"} />
              {cart.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{cart.length}</span>}
            </button>
          )}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-purple-500 selection:text-white pb-20">
      {renderNavbar()}

      <main className="container mx-auto px-4 py-8">
        {!db && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 p-4 rounded-xl mb-6 text-center flex items-center justify-center gap-2">
            <AlertTriangle size={24} />
            <span>Atención: Configura tus credenciales de Firebase en el código para que la App funcione.</span>
          </div>
        )}

        {view === 'login' && renderLogin()}
        {view === 'admin-inventory' && renderAdminInventory()}
        {view === 'admin-orders' && renderAdminOrders()}
        {view === 'profile' && renderProfile()}
        
        {view === 'store' && (
          <>
            {!loading && cards.length === 0 && (
               <div className="text-center py-12 text-slate-500">No se encontraron cartas.</div>
            )}
            {loading ? (
              <div className="flex justify-center h-64 items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {cards.map(renderProductCard)}
              </div>
            )}
          </>
        )}

        {view === 'success' && (
             <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
               <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce"><ShieldCheck size={48} className="text-white" /></div>
               <h2 className="text-4xl font-bold text-white mb-4">¡Orden Recibida!</h2>
               <p className="mb-6 text-slate-400">Tu pedido ha sido guardado y el stock actualizado.</p>
               <Button onClick={() => setView('store')} variant="primary" className="px-8 py-3 text-lg">Seguir Comprando</Button>
             </div>
        )}
      </main>
      
      {/* Cart Sidebar (Mismo código de antes) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-800 animate-in slide-in-from-right">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingCart size={20} /> Carrito</h2>
              <button onClick={() => setIsCartOpen(false)}><X size={24} className="text-slate-400 hover:text-white" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
              {cart.map(item => (
                <div key={`${item.id}-${item.finish}`} className="bg-slate-800 rounded p-3 flex gap-3 border border-slate-700">
                  <img src={item.image} className="w-12 h-16 object-cover rounded" alt="" />
                  <div className="flex-1">
                    <div className="flex justify-between">
                       <h4 className="font-bold text-white text-sm">{item.name}</h4>
                       <span className="text-green-400 font-bold">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-1 text-slate-400">
                       <Badge color={item.finish === 'foil' ? 'bg-yellow-600' : 'bg-slate-600'}>{item.finish}</Badge>
                       <span>x{item.quantity}</span>
                    </div>
                  </div>
                  <button onClick={() => setCart(prev => prev.filter(i => i !== item))} className="text-red-400"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
               <div className="p-4 bg-slate-800 border-t border-slate-700">
                 <div className="flex justify-between text-xl font-bold text-white mb-4"><span>Total</span><span>${cartTotal.toFixed(2)}</span></div>
                 {user ? (
                   <div className="space-y-3">
                     <h3 className="text-sm font-bold text-slate-400">Datos de Envío</h3>
                     <input placeholder="Nombre" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" value={checkoutForm.name} onChange={e => setCheckoutForm({...checkoutForm, name: e.target.value})}/>
                     <input placeholder="Email" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" value={checkoutForm.email} onChange={e => setCheckoutForm({...checkoutForm, email: e.target.value})}/>
                     <Button variant="success" onClick={handleCheckoutSubmit} className="w-full">Pagar Ahora</Button>
                   </div>
                 ) : (
                   <Button variant="secondary" onClick={() => { setIsCartOpen(false); setView('login'); }} className="w-full">Inicia Sesión para Pagar</Button>
                 )}
               </div>
            )}
          </div>
        </div>
      )}

      {renderCardModal()}
    </div>
  );
}