import React, { useState } from "react";
import { PublicNavbar } from "../components/PublicNavbar";

type FAQItem = { question: string; answer: string };
type FAQCategory = { category: string; questions: FAQItem[] };

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const toggleAccordion = (index: string) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  const faqs: FAQCategory[] = [
    {
      category: "General",
      questions: [
        {
          question: "¿Qué es InterShop y cómo funciona?",
          answer:
            "InterShop es una plataforma integral de gestión de ventas e inventario diseñada específicamente para negocios mexicanos. Funciona como tu sistema central de operaciones, permitiéndote gestionar ventas, controlar inventario, generar reportes y tomar decisiones basadas en datos reales, todo desde una interfaz intuitiva y fácil de usar.",
        },
        {
          question: "¿Necesito conocimientos técnicos para usar InterShop?",
          answer:
            "No necesitas ningún conocimiento técnico. InterShop está diseñado para ser intuitivo desde el primer día. Si sabes usar un teléfono o una computadora, puedes usar InterShop. Además, ofrecemos tutoriales en video, documentación completa y soporte en español para ayudarte en cada paso.",
        },
        {
          question: "¿InterShop funciona sin internet?",
          answer:
            "InterShop requiere conexión a internet para sincronizar tus datos en tiempo real y garantizar que toda tu información esté segura en la nube. Sin embargo, algunas funciones básicas pueden seguir operando temporalmente sin conexión, y los datos se sincronizarán automáticamente cuando recuperes la conexión.",
        },
        {
          question: "¿Puedo usar InterShop en múltiples dispositivos?",
          answer:
            "¡Absolutamente! InterShop funciona en cualquier dispositivo con navegador web: computadoras, tablets y smartphones. Todos tus datos se sincronizan automáticamente, así que puedes comenzar una tarea en tu computadora y terminarla en tu teléfono sin problema alguno.",
        },
      ],
    },
    {
      category: "Precios y Planes",
      questions: [
        {
          question: "¿Cuánto cuesta InterShop?",
          answer:
            "InterShop no tiene costo de licencia ni de configuración inicial, ya que nuestro objetivo es apoyar la automatización de las pequeñas empresas. Únicamente se cubre una cuota de mantenimiento para la aplicación y la base de datos de $100 MXN mensuales, la cual es aplicable a partir del tercer mes de uso.",
        },
        {
          question: "¿Hay costos ocultos o cargos adicionales?",
          answer:
            "No, nunca. El precio que ves es el precio que pagas. No hay tarifas de instalación, costos ocultos, ni sorpresas en tu facturación. Creemos en la transparencia total. Los únicos costos adicionales serían funciones premium opcionales que tú decides agregar.",
        },
        {
          question: "¿Puedo cancelar mi suscripción en cualquier momento?",
          answer:
            "Sí, puedes cancelar tu suscripción cuando quieras, sin penalizaciones ni preguntas incómodas. Si cancelas, tendrás acceso completo hasta el final de tu período de facturación actual. Además, puedes exportar todos tus datos antes de irte.",
        },
      ],
    },
    {
      category: "Funcionalidades",
      questions: [
        {
          question: "¿Qué tipo de reportes puedo generar?",
          answer:
            "InterShop genera reportes completos de ventas diarias, semanales y mensuales, análisis de productos más vendidos, reportes de inventario bajo, márgenes de ganancia, tendencias de ventas, análisis de clientes frecuentes y mucho más. Todos los reportes se pueden exportar en PDF o Excel.",
        },
        {
          question: "¿Puedo conectar mi punto de venta físico?",
          answer:
            "Sí, InterShop se integra con la mayoría de los sistemas de punto de venta (POS) modernos. Esto permite que tus ventas físicas se sincronicen automáticamente con tu inventario digital. Contáctanos para verificar compatibilidad con tu equipo específico.",
        },
        {
          question: "¿Cómo maneja InterShop el control de inventario?",
          answer:
            "InterShop actualiza tu inventario en tiempo real con cada venta. Recibes alertas automáticas cuando un producto está por agotarse, puedes establecer niveles mínimos de stock, gestionar múltiples almacenes, hacer transferencias entre sucursales y llevar un historial completo de movimientos.",
        },
        {
          question: "¿Puedo gestionar múltiples sucursales?",
          answer:
            "Sí, nuestros planes empresariales permiten gestionar múltiples ubicaciones desde un solo dashboard. Puedes ver el rendimiento de cada sucursal por separado, transferir inventario entre ellas, comparar ventas y tener visibilidad total de todas tus operaciones en un solo lugar.",
        },
      ],
    },
    {
      category: "Seguridad y Datos",
      questions: [
        {
          question: "¿Qué tan seguros están mis datos?",
          answer:
            "La seguridad de tus datos es nuestra máxima prioridad. Utilizamos encriptación de nivel bancario (SSL/TLS), respaldos automáticos diarios, servidores en la nube con certificación internacional y cumplimos con todas las regulaciones de protección de datos.",
        },
        {
          question: "¿Quién tiene acceso a mi información?",
          answer:
            "Solo tú y las personas que tú autorices tienen acceso a tu información. Nuestro equipo técnico puede acceder a datos generales para mantenimiento, pero nunca a información sensible sin tu permiso explícito.",
        },
        {
          question: "¿Hacen respaldos de mi información?",
          answer:
            "Sí, realizamos respaldos automáticos múltiples veces al día. Tus datos se replican en diferentes ubicaciones geográficas.",
        },
        {
          question: "¿Qué pasa con mis datos si cancelo?",
          answer:
            "Puedes exportar todos tus datos. Mantenemos tus datos seguros por 60 días tras la cancelación; después se eliminan permanentemente.",
        },
      ],
    },
    {
      category: "Soporte y Ayuda",
      questions: [
        {
          question: "¿Qué tipo de soporte ofrecen?",
          answer:
            "Soporte por chat en vivo, email (menos de 24h), base de conocimientos con videos y documentación. En planes enterprise: account manager.",
        },
        {
          question: "¿El soporte está en español?",
          answer:
            "¡Por supuesto! Todo nuestro soporte y documentación está en español.",
        },
        {
          question: "¿Ofrecen capacitación para mi equipo?",
          answer:
            "Sí, sesiones en vivo (virtuales/presenciales en ciudades seleccionadas) y librería de videos.",
        },
        {
          question: "¿Qué tan rápido responden a problemas técnicos?",
          answer:
            "Primera respuesta promedio 2h en horario laboral; issues críticos priorizados.",
        },
      ],
    },
    {
      category: "Integraciones",
      questions: [
        {
          question: "¿Se integra con sistemas de facturación?",
          answer:
            "Sí, con los principales PAC/Sistemas del SAT. Puedes facturar desde InterShop o sincronizar con tu sistema.",
        },
        {
          question: "¿Puedo conectar mi tienda en línea?",
          answer:
            "Sí: Shopify, WooCommerce, Mercado Libre, etc. Inventario sincronizado para evitar sobreventa.",
        },
        {
          question: "¿Funciona con plataformas de contabilidad?",
          answer:
            "Sí: CONTPAQi, Aspel, QuickBooks. Flujo automático a contabilidad para evitar captura manual.",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50">
        <PublicNavbar />
      </div>

      <section className="relative pt-32 pb-20 px-6 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full text-sm font-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Centro de Ayuda</span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-black">Preguntas Frecuentes</h1>

          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Todo lo que necesitas saber sobre InterShop. ¿No encuentras tu respuesta? Contáctanos.
          </p>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto space-y-16">
          {faqs.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <div className="mb-8">
                <h2 className="text-4xl font-bold text-black mb-2">{category.category}</h2>
                <div className="w-20 h-1 bg-black"></div>
              </div>

              <div className="space-y-4">
                {category.questions.map((faq, questionIndex) => {
                  const globalIndex = `${categoryIndex}-${questionIndex}`;
                  const isOpen = openIndex === globalIndex;

                  return (
                    <div
                      key={questionIndex}
                      className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden hover:border-black transition-all duration-300"
                    >
                      <button
                        onClick={() => toggleAccordion(globalIndex)}
                        className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-gray-50 transition-colors duration-200"
                      >
                        <span className="text-xl font-semibold text-black pr-8">{faq.question}</span>
                        <svg
                          className={`w-6 h-6 flex-shrink-0 text-black transition-transform duration-300 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="px-8 pb-6 pt-2">
                          <div className="w-full h-px bg-gray-200 mb-4"></div>
                          <p className="text-lg text-gray-600 leading-relaxed">{faq.answer}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-black text-white p-12 md:p-16 rounded-3xl text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold">¿Aún tienes preguntas?</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Nuestro equipo está listo para ayudarte. Contáctanos y te responderemos en menos de 24 horas.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <button className="bg-white text-black px-10 py-4 rounded-full text-lg font-bold hover:bg-gray-100 transition-all duration-300 hover:scale-105">
                Contactar Soporte
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ),
                title: "Email",
                content: "soporte@intershop.mx",
                desc: "Respuesta en 24 horas",
              },
              {
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                ),
                title: "Chat",
                content: "Lun - Vie, 9am - 6pm",
                desc: "Respuesta inmediata",
              },
              {
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                ),
                title: "Base de Conocimientos",
                content: "100+ artículos",
                desc: "Guías y tutoriales",
              },
            ].map((contact, i) => (
              <div key={i} className="text-center p-8 bg-gray-50 rounded-2xl border-2 border-gray-200 hover:border-black transition-all duration-300 hover:shadow-lg">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-black text-white rounded-full mb-4">
                  {contact.icon}
                </div>
                <h3 className="text-2xl font-bold text-black mb-2">{contact.title}</h3>
                <p className="text-lg font-semibold text-gray-800 mb-1">{contact.content}</p>
                <p className="text-gray-600">{contact.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default FAQ;
