import React from "react";
import { motion, type Variants } from "framer-motion";
import { PublicNavbar } from "../components/PublicNavbar";

// Cubic-bezier tipo "easeOut"
const EASE_OUT: [number, number, number, number] = [0.17, 0.55, 0.55, 1];

// Tipamos como Variants y usamos bezier (no string)
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE_OUT },
  },
};

const MisionVision: React.FC = () => {
  const stats = [
    { number: "1+", label: "Negocios Impactados" },
    { number: "2+", label: "Ciudades" },
    { number: "1", label: "Países" },
    { number: "∞", label: "Posibilidades" },
  ];

  const valores = [
    {
      title: "Obsesión por el Cliente",
      desc:
        "Cada decisión comienza y termina con nuestros clientes. Los escuchamos activamente, anticipamos sus necesidades y celebramos sus éxitos como propios.",
    },
    {
      title: "Excelencia sin Compromiso",
      desc:
        "Buscamos la perfección en cada detalle, desde el código más pequeño hasta la experiencia completa del usuario.",
    },
    {
      title: "Innovación Constante",
      desc:
        "El mundo cambia rápidamente y nosotros cambiamos con él. Experimentamos sin miedo y aprendemos de cada error.",
    },
    {
      title: "Transparencia Total",
      desc:
        "Comunicamos con claridad, admitimos nuestros errores rápidamente y compartimos tanto éxitos como desafíos.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="fixed top-0 left-0 w-full z-50 bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <PublicNavbar />
        </div>
      </header>

      <main className="pt-[140px]">
        <section className="text-center px-6 py-24">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-6xl md:text-8xl font-extrabold mb-6"
          >
            Misión y Visión
          </motion.h2>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed"
          >
            Los principios que guían cada decisión y nos impulsan a crear soluciones extraordinarias.
          </motion.p>
        </section>

        <section className="py-24 px-6 bg-white text-center">
          <motion.h3
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-5xl font-bold mb-8"
          >
            Nuestra Misión
          </motion.h3>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            transition={{ delay: 0.2 }}
            className="text-2xl max-w-4xl mx-auto leading-relaxed"
          >
            Democratizar el acceso a tecnología de clase mundial para que cada negocio en México
            pueda competir, crecer y prosperar en la era digital.
          </motion.p>
        </section>

        <section className="py-24 px-6 bg-white">
          <div className="max-w-6xl mx-auto">
            <h3 className="text-center text-5xl font-bold mb-16">Nuestros Valores</h3>
            <div className="grid md:grid-cols-2 gap-8">
              {valores.map((v, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-10 bg-gray-50 rounded-3xl border border-gray-200 hover:shadow-xl hover:-translate-y-2 transition-all"
                >
                  <h4 className="text-2xl font-semibold mb-4">{v.title}</h4>
                  <p className="text-gray-600">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-gray-50 text-center">
          <motion.h3
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-5xl font-bold mb-8"
          >
            Nuestra Visión
          </motion.h3>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            transition={{ delay: 0.2 }}
            className="text-2xl max-w-4xl mx-auto leading-relaxed mb-16"
          >
            Ser el aliado tecnológico #1 de más de{" "}
            <span className="font-bold">10,000 negocios</span> en México y América Latina para 2030.
          </motion.p>

          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 bg-white rounded-2xl border border-gray-200 shadow-sm"
              >
                <div className="text-4xl font-extrabold text-black mb-2">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default MisionVision;
