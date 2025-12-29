import { db } from './firebase'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, Search, X, Trash2, CreditCard, ShieldCheck, 
  Menu, Zap, Filter, ChevronDown, Info, Layers, User, 
  LogOut, Package, Settings, ClipboardList 
} from 'lucide-react';

// --- CONFIGURACIÓN SIMULADA (CAMBIAR A 'TRUE' CUANDO TENGAS FIREBASE) ---
const USE_FIREBASE = false; 

// --- MOCK DATABASE (Para la demo sin backend) ---
const MOCK_INVENTORY = {
  // ID de Scryfall : { normal: cantidad, foil: cantidad }
  // Ejemplo: Sol Ring (Commander Legends)
  "203f5900-3449-46ba-b83c-648c6f937666": { normal: 4, foil: 1 },
};

const MOCK_ORDERS = [
  { 
    id: "ord-001", 
    date: new Date().toISOString(), 
    buyer: { name: "Juan Pérez", email: "juan@test.com" }, 
    total: 45.50, 
    status: "pagado",
    items: [{ name: "Sol Ring", quantity: 1, finish: "normal" }] 
  }
];

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
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
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
  // Estados Globales
  const [user, setUser] = useState(null); // { email, role: 'admin' | 'user' }
  const [view, setView] = useState('store'); // store, checkout, success, admin-inventory, admin-orders, login
  const [inventory, setInventory] = useState(MOCK_INVENTORY);
  const [orders, setOrders] = useState(MOCK_ORDERS);

  // Estados de Tienda
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]); 
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [setsList, setSetsList] = useState([]);
  const [filters, setFilters] = useState({ colors: [], rarity: '', type: '', set: '' });
  
  // Estados de Checkout y Auth
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', address: '' });
  const [authForm, setAuthForm] = useState({ email: '', password: '', isRegister: false });

  const wrapperRef = useRef(null);

  // --- Inicialización ---
  useEffect(() => {
    fetchCards('format:commander year>=2021', false);
    fetchSets();
    
    // Si estuviéramos usando Firebase real, aquí escucharíamos onAuthStateChanged
    // y onSnapshot para el inventario.
  }, []);

  // --- API & Lógica de Negocio ---

  const fetchSets = async () => {
    try {
      const response = await fetch('https://api.scryfall.com/sets');
      const data = await response.json();
      if (data.data) {
        const mainSets = data.data.filter(s => ['core', 'expansion', 'masters'].includes(s.set_type));
        setSetsList(mainSets);
      }
    } catch (e) { console.error(e); }
  };

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

  const handleAuth = (e) => {
    e.preventDefault();
    // SIMULACIÓN DE AUTH
    if (authForm.email === 'admin@mystic.com' && authForm.password === 'admin123') {
      setUser({ email: authForm.email, role: 'admin' });
    } else {
      setUser({ email: authForm.email, role: 'user' });
    }
    setView('store');
  };

  const handleLogout = () => {
    setUser(null);
    setView('store');
    setCart([]);
  };

  // --- Gestión de Inventario (Admin) ---

  const updateStock = (cardId, finish, newQuantity) => {
    setInventory(prev => ({
      ...prev,
      [cardId]: {
        ...prev[cardId],
        [finish]: parseInt(newQuantity) || 0
      }
    }));
    // AQUÍ IRÍA EL CÓDIGO DE FIREBASE:
    // await setDoc(doc(db, "inventory", cardId), { [finish]: newQuantity }, { merge: true });
  };

  const getStock = (cardId, finish) => {
    return inventory[cardId]?.[finish] || 0;
  };

  // --- Carrito ---

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
        id: card.id, name: card.name, set: card.set_name, 
        image: getCardImage(card), finish, price: parseFloat(price), quantity: 1 
      }];
    });
    setIsCartOpen(true);
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    
    // 1. Crear Orden
    const newOrder = {
      id: `ord-${Date.now()}`,
      date: new Date().toISOString(),
      buyer: checkoutForm,
      total: cartTotal,
      items: cart,
      status: 'pendiente'
    };

    // 2. Actualizar Stock (Simulado)
    const newInventory = { ...inventory };
    cart.forEach(item => {
      if (newInventory[item.id]) {
        newInventory[item.id][item.finish] -= item.quantity;
      }
    });
    setInventory(newInventory);
    setOrders([newOrder, ...orders]);

    // 3. Reset
    setTimeout(() => {
      setView('success');
      setCart([]);
      setCheckoutForm({ name: '', email: '', address: '' });
    }, 1000);
  };

  // --- Utilidades ---
  const getCardImage = (card, size = 'normal') => {
    if (card.image_uris?.[size]) return card.image_uris[size];
    if (card.card_faces?.[0]?.image_uris?.[size]) return card.card_faces[0].image_uris[size];
    return 'https://via.placeholder.com/250x350?text=No+Image';
  };

  // --- VISTAS ---

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
          <button onClick={() => setAuthForm({...authForm, isRegister: !authForm.isRegister})} className="text-purple-400 hover:text-purple-300 text-sm underline">
            {authForm.isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </button>
        </div>
        
        <div className="mt-6 bg-slate-900/50 p-4 rounded text-xs text-slate-500 text-center">
          <p className="font-bold text-slate-400">Demo Admin:</p>
          <p>User: admin@mystic.com</p>
          <p>Pass: admin123</p>
        </div>
      </div>
    </div>
  );

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
                <th className="p-4">Items</th>
                <th className="p-4">Total</th>
                <th className="p-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="p-4 font-mono text-purple-400">{order.id}</td>
                  <td className="p-4">{new Date(order.date).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="text-white font-medium">{order.buyer.name}</div>
                    <div className="text-xs">{order.buyer.email}</div>
                  </td>
                  <td className="p-4">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
                        <Badge color={item.finish === 'foil' ? 'bg-yellow-600' : 'bg-slate-600'}>{item.finish === 'foil' ? 'F' : 'N'}</Badge>
                        <span className="text-slate-300">{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </td>
                  <td className="p-4 text-green-400 font-bold">${order.total.toFixed(2)}</td>
                  <td className="p-4"><Badge color="bg-blue-600">{order.status}</Badge></td>
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
            type="text" 
            placeholder="Buscar carta para stock (ej. Sheoldred)..." 
            className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 focus:border-purple-500 outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
                   {/* Normal Stock Input */}
                   <div className="flex items-center justify-between gap-2">
                     <span className="text-xs text-slate-300 w-12">Normal</span>
                     <div className="flex items-center gap-1 bg-slate-800 rounded border border-slate-600 px-1">
                       <button onClick={() => updateStock(card.id, 'normal', stockNormal - 1)} className="text-slate-400 hover:text-white px-1">-</button>
                       <input 
                         className="w-10 bg-transparent text-center text-white text-sm outline-none font-bold"
                         value={stockNormal}
                         onChange={(e) => updateStock(card.id, 'normal', e.target.value)}
                       />
                       <button onClick={() => updateStock(card.id, 'normal', stockNormal + 1)} className="text-slate-400 hover:text-white px-1">+</button>
                     </div>
                   </div>

                   {/* Foil Stock Input */}
                   <div className="flex items-center justify-between gap-2">
                     <div className="flex items-center gap-1 w-12">
                        <Zap size={10} className="text-yellow-500" />
                        <span className="text-xs text-slate-300">Foil</span>
                     </div>
                     <div className="flex items-center gap-1 bg-slate-800 rounded border border-purple-500/30 px-1">
                       <button onClick={() => updateStock(card.id, 'foil', stockFoil - 1)} className="text-slate-400 hover:text-white px-1">-</button>
                       <input 
                         className="w-10 bg-transparent text-center text-white text-sm outline-none font-bold"
                         value={stockFoil}
                         onChange={(e) => updateStock(card.id, 'foil', e.target.value)}
                       />
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

  const renderProductCard = (card) => {
    const priceNormal = card.prices?.usd;
    const priceFoil = card.prices?.usd_foil;
    
    // VERIFICACIÓN DE STOCK REAL
    const stockNormal = getStock(card.id, 'normal');
    const stockFoil = getStock(card.id, 'foil');
    
    const canBuyNormal = priceNormal && stockNormal > 0;
    const canBuyFoil = priceFoil && stockFoil > 0;

    return (
      <div key={card.id} className="bg-slate-800 rounded-lg overflow-hidden shadow-md hover:shadow-xl hover:shadow-purple-900/20 transition-all border border-slate-700 flex flex-col text-sm group/card">
        <div className="relative overflow-hidden bg-black aspect-[2.5/3.5] cursor-pointer" onClick={() => setSelectedCard(card)}>
          <img src={getCardImage(card)} alt={card.name} loading="lazy" className="w-full h-full object-cover transform group-hover/card:scale-110 transition-transform duration-300"/>
          {card.reserved && <div className="absolute top-1 right-1 bg-yellow-600 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">RL</div>}
          
          {/* Badge de Stock Agotado Visual */}
          {stockNormal === 0 && stockFoil === 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
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
            {/* Normal Row */}
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

            {/* Foil Row */}
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

  // --- NAV BAR ---
  const renderNavbar = () => (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer min-w-fit" onClick={() => { setView('store'); setQuery(''); fetchCards('format:commander year>=2021', false); }}>
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-glow">M</div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">MysticMarket</span>
        </div>

        {/* Search & Filters (Sólo en vista Store/Admin-Inventory) */}
        {(view === 'store') && (
          <div className="flex-1 max-w-xl relative group z-50">
             <form onSubmit={(e) => { e.preventDefault(); fetchCards(query, true); }} className="flex gap-2">
              <input 
                type="text" placeholder="Buscar..." 
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-l-full py-2 pl-4 focus:border-purple-500 outline-none"
                value={query} onChange={(e) => setQuery(e.target.value)}
              />
              <button className="bg-purple-600 px-4 rounded-r-full text-white"><Search size={18}/></button>
             </form>
          </div>
        )}

        {/* User Actions */}
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
                <span className="text-sm text-slate-300 hidden sm:block">{user.email.split('@')[0]}</span>
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
        {view === 'login' && renderLogin()}
        {view === 'admin-inventory' && renderAdminInventory()}
        {view === 'admin-orders' && renderAdminOrders()}
        
        {view === 'store' && (
          <>
            {/* Si es búsqueda y no hay resultados, o es la carga inicial */}
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

        {/* ... (Reutilizamos la lógica del carrito/checkout/modal del código anterior) ... */}
        {view === 'success' && (
             <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
               <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce"><ShieldCheck size={48} className="text-white" /></div>
               <h2 className="text-4xl font-bold text-white mb-4">¡Orden Recibida!</h2>
               <p className="mb-6 text-slate-400">El administrador preparará tu pedido.</p>
               <Button onClick={() => setView('store')} variant="primary" className="px-8 py-3 text-lg">Seguir Comprando</Button>
             </div>
        )}
      </main>
      
      {/* Cart Sidebar */}
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
    </div>
  );
}