import React, { useState } from "react";
import { PublicNavbar } from "../components/PublicNavbar";

const Pricing = () => {
const [billingCycle, setBillingCycle] = useState("monthly"); // monthly or yearly

const features = {
    basic: [
    "Gestión completa de inventario",
    "Control de ventas en tiempo real",
    "Reportes básicos de ventas",
    "Hasta 1,000 productos",
    "1 usuario",
    "Soporte por email",
    "Actualizaciones automáticas",
    "Respaldo diario de datos"
    ],
    pro: [
    "Todo lo del plan Básico",
    "Productos ilimitados",
    "Hasta 5 usuarios",
    "Reportes avanzados y analítica",
    "Control de múltiples almacenes",
    "Alertas de inventario bajo",
    "Soporte prioritario por chat",
    "Integraciones con facturación",
    "Exportación de datos",
    "App móvil incluida"
    ],
    enterprise: [
    "Todo lo del plan Pro",
    "Usuarios ilimitados",
    "Múltiples sucursales",
    "Dashboard ejecutivo avanzado",
    "API personalizada",
    "Gerente de cuenta dedicado",
    "Capacitación personalizada",
    "Soporte 24/7 prioritario",
    "Integraciones personalizadas",
    "Consultoría mensual incluida",
    "SLA garantizado 99.9%"
    ]
};

return (
    <div className="min-h-screen bg-white">
    {/* Static Navbar */}
    <div className="sticky top-0 z-50">
        <PublicNavbar />
    </div>

    {/* Hero Section */}
    <section className="relative pt-32 pb-20 px-6 bg-white text-black">
        <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
        }}></div>
        </div>

        <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20 mb-8">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Promoción de Lanzamiento</span>
        </div>

        {/* Title */}
        <h1 className="text-6xl md:text-7xl font-bold">
            Planes y Precios
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-black-300 max-w-3xl mx-auto leading-relaxed">
            Comienza gratis por 3 meses. Sin tarjeta de crédito. Sin compromisos.
        </p>

        {/* Special Offer Banner */}
        <div className="max-w-3xl mx-auto mt-8 bg-gradient-to-r from-green-500 to-emerald-500 p-8 rounded-2xl">
            <div className="flex items-center justify-center gap-3 mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            <h3 className="text-3xl font-bold">¡Oferta Especial de Lanzamiento!</h3>
            </div>
            <p className="text-xl font-semibold mb-2">
            🎉 Primeros 3 meses completamente GRATIS
            </p>
            <p className="text-lg opacity-90">
            Después solo $100 MXN/mes para mantener tu negocio funcionando 24/7
            </p>
        </div>
        </div>
    </section>

    {/* Billing Toggle */}
    <section className="py-8 px-6 bg-gray-50">
        <div className="max-w-md mx-auto">
        <div className="bg-white p-2 rounded-full shadow-lg border-2 border-gray-200 flex items-center">
            <button
            onClick={() => setBillingCycle("monthly")}
            className={`flex-1 py-3 px-6 rounded-full font-semibold transition-all duration-300 ${
                billingCycle === "monthly"
                ? "bg-black text-white"
                : "text-gray-600 hover:text-black"
            }`}
            >
            Mensual
            </button>
            <button
            onClick={() => setBillingCycle("yearly")}
            className={`flex-1 py-3 px-6 rounded-full font-semibold transition-all duration-300 relative ${
                billingCycle === "yearly"
                ? "bg-black text-white"
                : "text-gray-600 hover:text-black"
            }`}
            >
            Anual
            <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
                Ahorra 20%
            </span>
            </button>
        </div>
        </div>
    </section>

    {/* Pricing Cards */}
    <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
            {/* Basic Plan */}
            <div className="bg-white rounded-3xl border-2 border-gray-200 p-8 hover:border-gray-400 transition-all duration-300 hover:shadow-xl">
            <div className="mb-8">
                <h3 className="text-2xl font-bold text-black mb-2">Básico</h3>
                <p className="text-gray-600">Perfecto para emprendedores</p>
            </div>

            <div className="mb-8">
                <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-black">$0</span>
                <span className="text-gray-600">/ 3 meses</span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                Después: <span className="font-semibold text-black">${billingCycle === "monthly" ? "100" : "960"}</span>
                {billingCycle === "yearly" && " /año"}
                {billingCycle === "monthly" && " /mes"}
                </div>
            </div>

            <button className="w-full bg-black text-white py-4 rounded-full font-bold hover:bg-gray-800 transition-all duration-300 hover:scale-105 mb-8">
                Comenzar Gratis
            </button>

            <div className="space-y-4">
                <p className="font-semibold text-black mb-4">Incluye:</p>
                {features.basic.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                </div>
                ))}
            </div>
            </div>

            {/* Pro Plan - FEATURED */}
            <div className="bg-black text-white rounded-3xl border-4 border-black p-8 relative hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            {/* Popular Badge */}
            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-full text-sm font-bold">
                MÁS POPULAR
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">Pro</h3>
                <p className="text-gray-300">Para negocios en crecimiento</p>
            </div>

            <div className="mb-8">
                <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">$0</span>
                <span className="text-gray-300">/ 3 meses</span>
                </div>
                <div className="mt-2 text-sm text-gray-300">
                Después: <span className="font-semibold text-white">${billingCycle === "monthly" ? "100" : "960"}</span>
                {billingCycle === "yearly" && " /año"}
                {billingCycle === "monthly" && " /mes"}
                </div>
            </div>

            <button className="w-full bg-white text-black py-4 rounded-full font-bold hover:bg-gray-100 transition-all duration-300 hover:scale-105 mb-8">
                Comenzar Gratis
            </button>

            <div className="space-y-4">
                <p className="font-semibold mb-4">Incluye:</p>
                {features.pro.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-200">{feature}</span>
                </div>
                ))}
            </div>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white rounded-3xl border-2 border-gray-200 p-8 hover:border-gray-400 transition-all duration-300 hover:shadow-xl">
            <div className="mb-8">
                <h3 className="text-2xl font-bold text-black mb-2">Empresarial</h3>
                <p className="text-gray-600">Para empresas establecidas</p>
            </div>

            <div className="mb-8">
                <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-black">$0</span>
                <span className="text-gray-600">/ 3 meses</span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                Después: <span className="font-semibold text-black">Precio personalizado</span>
                </div>
            </div>

            <button className="w-full bg-black text-white py-4 rounded-full font-bold hover:bg-gray-800 transition-all duration-300 hover:scale-105 mb-8">
                Contactar Ventas
            </button>

            <div className="space-y-4">
                <p className="font-semibold text-black mb-4">Incluye:</p>
                {features.enterprise.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                </div>
                ))}
            </div>
            </div>
        </div>
        </div>
    </section>

    {/* Why This Price Section */}
    <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-black mb-6">
            ¿Por qué cobramos después de 3 meses?
            </h2>
            <p className="text-xl text-gray-600">
            Transparencia total sobre nuestro modelo de negocio
            </p>
        </div>

        <div className="bg-gray-50 p-10 rounded-3xl border-2 border-gray-200">
            <div className="space-y-6">
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                </div>
                <div>
                <h3 className="text-2xl font-bold text-black mb-2">Infraestructura y Servidores</h3>
                <p className="text-lg text-gray-600">
                    Mantenemos servidores seguros y confiables en la nube las 24 horas, los 7 días de la semana. 
                    Tus datos están respaldados, protegidos y siempre disponibles cuando los necesites.
                </p>
                </div>
            </div>

            <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                </div>
                <div>
                <h3 className="text-2xl font-bold text-black mb-2">Base de Datos Segura</h3>
                <p className="text-lg text-gray-600">
                    Tu información está almacenada en bases de datos de nivel empresarial con múltiples 
                    respaldos automáticos. Nunca perderás tus datos, incluso en el peor escenario posible.
                </p>
                </div>
            </div>

            <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                </div>
                <div>
                <h3 className="text-2xl font-bold text-black mb-2">Actualizaciones Constantes</h3>
                <p className="text-lg text-gray-600">
                    Nuestro equipo trabaja continuamente mejorando la plataforma, agregando nuevas funciones, 
                    corrigiendo errores y manteniéndola actualizada con las últimas tecnologías.
                </p>
                </div>
            </div>

            <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                </div>
                <div>
                <h3 className="text-2xl font-bold text-black mb-2">Soporte Dedicado</h3>
                <p className="text-lg text-gray-600">
                    Un equipo humano real está disponible para ayudarte cuando lo necesites. No robots, 
                    no respuestas automáticas - personas reales que entienden tu negocio.
                </p>
                </div>
            </div>
            </div>

            <div className="mt-8 pt-8 border-t-2 border-gray-300">
            <p className="text-xl font-bold text-black text-center">
                Solo $100 MXN/mes = $3.33 pesos por día 
            </p>
            <p className="text-lg text-gray-600 text-center mt-2">
                Menos de lo que cuesta un café, pero con el poder de transformar tu negocio
            </p>
            </div>
        </div>
        </div>
    </section>

    {/* Comparison Table */}
    <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-black mb-6">
            Compara los Planes
            </h2>
            <p className="text-xl text-gray-600">
            Encuentra el plan perfecto para tu negocio
            </p>
        </div>

        <div className="bg-white rounded-3xl border-2 border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="text-left py-6 px-8 text-lg font-bold text-black">Características</th>
                    <th className="text-center py-6 px-6 text-lg font-bold text-black">Básico</th>
                    <th className="text-center py-6 px-6 text-lg font-bold text-black bg-black text-white">Pro</th>
                    <th className="text-center py-6 px-6 text-lg font-bold text-black">Empresarial</th>
                </tr>
                </thead>
                <tbody>
                {[
                    { feature: "Usuarios", basic: "1", pro: "5", enterprise: "Ilimitados" },
                    { feature: "Productos", basic: "1,000", pro: "Ilimitados", enterprise: "Ilimitados" },
                    { feature: "Almacenes", basic: "1", pro: "3", enterprise: "Ilimitados" },
                    { feature: "Reportes", basic: "Básicos", pro: "Avanzados", enterprise: "Premium" },
                    { feature: "Soporte", basic: "Email", pro: "Chat", enterprise: "24/7 Dedicado" },
                    { feature: "Integraciones", basic: "-", pro: "✓", enterprise: "✓ Personalizadas" },
                    { feature: "API", basic: "-", pro: "-", enterprise: "✓" },
                    { feature: "Capacitación", basic: "-", pro: "-", enterprise: "✓ Personalizada" }
                ].map((row, i) => (
                    <tr key={i} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="py-5 px-8 font-semibold text-black">{row.feature}</td>
                    <td className="text-center py-5 px-6 text-gray-600">{row.basic}</td>
                    <td className="text-center py-5 px-6 bg-gray-50 font-semibold">{row.pro}</td>
                    <td className="text-center py-5 px-6 text-gray-600">{row.enterprise}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        </div>
        </div>
    </section>

   

    </div>
);
};

export default Pricing;