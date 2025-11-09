import React from "react";
import SplitText from "../components/animation/SplitText";
import BlurText from "../components/animation/BlurText";
import ScrollFloat from "../components/animation/ScrollFloat";
import ChromaGrid from "../components/animation/ChromaGrid";
import LogoLoop from "../components/animation/LogoLoop";
import { SiReact, SiTypescript, SiTailwindcss, SiNodedotjs, SiDocker } from 'react-icons/si';
import { PublicNavbar } from "../components/PublicNavbar";

const About: React.FC = () => {
  const handleSplitComplete = () => {
    console.log("All letters have animated!");
  };

  const handleBlurComplete = () => {
    console.log("Animation completed!");
  };

  const techLogos = [
    { node: <SiReact />, title: "React", href: "https://react.dev" },
    { node: <SiTypescript />, title: "TypeScript", href: "https://www.typescriptlang.org" },
    { node: <SiTailwindcss />, title: "Tailwind CSS", href: "https://tailwindcss.com" },
    { node: <SiNodedotjs />, title: "Node.js", href: "https://nodejs.org" },
    { node: <SiDocker />, title: "Docker", href: "https://docker.com" },
  ];

  const teamMembers = [
    {
      image: "/barux.jpeg",
      title: "Baruc Ramirez",
      subtitle: "IA Developer",
      handle: "@baruxrmz",
      borderColor: "#3B82F6",
      gradient: "linear-gradient(145deg, #3B82F6, #1e40af)",
      url: "#",
    },
    {
      image: "/emi.jpeg",
      title: "Emiliano Gonzalez",
      subtitle: "Backend Engineer",
      handle: "@emi",
      borderColor: "#10B981",
      gradient: "linear-gradient(180deg, #10B981, #047857)",
      url: "#",
    },
    {
      image: "/hanna.jpeg",
      title: "Hanna Vazquez",
      subtitle: "UX Designer",
      handle: "@hanna",
      borderColor: "#F59E0B",
      gradient: "linear-gradient(145deg, #F59E0B, #d97706)",
      url: "#",
    },
    {
      image: "/fer.jpeg",
      title: "Fernanda Hernandez",
      subtitle: "Ux Desinger",
      handle: "@fernanda",
      borderColor: "#EF4444",
      gradient: "linear-gradient(180deg, #EF4444, #dc2626)",
      url: "#",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      <section className="relative min-h-screen flex items-center justify-center px-6 py-32">
        <div className="max-w-6xl mx-auto text-center space-y-12">
          <div className="inline-flex items-center gap-2 bg-white-100 px-6 py-3 rounded-full border border-gray-200 mb-8">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-black">Innovación Digital</span>
          </div>

          <SplitText
            text="Sobre Nosotros"
            className="text-7xl md:text-9xl font-bold text-black"
            delay={100}
            duration={0.6}
            ease="power3.out"
            splitType="chars"
            from={{ opacity: 0, y: 40 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0.1}
            rootMargin="-100px"
            textAlign="center"
            onLetterAnimationComplete={handleSplitComplete}
          />

          <BlurText
            text="Construimos experiencias digitales que cobran vida con movimiento y emoción"
            delay={150}
            animateBy="words"
            direction="top"
            onAnimationComplete={handleBlurComplete}
            className="text-2xl md:text-3xl text-white-700 max-w-4xl mx-auto leading-relaxed"
          />

          <div className="flex flex-wrap justify-center gap-4 pt-8">
            <button className="bg-black text-white px-10 py-4 rounded-full text-lg font-semibold hover:bg-gray-800 transition-all duration-300 hover:scale-105 shadow-lg">
              Conoce Más
            </button>
            <button className="bg-white text-black px-10 py-4 rounded-full text-lg font-semibold border-2 border-black hover:bg-gray-50 transition-all duration-300 hover:scale-105">
              Nuestro Trabajo
            </button>
          </div>
        </div>
      </section>

      <section className="py-32 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-6xl md:text-7xl font-bold text-black mb-6">
              <ScrollFloat
                animationDuration={1}
                ease="back.inOut(2)"
                scrollStart="center bottom+=50%"
                scrollEnd="bottom bottom-=40%"
                stagger={0.03}
              >
                Nuestro Equipo
              </ScrollFloat>
            </h2>
            <p className="text-xl text-gray-600">Los artistas detrás de la magia digital</p>
          </div>

          <div style={{ height: "600px", position: "relative", width: "100%" }}>
            <ChromaGrid items={teamMembers} radius={300} damping={0.45} fadeOut={0.6} ease="power3.out" />
          </div>
        </div>
      </section>

      <section className="py-32 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-6xl md:text-7xl font-bold text-black mb-6">
              <ScrollFloat
                animationDuration={1}
                ease="back.inOut(2)"
                scrollStart="center bottom+=50%"
                scrollEnd="bottom bottom-=40%"
                stagger={0.03}
              >
                Tecnologías
              </ScrollFloat>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Las herramientas que impulsan nuestras creaciones</p>
          </div>

          <div style={{ height: '200px', position: 'relative', overflow: 'hidden' }}>
            <LogoLoop
              logos={techLogos}
              speed={120}
              direction="left"
              logoHeight={48}
              gap={40}
              pauseOnHover
              scaleOnHover
              fadeOut
              fadeOutColor="#f9fafb"
              ariaLabel="Technology partners"
            />
          </div>
        </div>
      </section>

      <section className="py-32 px-6 bg-black text-white">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          <BlurText
            text="¿Listo para crear algo increíble juntos?"
            delay={100}
            animateBy="words"
            direction="top"
            className="text-5xl md:text-6xl font-bold"
          />

          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Hablemos sobre tu próximo proyecto y cómo podemos ayudarte a alcanzar tus objetivos
          </p>

          <div className="flex flex-wrap justify-center gap-6 pt-8">
            <button className="bg-white text-black px-12 py-5 rounded-full text-lg font-bold hover:bg-gray-100 transition-all duration-300 hover:scale-105 shadow-2xl">
              Ingresar al Proyecto
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
