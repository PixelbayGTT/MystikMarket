import { db } from './firebase'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Search, X, Trash2, CreditCard, ShieldCheck, Menu, Zap, Filter, ChevronDown, Info, Layers } from 'lucide-react';

// --- Componentes UI Reutilizables ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-purple-600 hover:bg-purple-500 text-white shadow-lg hover:shadow-purple-500/30",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    outline: "bg-transparent border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10",
    success: "bg-green-600 hover:bg-green-500 text-white"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

const Badge = ({ children, color = 'bg-blue-600' }) => (
  <span className={`${color} text-white text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider`}>
    {children}
  </span>
);

// --- Componente Principal ---

export default function App() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]); 
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [view, setView] = useState('store'); 
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', address: '' });
  
  // Nuevo estado para el modal de detalles
  const [selectedCard, setSelectedCard] = useState(null);

  // Estados para Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [setsList, setSetsList] = useState([]);
  const [filters, setFilters] = useState({
    colors: [],
    rarity: '',
    type: '',
    set: ''
  });

  const wrapperRef = useRef(null);

  // Cargar cartas iniciales (Tendencias) y lista de Sets
  useEffect(() => {
    // Buscamos cartas populares (Commander staples) para la sección de tendencias
    fetchCards('format:commander year>=2020', false);
    fetchSets();

    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSets = async () => {
    try {
      const response = await fetch('https://api.scryfall.com/sets');
      const data = await response.json();
      if (data.data) {
        const mainSets = data.data.filter(s => ['core', 'expansion', 'masters'].includes(s.set_type));
        setSetsList(mainSets);
      }
    } catch (e) {
      console.error("Error fetching sets", e);
    }
  };

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
      } catch (error) {
        console.error("Autocomplete error:", error);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (name) => {
    setQuery(name);
    setShowSuggestions(false);
    setTimeout(() => executeSearch(name), 50);
  };

  const executeSearch = (searchQuery = query) => {
    let finalQuery = searchQuery;

    if (filters.colors.length > 0) finalQuery += ` color:${filters.colors.join('')}`;
    if (filters.rarity) finalQuery += ` r:${filters.rarity}`;
    if (filters.type) finalQuery += ` t:${filters.type}`;
    if (filters.set) finalQuery += ` s:${filters.set}`;

    fetchCards(finalQuery, true);
    setView('store');
    setShowFilters(false);
  };

  const fetchCards = async (searchQuery, isUserSearch = true) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      // Si NO es búsqueda de usuario (carga inicial), ordenamos por popularidad (edhrec) para mostrar tendencias
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

  // Función específica para mostrar todas las versiones desde el modal
  const showAllVersions = (cardName) => {
    // 1. Limpiar filtros visuales para evitar confusión
    setFilters({ colors: [], rarity: '', type: '', set: '' });
    
    // 2. Actualizar la barra de búsqueda con el nombre de la carta
    setQuery(cardName);
    
    // 3. Cerrar el modal
    setSelectedCard(null);
    
    // 4. Scroll al inicio para ver resultados
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // 5. Ejecutar búsqueda directa SOLO por nombre (limpia), activando el flag isUserSearch=true
    // Esto disparará la búsqueda con "unique:prints"
    fetchCards(cardName, true);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch();
  };

  const toggleColor = (color) => {
    setFilters(prev => {
      const exists = prev.colors.includes(color);
      const newColors = exists 
        ? prev.colors.filter(c => c !== color)
        : [...prev.colors, color];
      return { ...prev, colors: newColors };
    });
  };

  const clearFilters = () => {
    setFilters({ colors: [], rarity: '', type: '', set: '' });
  };

  // Helper para imágenes: soporta tamaño 'large' para el modal
  const getCardImage = (card, size = 'normal') => {
    if (card.image_uris?.[size]) return card.image_uris[size];
    if (card.card_faces?.[0]?.image_uris?.[size]) return card.card_faces[0].image_uris[size];
    return 'https://via.placeholder.com/250x350?text=No+Image';
  };

  const addToCart = (card, finish, price) => {
    if (!price) return;
    setCart(prev => {
      const existingItem = prev.find(item => item.id === card.id && item.finish === finish);
      if (existingItem) {
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
    // Opcional: Cerrar modal al agregar al carrito si se desea
    // setSelectedCard(null); 
  };

  const removeFromCart = (id, finish) => {
    setCart(prev => prev.filter(item => !(item.id === id && item.finish === finish)));
  };

  const updateQuantity = (id, finish, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id && item.finish === finish) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "orders"), {
        buyer: checkoutForm,
        items: cart,
        total: cartTotal,
        date: serverTimestamp(),
        status: 'pending'
      });
      setView('success');
      setCart([]);
      setCheckoutForm({ name: '', email: '', address: '' });
    } catch (error) {
      console.error("Error saving order: ", error);
      alert("Error al procesar la orden. Revisa la consola.");
    }
};


  // --- Renderizado de Modales y Vistas ---

  const renderCardModal = () => {
    if (!selectedCard) return null;

    const priceNormal = selectedCard.prices?.usd;
    const priceFoil = selectedCard.prices?.usd_foil;
    
    // Función para renderizar texto con saltos de línea
    const renderOracleText = (text) => {
        if (!text) return "Sin texto.";
        return text.split('\n').map((line, i) => (
            <p key={i} className="mb-2 last:mb-0">{line}</p>
        ));
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedCard(null)}></div>
        
        {/* Content */}
        <div className="relative bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col md:flex-row shadow-2xl border border-purple-500/30 animate-in zoom-in-95 duration-200">
          
          <button 
            onClick={() => setSelectedCard(null)}
            className="absolute top-4 right-4 z-10 bg-slate-800/80 p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={24} />
          </button>

          {/* Image Section */}
          <div className="p-6 md:w-1/2 flex items-center justify-center bg-black/40">
            <img 
              src={getCardImage(selectedCard, 'large')} 
              alt={selectedCard.name}
              className="rounded-xl shadow-2xl max-h-[60vh] object-contain"
            />
          </div>

          {/* Details Section */}
          <div className="p-6 md:w-1/2 flex flex-col">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">{selectedCard.name}</h2>
              <div className="flex items-center gap-2 mb-4">
                 <Badge color="bg-purple-600">{selectedCard.set_name}</Badge>
                 <span className="text-slate-400 text-sm capitalize">{selectedCard.rarity}</span>
                 <span className="text-slate-400 text-sm">• {selectedCard.type_line}</span>
              </div>
              
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-slate-300 font-serif leading-relaxed text-sm md:text-base">
                 {selectedCard.card_faces ? (
                    selectedCard.card_faces.map((face, idx) => (
                        <div key={idx} className="mb-4 last:mb-0 border-b border-slate-700 last:border-0 pb-4 last:pb-0">
                            <strong className="block text-purple-300 mb-1">{face.name}</strong>
                            {renderOracleText(face.oracle_text)}
                        </div>
                    ))
                 ) : (
                    renderOracleText(selectedCard.oracle_text)
                 )}
                 {selectedCard.flavor_text && (
                    <div className="mt-4 text-slate-500 italic text-sm border-t border-slate-700/50 pt-2">
                        "{selectedCard.flavor_text}"
                    </div>
                 )}
              </div>
            </div>

            <div className="mt-auto space-y-4">
               {/* BOTÓN PARA VER TODAS LAS VERSIONES */}
               <Button 
                  variant="outline" 
                  onClick={() => showAllVersions(selectedCard.name)} 
                  className="w-full border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800"
               >
                  <Layers size={18} /> Ver todas las versiones / artes
               </Button>

               <h3 className="text-slate-400 font-bold uppercase text-sm tracking-wider pt-2 border-t border-slate-700/50">Opciones de Compra</h3>
               
               {/* Normal Price Row */}
               <div className="flex items-center justify-between bg-slate-800 p-4 rounded-lg border border-slate-700">
                  <div className="flex flex-col">
                      <span className="text-white font-bold">Versión Normal</span>
                      <span className="text-slate-500 text-xs">Calidad Near Mint</span>
                  </div>
                  <div className="flex items-center gap-4">
                      {priceNormal ? (
                        <>
                           <span className="text-2xl font-bold text-green-400">${priceNormal}</span>
                           <Button onClick={() => addToCart(selectedCard, 'normal', priceNormal)} variant="primary" className="py-1.5">
                              Agregar
                           </Button>
                        </>
                      ) : <span className="text-slate-500 italic">No disponible</span>}
                  </div>
               </div>

               {/* Foil Price Row */}
               <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-purple-900/20 p-4 rounded-lg border border-purple-500/20">
                  <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                         <span className="text-white font-bold">Versión Foil</span>
                         <Zap size={14} className="text-yellow-400" fill="currentColor" />
                      </div>
                      <span className="text-slate-500 text-xs">Brillante • Coleccionable</span>
                  </div>
                  <div className="flex items-center gap-4">
                      {priceFoil ? (
                        <>
                           <span className="text-2xl font-bold text-green-400">${priceFoil}</span>
                           <Button onClick={() => addToCart(selectedCard, 'foil', priceFoil)} className="bg-yellow-600 hover:bg-yellow-500 text-white py-1.5">
                              Agregar
                           </Button>
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

  const renderFiltersPanel = () => (
    <div className="bg-slate-800 border-b border-slate-700 p-4 animate-in slide-in-from-top duration-300">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Colores */}
        <div>
          <h4 className="text-slate-400 text-sm font-bold uppercase mb-2">Colores</h4>
          <div className="flex gap-2">
            {[
              { code: 'w', color: 'bg-yellow-100' },
              { code: 'u', color: 'bg-blue-500' },
              { code: 'b', color: 'bg-slate-900' },
              { code: 'r', color: 'bg-red-500' },
              { code: 'g', color: 'bg-green-500' },
              { code: 'c', color: 'bg-slate-400' }
            ].map((c) => (
              <button
                key={c.code}
                onClick={() => toggleColor(c.code)}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${c.color} ${
                  filters.colors.includes(c.code) ? 'border-purple-400 ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-800' : 'border-slate-600 opacity-60'
                }`}
                title={`Color ${c.code.toUpperCase()}`}
              />
            ))}
          </div>
        </div>
        {/* Rareza */}
        <div>
          <h4 className="text-slate-400 text-sm font-bold uppercase mb-2">Rareza</h4>
          <select 
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-purple-500"
            value={filters.rarity}
            onChange={(e) => setFilters({...filters, rarity: e.target.value})}
          >
            <option value="">Cualquiera</option>
            <option value="common">Común</option>
            <option value="uncommon">Infrecuente</option>
            <option value="rare">Rara</option>
            <option value="mythic">Mítica</option>
          </select>
        </div>
        {/* Tipo */}
        <div>
          <h4 className="text-slate-400 text-sm font-bold uppercase mb-2">Tipo</h4>
          <select 
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-purple-500"
            value={filters.type}
            onChange={(e) => setFilters({...filters, type: e.target.value})}
          >
            <option value="">Cualquiera</option>
            <option value="creature">Criatura</option>
            <option value="instant">Instantáneo</option>
            <option value="sorcery">Conjuro</option>
            <option value="artifact">Artefacto</option>
            <option value="enchantment">Encantamiento</option>
            <option value="planeswalker">Planeswalker</option>
            <option value="land">Tierra</option>
          </select>
        </div>
        {/* Expansion */}
        <div>
          <h4 className="text-slate-400 text-sm font-bold uppercase mb-2">Expansión</h4>
          <select 
            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-purple-500"
            value={filters.set}
            onChange={(e) => setFilters({...filters, set: e.target.value})}
          >
            <option value="">Todas</option>
            {setsList.slice(0, 100).map(s => (
              <option key={s.id} value={s.code}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="container mx-auto mt-4 flex justify-end gap-2">
         <Button variant="secondary" onClick={clearFilters} className="text-sm py-1">Limpiar Filtros</Button>
      </div>
    </div>
  );

  const renderProductCard = (card) => {
    const priceNormal = card.prices?.usd;
    const priceFoil = card.prices?.usd_foil;
    const hasNormal = !!priceNormal;
    const hasFoil = !!priceFoil;

    return (
      <div key={card.id} className="bg-slate-800 rounded-lg overflow-hidden shadow-md hover:shadow-xl hover:shadow-purple-900/20 transition-all border border-slate-700 flex flex-col text-sm group/card">
        {/* Click en la imagen abre el modal */}
        <div 
            className="relative overflow-hidden bg-black aspect-[2.5/3.5] cursor-pointer" 
            onClick={() => setSelectedCard(card)}
        >
          <img 
            src={getCardImage(card)} 
            alt={card.name} 
            loading="lazy"
            className="w-full h-full object-cover transform group-hover/card:scale-110 transition-transform duration-300"
          />
          {/* Overlay de "Ver Detalles" */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
             <span className="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-sm border border-white/20">
                <Info size={12} /> Ver Detalles
             </span>
          </div>
          {card.reserved && <div className="absolute top-1 right-1 bg-yellow-600 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">RL</div>}
        </div>
        
        <div className="p-2 flex flex-col flex-grow">
          <h3 className="font-bold text-white leading-tight mb-0.5 truncate cursor-pointer hover:text-purple-400 transition-colors" onClick={() => setSelectedCard(card)} title={card.name}>{card.name}</h3>
          
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-[10px] uppercase tracking-wide truncate flex-1" title={card.set_name}>
              {card.set_name}
            </span>
             <span className={`w-2 h-2 rounded-full ${card.rarity === 'mythic' ? 'bg-orange-500' : card.rarity === 'rare' ? 'bg-yellow-400' : card.rarity === 'uncommon' ? 'bg-blue-400' : 'bg-slate-400'}`}></span>
          </div>
          
          <div className="mt-auto space-y-1.5">
            <div className="flex justify-between items-center bg-slate-900/50 px-2 py-1 rounded">
              <span className="text-slate-300 text-xs">Normal</span>
              {hasNormal ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-green-400 font-bold text-xs">${priceNormal}</span>
                  <button onClick={() => addToCart(card, 'normal', priceNormal)} className="p-1 bg-purple-600 hover:bg-purple-500 rounded text-white transition-colors">
                    <ShoppingCart size={12} />
                  </button>
                </div>
              ) : <span className="text-slate-600 text-[10px] italic">--</span>}
            </div>

            <div className={`flex justify-between items-center bg-gradient-to-r from-slate-900/50 to-purple-900/20 px-2 py-1 rounded border border-transparent ${hasFoil ? 'border-purple-500/30' : ''}`}>
              <div className="flex items-center gap-0.5">
                <Zap size={10} className="text-yellow-400" fill="currentColor" />
                <span className="text-purple-300 text-xs font-semibold">Foil</span>
              </div>
              {hasFoil ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-green-400 font-bold text-xs">${priceFoil}</span>
                  <button onClick={() => addToCart(card, 'foil', priceFoil)} className="p-1 bg-yellow-600 hover:bg-yellow-500 rounded text-white transition-colors">
                    <ShoppingCart size={12} />
                  </button>
                </div>
              ) : <span className="text-slate-600 text-[10px] italic">--</span>}
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
            <h3 className="text-xl font-bold text-slate-200 mb-4">Resumen</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {cart.map((item) => (
                <div key={`${item.id}-${item.finish}`} className="flex gap-4 items-center border-b border-slate-700 pb-4">
                    <img src={item.image} alt={item.name} className="w-12 h-16 object-cover rounded" />
                    <div className="flex-1">
                    <p className="text-white font-medium text-sm">{item.name}</p>
                    <p className="text-slate-400 text-xs flex items-center gap-1">
                        {item.finish === 'foil' && <Zap size={10} className="text-yellow-400" fill="currentColor" />}
                        {item.finish === 'foil' ? 'Foil' : 'Normal'}
                    </p>
                    <p className="text-slate-400 text-xs">Cant: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                    <p className="text-white font-bold">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                </div>
                ))}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-600 flex justify-between items-center text-xl font-bold text-white">
                <span>Total</span>
                <span className="text-green-400">${cartTotal.toFixed(2)}</span>
            </div>
        </div>
        
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-bold text-slate-200 mb-4">Envío</h3>
            <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <input required type="text" placeholder="Nombre" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={checkoutForm.name} onChange={e => setCheckoutForm({...checkoutForm, name: e.target.value})} />
                <input required type="email" placeholder="Email" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={checkoutForm.email} onChange={e => setCheckoutForm({...checkoutForm, email: e.target.value})} />
                <textarea required placeholder="Dirección" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white h-24" value={checkoutForm.address} onChange={e => setCheckoutForm({...checkoutForm, address: e.target.value})} />
                <Button variant="success" className="w-full mt-6 py-3">Confirmar (${cartTotal.toFixed(2)})</Button>
                <Button variant="secondary" onClick={() => setView('store')} className="w-full mt-2" type="button">Volver</Button>
            </form>
        </div>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 animate-bounce"><ShieldCheck size={48} className="text-white" /></div>
      <h2 className="text-4xl font-bold text-white mb-4">¡Gracias!</h2>
      <Button onClick={() => setView('store')} variant="primary" className="px-8 py-3 text-lg">Seguir Comprando</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-purple-500 selection:text-white">
      
      {/* Navbar */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer min-w-fit" onClick={() => {
              setView('store'); 
              setQuery(''); // Limpiar busqueda al ir al home para ver tendencias de nuevo
              fetchCards('format:commander year>=2020', false); // Recargar tendencias
          }}>
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-[0_0_15px_rgba(147,51,234,0.5)]">M</div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">MysticMarket</span>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl relative group z-50" ref={wrapperRef}>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder="Buscar carta..." 
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-l-full py-2 pl-4 pr-10 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  value={query}
                  onChange={handleQueryChange}
                  onFocus={() => query.length > 2 && setShowSuggestions(true)}
                />
                {query.length > 0 && (
                    <button type="button" onClick={() => {setQuery(''); setShowSuggestions(false);}} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        <X size={14} />
                    </button>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-none transition-colors flex items-center gap-2 ${showFilters ? 'bg-slate-700 text-white border-purple-500' : ''}`}
              >
                <Filter size={18} />
                <span className="hidden sm:inline text-sm">Filtros</span>
              </button>
              <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-r-full transition-colors flex items-center justify-center">
                <Search size={18} />
              </button>
            </form>
            {/* Autocomplete */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-50">
                <ul className="max-h-64 overflow-y-auto custom-scrollbar">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>
                      <button 
                        className="w-full text-left px-4 py-2 hover:bg-purple-600/20 hover:text-purple-300 text-slate-300 transition-colors border-b border-slate-800 last:border-0 flex justify-between items-center group"
                        onClick={() => selectSuggestion(suggestion)}
                      >
                        {suggestion}
                        <Search size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button 
            className="relative p-2 hover:bg-slate-800 rounded-full transition-colors"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart size={24} className={cart.length > 0 ? "text-purple-400" : "text-slate-400"} />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{cartCount}</span>
            )}
          </button>
        </div>
      </nav>

      {/* Filter Panel */}
      {showFilters && renderFiltersPanel()}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {view === 'store' && (
          <>
            {!query && !loading && (
              <div className="mb-6 flex items-end gap-4 border-b border-slate-800 pb-4">
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                  Cartas en Tendencia
                </h1>
                <p className="text-slate-500 text-sm mb-1 hidden sm:block">Lo más popular del formato Commander hoy.</p>
              </div>
            )}
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              </div>
            ) : (
              <>
                {cards.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {cards.map(renderProductCard)}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <p className="text-xl">No se encontraron cartas.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {view === 'checkout' && renderCheckout()}
        {view === 'success' && renderSuccess()}
      </main>

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-800 transform transition-transform duration-300">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingCart size={20} /> Tu Carrito</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                  <ShoppingCart size={48} className="opacity-20" />
                  <p>Tu carrito está vacío</p>
                  <Button variant="outline" onClick={() => setIsCartOpen(false)}>Explorar Tienda</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={`${item.id}-${item.finish}`} className="bg-slate-800 rounded-lg p-3 flex gap-3 border border-slate-700">
                      <img src={item.image} alt={item.name} className="w-16 h-20 object-cover rounded bg-black" />
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-white text-sm line-clamp-1">{item.name}</h4>
                          <div className="flex items-center gap-2 text-xs mt-1">
                            <Badge color="bg-slate-700">{item.set}</Badge>
                            {item.finish === 'foil' && <span className="flex items-center gap-1 text-yellow-400 font-bold bg-yellow-400/10 px-1.5 py-0.5 rounded"><Zap size={10} fill="currentColor" /> Foil</span>}
                          </div>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                          <div className="flex items-center gap-2 bg-slate-900 rounded p-1">
                            <button onClick={() => updateQuantity(item.id, item.finish, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 rounded text-slate-300">-</button>
                            <span className="text-sm font-bold min-w-[1.5rem] text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.finish, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 rounded text-slate-300">+</button>
                          </div>
                          <div className="text-right">
                            <p className="text-green-400 font-bold">${(item.price * item.quantity).toFixed(2)}</p>
                            <button onClick={() => removeFromCart(item.id, item.finish)} className="text-red-400 hover:text-red-300 text-xs mt-1 flex items-center gap-1 ml-auto"><Trash2 size={12} /> Eliminar</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-800">
                <div className="flex justify-between items-center mb-4 text-lg font-bold">
                  <span className="text-slate-300">Subtotal</span>
                  <span className="text-white">${cartTotal.toFixed(2)}</span>
                </div>
                <Button onClick={() => { setIsCartOpen(false); setView('checkout'); }} className="w-full py-3">Proceder al Pago</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Detalle de Carta */}
      {renderCardModal()}

    </div>
  );
}