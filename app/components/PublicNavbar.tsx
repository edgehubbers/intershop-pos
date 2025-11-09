import React from "react";
import CardNav from "./CardNav";
import type { CardNavItem } from "./CardNav";

export function PublicNavbar() {
  const items: CardNavItem[] = [
    {
      label: "Home",
      bgColor: "#0D0716",
      textColor: "#fff",
      links: [{ label: "Home", href: "/", ariaLabel: "Ir al Home" }],
    },
    {
      label: "Sobre nosotros",
      bgColor: "#170D27",
      textColor: "#fff",
      links: [
        { label: "Nuestra misión", href: "/mision-vision", ariaLabel: "Ir a misión" },
        { label: "Historia", href: "/sobre-nosotros", ariaLabel: "Ir a historia" },
      ],
    },
    {
      label: "Precio",
      bgColor: "#271E37",
      textColor: "#fff",
      links: [
        { label: "Planes", href: "/pricing", ariaLabel: "Ver planes" },
        { label: "Preguntas", href: "/preguntas-frecuentes", ariaLabel: "Preguntas de precio" },
      ],
    },
  ];

  return (
    <CardNav
      logo="/logo.png"
      logoAlt="InterShop"
      items={items}
      baseColor="rgba(255,255,255,0.16)"
      menuColor="#000"
      buttonBgColor="#111"
      buttonTextColor="#fff"
      ease="power3.out"
    />
  );
}
