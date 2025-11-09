import type { Route } from "./+types/home";
import { PublicNavbar } from "../components/PublicNavbar";
import Orb from "../components/animation/Orb2";
import TextType from "../components/animation/TextType";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <PublicNavbar />

      {/* Hero Section with Orb */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
        {/* Background Orb */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-80">
          <div style={{ width: '100%', height: '600px', position: 'relative' }}>
            <Orb
              hoverIntensity={0.5}
              rotateOnHover={true}
              hue={0}
              forceHoverState={false}
            />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto text-center space-y-12">
          {/* Badge */}
          <br />

          {/* TextType Component as Main Title */}
          <div className="min-h-[200px] flex items-center justify-center">
            <div className="text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-black leading-tight">
              <TextType 
                text={[
                  "InterShop POS",
                  "¡Bienvenido a InterShop!",
                  "Transforma tu negocio hoy"
                ]}
                typingSpeed={75}
                pauseDuration={2000}
                showCursor={true}
                cursorCharacter="|"
              />
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-2xl md:text-3xl text-gray-700 max-w-4xl mx-auto leading-relaxed">
            Sistema de Punto de Venta <span className="font-bold text-black">simple</span>, 
            <span className="font-bold text-black"> rápido</span> y 
            <span className="font-bold text-black"> seguro</span> para tu negocio
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-6 pt-8">
            <button className="bg-black text-white px-12 py-5 rounded-full text-lg font-bold hover:bg-gray-800 transition-all duration-300 hover:scale-105 shadow-lg">
              Comenzar Gratis
            </button>
            <button className="bg-white text-black px-12 py-5 rounded-full text-lg font-bold border-2 border-black hover:bg-gray-50 transition-all duration-300 hover:scale-105">
              Ver Demo
            </button>
          </div>

          
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-black/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold text-black mb-6">
              Todo lo que necesitas
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Herramientas poderosas diseñadas para negocios modernos
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: "Rápido y Eficiente",
                desc: "Procesa ventas en segundos. Interfaz optimizada para velocidad máxima en cada transacción."
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: "Reportes en Tiempo Real",
                desc: "Conoce el estado de tu negocio al instante con analíticas y reportes automáticos."
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                title: "100% Seguro",
                desc: "Encriptación de nivel bancario. Tus datos y los de tus clientes siempre protegidos."
              }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-10 rounded-3xl border-2 border-gray-200 hover:border-black transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 group">
                <div className="text-black mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-black mb-4">{feature.title}</h3>
                <p className="text-gray-600 text-lg leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { number: "1", label: "Negocios Activos" },
              { number: "100", label: "Transacciones/Mes" },
              { number: "99.9%", label: "Uptime" },
              { number: "24/7", label: "Soporte" }
            ].map((stat, i) => (
              <div key={i} className="text-center p-10 bg-gray-50 rounded-3xl border-2 border-gray-200 hover:border-black transition-all duration-300 hover:shadow-xl">
                <div className="text-6xl font-bold text-black mb-3">{stat.number}</div>
                <div className="text-gray-600 text-lg font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 bg-black text-white">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          <h2 className="text-5xl md:text-6xl font-bold">
            Comienza gratis hoy
          </h2>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            3 meses completamente gratis. Sin tarjeta de crédito. Sin compromisos.
          </p>
          <div className="flex flex-wrap justify-center gap-6 pt-8">
            <button className="bg-white text-black px-12 py-5 rounded-full text-lg font-bold hover:bg-gray-100 transition-all duration-300 hover:scale-105 shadow-2xl">
              Crear Cuenta Gratis
            </button>
            <button className="bg-transparent border-2 border-white text-white px-12 py-5 rounded-full text-lg font-bold hover:bg-white hover:text-black transition-all duration-300 hover:scale-105">
              Hablar con Ventas
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}